//! Comment use cases that orchestrate repository operations.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::{
    app::use_cases::{AppUseCaseError, LoadWorkspaceResult},
    domain::{
        comment::{
            AnchorResolutionReason, AnchorResolutionStatus, Comment, CommentAnchor, CommentBody,
            CommentId, CommentListQuery, CommentRepository, CommentRepositoryError, CommentScope,
            CommentStatusFilter,
        },
        spec::{MarkdownBlock, SpecFileKey, SpecId},
    },
    infrastructure::persistence::comment_store::JsonCommentRepository,
};

const MIN_FUZZY_SNIPPET_CHARS: usize = 8;
const FUZZY_MATCH_THRESHOLD: u8 = 72;
const EXACT_MATCH_SCORE: u8 = 100;

pub type FilesystemCommentUseCases =
    CommentUseCases<JsonCommentRepository, UuidCommentIdGenerator, UtcCommentClock>;

#[derive(Debug, Clone)]
pub struct CommentUseCases<Repository, IdGenerator, Clock> {
    repository: Repository,
    id_generator: IdGenerator,
    clock: Clock,
}

impl<Repository, IdGenerator, Clock> CommentUseCases<Repository, IdGenerator, Clock> {
    pub fn new(repository: Repository, id_generator: IdGenerator, clock: Clock) -> Self {
        Self {
            repository,
            id_generator,
            clock,
        }
    }
}

impl FilesystemCommentUseCases {
    pub fn for_workspace(workspace: &LoadWorkspaceResult) -> Self {
        Self::new(
            JsonCommentRepository::new(workspace.layout().clone()),
            UuidCommentIdGenerator,
            UtcCommentClock,
        )
    }
}

impl<Repository, IdGenerator, Clock> CommentUseCases<Repository, IdGenerator, Clock>
where
    Repository: CommentRepository,
    IdGenerator: GenerateCommentId,
    Clock: GetCurrentTime,
{
    pub fn list_comments(
        &self,
        spec_id: &str,
        file_key: SpecFileKey,
        status_filter: CommentStatusFilter,
    ) -> Result<Vec<Comment>, AppUseCaseError> {
        let query = CommentListQuery::with_status_filter(scope(spec_id, file_key)?, status_filter);

        self.repository.list(&query).map_err(AppUseCaseError::from)
    }

    pub fn resolve_comment_anchors(
        &self,
        spec_id: &str,
        file_key: SpecFileKey,
        status_filter: CommentStatusFilter,
        current_blocks: &[MarkdownBlock],
    ) -> Result<ResolveCommentAnchorsResult, AppUseCaseError> {
        let comments = self.list_comments(spec_id, file_key, status_filter)?;
        let resolutions = comments
            .into_iter()
            .map(|comment| resolve_comment_anchor(comment, current_blocks))
            .collect();

        Ok(ResolveCommentAnchorsResult::new(resolutions))
    }

    pub fn add_comment(
        &self,
        spec_id: &str,
        anchor: CommentAnchor,
        body: impl Into<String>,
    ) -> Result<Comment, AppUseCaseError> {
        let scope = scope(spec_id, anchor.file_key())?;
        let now = self.clock.now();
        let comment = Comment::new(
            self.id_generator.generate_comment_id()?,
            anchor,
            CommentBody::new(body)?,
            now,
            now,
        )?;

        self.repository
            .add(&scope, comment)
            .map_err(AppUseCaseError::from)
    }

    pub fn update_comment(
        &self,
        spec_id: &str,
        file_key: SpecFileKey,
        id: &str,
        body: impl Into<String>,
    ) -> Result<Comment, AppUseCaseError> {
        let scope = scope(spec_id, file_key)?;
        let id = CommentId::new(id)?;
        let mut comment = self.get_comment(&scope, &id)?;

        comment.update_body(CommentBody::new(body)?, self.clock.now())?;

        self.repository
            .update(&scope, comment)
            .map_err(AppUseCaseError::from)
    }

    pub fn delete_comment(
        &self,
        spec_id: &str,
        file_key: SpecFileKey,
        id: &str,
    ) -> Result<(), AppUseCaseError> {
        let scope = scope(spec_id, file_key)?;
        let id = CommentId::new(id)?;

        self.repository
            .delete(&scope, &id)
            .map_err(AppUseCaseError::from)
    }

    pub fn resolve_comment(
        &self,
        spec_id: &str,
        file_key: SpecFileKey,
        id: &str,
    ) -> Result<Comment, AppUseCaseError> {
        self.set_comment_resolved(spec_id, file_key, id, true)
    }

    pub fn reopen_comment(
        &self,
        spec_id: &str,
        file_key: SpecFileKey,
        id: &str,
    ) -> Result<Comment, AppUseCaseError> {
        self.set_comment_resolved(spec_id, file_key, id, false)
    }

    pub fn toggle_comment_resolved(
        &self,
        spec_id: &str,
        file_key: SpecFileKey,
        id: &str,
    ) -> Result<Comment, AppUseCaseError> {
        let scope = scope(spec_id, file_key)?;
        let id = CommentId::new(id)?;
        let comment = self.get_comment(&scope, &id)?;

        self.set_comment_resolved(spec_id, file_key, id.as_str(), !comment.is_resolved())
    }

    fn set_comment_resolved(
        &self,
        spec_id: &str,
        file_key: SpecFileKey,
        id: &str,
        resolved: bool,
    ) -> Result<Comment, AppUseCaseError> {
        let scope = scope(spec_id, file_key)?;
        let id = CommentId::new(id)?;
        let mut comment = self.get_comment(&scope, &id)?;
        let now = self.clock.now();

        if resolved {
            comment.resolve(now)?;
        } else {
            comment.reopen(now)?;
        }

        self.repository
            .update(&scope, comment)
            .map_err(AppUseCaseError::from)
    }

    fn get_comment(
        &self,
        scope: &CommentScope,
        id: &CommentId,
    ) -> Result<Comment, AppUseCaseError> {
        self.repository
            .list(&CommentListQuery::new(scope.clone()))?
            .into_iter()
            .find(|comment| comment.id() == id)
            .ok_or_else(|| CommentRepositoryError::not_found(id.clone()).into())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolveCommentAnchorsResult {
    resolutions: Vec<CommentAnchorResolution>,
}

impl ResolveCommentAnchorsResult {
    pub fn new(resolutions: Vec<CommentAnchorResolution>) -> Self {
        Self { resolutions }
    }

    pub fn resolutions(&self) -> &[CommentAnchorResolution] {
        &self.resolutions
    }

    pub fn into_resolutions(self) -> Vec<CommentAnchorResolution> {
        self.resolutions
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentAnchorResolution {
    comment: Comment,
    original_anchor: CommentAnchor,
    status: AnchorResolutionStatus,
    reason: AnchorResolutionReason,
    details: Option<String>,
    target: Option<CommentAnchorResolutionTarget>,
}

impl CommentAnchorResolution {
    fn new(
        comment: Comment,
        status: AnchorResolutionStatus,
        reason: AnchorResolutionReason,
        details: Option<String>,
        target: Option<CommentAnchorResolutionTarget>,
    ) -> Self {
        let original_anchor = comment.anchor().clone();

        Self {
            comment,
            original_anchor,
            status,
            reason,
            details,
            target,
        }
    }

    pub fn comment(&self) -> &Comment {
        &self.comment
    }

    pub fn original_anchor(&self) -> &CommentAnchor {
        &self.original_anchor
    }

    pub fn status(&self) -> AnchorResolutionStatus {
        self.status
    }

    pub fn reason(&self) -> AnchorResolutionReason {
        self.reason
    }

    pub fn details(&self) -> Option<&str> {
        self.details.as_deref()
    }

    pub fn target(&self) -> Option<&CommentAnchorResolutionTarget> {
        self.target.as_ref()
    }

    pub fn is_orphaned(&self) -> bool {
        self.status.is_orphaned()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentAnchorResolutionTarget {
    block: MarkdownBlock,
    score: u8,
}

impl CommentAnchorResolutionTarget {
    fn new(block: &MarkdownBlock, score: u8) -> Self {
        Self {
            block: block.clone(),
            score,
        }
    }

    pub fn block(&self) -> &MarkdownBlock {
        &self.block
    }

    pub fn score(&self) -> u8 {
        self.score
    }
}

pub trait GenerateCommentId {
    fn generate_comment_id(&self) -> Result<CommentId, AppUseCaseError>;
}

#[derive(Debug, Clone, Copy, Default)]
pub struct UuidCommentIdGenerator;

impl GenerateCommentId for UuidCommentIdGenerator {
    fn generate_comment_id(&self) -> Result<CommentId, AppUseCaseError> {
        CommentId::new(format!("cmt_{}", Uuid::new_v4().simple())).map_err(AppUseCaseError::from)
    }
}

pub trait GetCurrentTime {
    fn now(&self) -> DateTime<Utc>;
}

#[derive(Debug, Clone, Copy, Default)]
pub struct UtcCommentClock;

impl GetCurrentTime for UtcCommentClock {
    fn now(&self) -> DateTime<Utc> {
        Utc::now()
    }
}

fn scope(spec_id: &str, file_key: SpecFileKey) -> Result<CommentScope, AppUseCaseError> {
    Ok(CommentScope::new(SpecId::new(spec_id)?, file_key))
}

fn resolve_comment_anchor(
    comment: Comment,
    current_blocks: &[MarkdownBlock],
) -> CommentAnchorResolution {
    let anchor = comment.anchor().clone();

    if !is_supported_anchor_block_type(anchor.block_type()) {
        return CommentAnchorResolution::new(
            comment,
            AnchorResolutionStatus::Orphaned,
            AnchorResolutionReason::UnsupportedBlockType,
            Some(format!(
                "anchor block type {:?} is not supported for anchor resolution",
                anchor.block_type()
            )),
            None,
        );
    }

    let indexed_block = current_blocks.iter().find(|block| {
        block.index().value() == anchor.block_index().value()
            && crate::domain::comment::BlockType::from(block.block_type()) == anchor.block_type()
    });
    let has_canonical_fingerprint = anchor.text_hash().is_canonical();

    if let Some(block) = indexed_block.filter(|block| {
        has_canonical_fingerprint && block.text_hash().as_str() == anchor.text_hash().as_str()
    }) {
        return CommentAnchorResolution::new(
            comment,
            AnchorResolutionStatus::Resolved,
            AnchorResolutionReason::ExactMatch,
            None,
            Some(CommentAnchorResolutionTarget::new(block, EXACT_MATCH_SCORE)),
        );
    }

    if let Some(block) = current_blocks.iter().find(|block| {
        has_canonical_fingerprint && block.text_hash().as_str() == anchor.text_hash().as_str()
    }) {
        return CommentAnchorResolution::new(
            comment,
            AnchorResolutionStatus::Moved,
            AnchorResolutionReason::MovedByHash,
            None,
            Some(CommentAnchorResolutionTarget::new(block, EXACT_MATCH_SCORE)),
        );
    }

    let fuzzy_candidate_blocks = indexed_block
        .map(|block| vec![block])
        .unwrap_or_else(|| current_blocks.iter().collect());

    match select_fuzzy_anchor_candidate(&fuzzy_candidate_blocks, &anchor) {
        FuzzyAnchorSelection::Matched(candidate) => {
            return CommentAnchorResolution::new(
                comment,
                candidate.status,
                candidate.reason,
                None,
                Some(CommentAnchorResolutionTarget::new(
                    candidate.block,
                    candidate.score,
                )),
            );
        }
        FuzzyAnchorSelection::Ambiguous {
            candidate_count,
            score,
        } => {
            return orphaned_comment_anchor_resolution(
                comment,
                AnchorResolutionReason::AmbiguousFuzzyCandidates,
                format!(
                    "{candidate_count} fuzzy candidates tied at score {score}; keeping the comment recoverable without choosing a target"
                ),
            );
        }
        FuzzyAnchorSelection::BelowThreshold { best_score } => {
            if indexed_block.is_some() {
                return orphaned_comment_anchor_resolution(
                    comment,
                    AnchorResolutionReason::DeletedText,
                    format!(
                        "original block is still present, but selected text no longer matches; best fuzzy score {best_score} is below threshold {FUZZY_MATCH_THRESHOLD}"
                    ),
                );
            }

            return orphaned_comment_anchor_resolution(
                comment,
                AnchorResolutionReason::BelowThreshold,
                format!("best fuzzy score {best_score} is below threshold {FUZZY_MATCH_THRESHOLD}"),
            );
        }
        FuzzyAnchorSelection::ShortSnippet | FuzzyAnchorSelection::NoCandidates => {
            if indexed_block.is_some() {
                return orphaned_comment_anchor_resolution(
                    comment,
                    AnchorResolutionReason::DeletedText,
                    "original block is still present, but selected text could not be found"
                        .to_string(),
                );
            }
        }
    }

    orphaned_comment_anchor_resolution(
        comment,
        AnchorResolutionReason::MissingOriginalBlock,
        "original block could not be found in the current Markdown blocks".to_string(),
    )
}

#[derive(Debug, Clone, Copy)]
struct FuzzyAnchorCandidate<'a> {
    block: &'a MarkdownBlock,
    status: AnchorResolutionStatus,
    reason: AnchorResolutionReason,
    score: u8,
    distance_from_original_index: usize,
}

#[derive(Debug, Clone, Copy)]
enum FuzzyAnchorSelection<'a> {
    Matched(FuzzyAnchorCandidate<'a>),
    Ambiguous { candidate_count: usize, score: u8 },
    BelowThreshold { best_score: u8 },
    ShortSnippet,
    NoCandidates,
}

fn select_fuzzy_anchor_candidate<'a>(
    current_blocks: &[&'a MarkdownBlock],
    anchor: &CommentAnchor,
) -> FuzzyAnchorSelection<'a> {
    let snippet = normalize_fuzzy_text(anchor.text_snippet().as_str());

    if snippet.chars().count() < MIN_FUZZY_SNIPPET_CHARS {
        return FuzzyAnchorSelection::ShortSnippet;
    }

    let mut candidates = current_blocks
        .iter()
        .copied()
        .filter(|block| {
            crate::domain::comment::BlockType::from(block.block_type()) == anchor.block_type()
        })
        .filter_map(|block| fuzzy_anchor_candidate(block, anchor, &snippet))
        .collect::<Vec<_>>();

    if candidates.is_empty() {
        let best_score = best_fuzzy_score(current_blocks, anchor, &snippet);

        return best_score.map_or(FuzzyAnchorSelection::NoCandidates, |best_score| {
            FuzzyAnchorSelection::BelowThreshold { best_score }
        });
    }

    candidates.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| {
                left.distance_from_original_index
                    .cmp(&right.distance_from_original_index)
            })
            .then_with(|| left.block.index().value().cmp(&right.block.index().value()))
    });

    let best = candidates[0];
    let equally_good_count = candidates
        .iter()
        .filter(|candidate| {
            candidate.score == best.score
                && candidate.distance_from_original_index == best.distance_from_original_index
        })
        .count();

    if equally_good_count > 1 {
        return FuzzyAnchorSelection::Ambiguous {
            candidate_count: equally_good_count,
            score: best.score,
        };
    }

    FuzzyAnchorSelection::Matched(best)
}

fn fuzzy_anchor_candidate<'a>(
    block: &'a MarkdownBlock,
    anchor: &CommentAnchor,
    snippet: &str,
) -> Option<FuzzyAnchorCandidate<'a>> {
    let block_text = normalize_fuzzy_text(block.text().normalized());
    let raw_block_text = normalize_fuzzy_text(block.text().raw());
    let score = if block_text.contains(snippet) || raw_block_text.contains(snippet) {
        EXACT_MATCH_SCORE
    } else {
        fuzzy_text_score(snippet, &block_text).max(fuzzy_text_score(snippet, &raw_block_text))
    };

    if score < FUZZY_MATCH_THRESHOLD {
        return None;
    }

    let (status, reason) = if score == EXACT_MATCH_SCORE {
        (
            AnchorResolutionStatus::Moved,
            AnchorResolutionReason::StaleSnippet,
        )
    } else {
        (
            AnchorResolutionStatus::Fuzzy,
            AnchorResolutionReason::FuzzyMatch,
        )
    };

    Some(FuzzyAnchorCandidate {
        block,
        status,
        reason,
        score,
        distance_from_original_index: block.index().value().abs_diff(anchor.block_index().value()),
    })
}

fn best_fuzzy_score(
    current_blocks: &[&MarkdownBlock],
    anchor: &CommentAnchor,
    snippet: &str,
) -> Option<u8> {
    current_blocks
        .iter()
        .copied()
        .filter(|block| {
            crate::domain::comment::BlockType::from(block.block_type()) == anchor.block_type()
        })
        .map(|block| {
            let block_text = normalize_fuzzy_text(block.text().normalized());
            let raw_block_text = normalize_fuzzy_text(block.text().raw());

            if block_text.contains(snippet) || raw_block_text.contains(snippet) {
                EXACT_MATCH_SCORE
            } else {
                fuzzy_text_score(snippet, &block_text)
                    .max(fuzzy_text_score(snippet, &raw_block_text))
            }
        })
        .max()
}

fn is_supported_anchor_block_type(block_type: crate::domain::comment::BlockType) -> bool {
    matches!(
        block_type,
        crate::domain::comment::BlockType::Paragraph
            | crate::domain::comment::BlockType::Heading
            | crate::domain::comment::BlockType::ListItem
            | crate::domain::comment::BlockType::CodeBlock
            | crate::domain::comment::BlockType::BlockQuote
            | crate::domain::comment::BlockType::Table
    )
}

fn orphaned_comment_anchor_resolution(
    comment: Comment,
    reason: AnchorResolutionReason,
    details: String,
) -> CommentAnchorResolution {
    CommentAnchorResolution::new(
        comment,
        AnchorResolutionStatus::Orphaned,
        reason,
        Some(details),
        None,
    )
}

fn normalize_fuzzy_text(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn fuzzy_text_score(snippet: &str, block_text: &str) -> u8 {
    let snippet_words = words(snippet);
    let block_words = words(block_text);

    if snippet_words.is_empty() || block_words.is_empty() {
        return 0;
    }

    let best_window_score = best_word_window_score(&snippet_words, &block_words);
    let token_score = token_overlap_score(&snippet_words, &block_words);

    best_window_score.max(token_score)
}

fn words(value: &str) -> Vec<&str> {
    value.split_whitespace().collect()
}

fn best_word_window_score(snippet_words: &[&str], block_words: &[&str]) -> u8 {
    let snippet_word_count = snippet_words.len();
    let minimum_window_len = snippet_word_count.saturating_sub(1).max(1);
    let maximum_window_len = (snippet_word_count + 1).min(block_words.len());
    let snippet = snippet_words.join(" ");
    let mut best_score = 0;

    for window_len in minimum_window_len..=maximum_window_len {
        for window in block_words.windows(window_len) {
            let score = normalized_levenshtein_score(&snippet, &window.join(" "));
            best_score = best_score.max(score);
        }
    }

    best_score
}

fn token_overlap_score(snippet_words: &[&str], block_words: &[&str]) -> u8 {
    let mut unmatched_block_words = block_words.to_vec();
    let mut common_count = 0;

    for snippet_word in snippet_words {
        if let Some(position) = unmatched_block_words
            .iter()
            .position(|block_word| block_word == snippet_word)
        {
            common_count += 1;
            unmatched_block_words.remove(position);
        }
    }

    ((2 * common_count * 100) / (snippet_words.len() + block_words.len())) as u8
}

fn normalized_levenshtein_score(left: &str, right: &str) -> u8 {
    let left_chars = left.chars().collect::<Vec<_>>();
    let right_chars = right.chars().collect::<Vec<_>>();
    let max_len = left_chars.len().max(right_chars.len());

    if max_len == 0 {
        return EXACT_MATCH_SCORE;
    }

    let distance = levenshtein_distance(&left_chars, &right_chars);
    (((max_len - distance) * 100) / max_len) as u8
}

fn levenshtein_distance(left: &[char], right: &[char]) -> usize {
    let mut previous_row = (0..=right.len()).collect::<Vec<_>>();
    let mut current_row = vec![0; right.len() + 1];

    for (left_index, left_char) in left.iter().enumerate() {
        current_row[0] = left_index + 1;

        for (right_index, right_char) in right.iter().enumerate() {
            let substitution_cost = usize::from(left_char != right_char);
            current_row[right_index + 1] = (previous_row[right_index + 1] + 1)
                .min(current_row[right_index] + 1)
                .min(previous_row[right_index] + substitution_cost);
        }

        previous_row.clone_from(&current_row);
    }

    previous_row[right.len()]
}

#[cfg(test)]
mod tests {
    use std::{cell::RefCell, rc::Rc};

    use super::*;
    use crate::domain::comment::{
        BlockIndex, BlockType, CharRange, CommentStatus, TextHash, TextSnippet,
    };
    use crate::domain::spec::{
        MarkdownBlockHash, MarkdownBlockIndex, MarkdownBlockText, MarkdownBlockType,
    };

    #[derive(Debug, Clone, Default)]
    struct FakeCommentRepository {
        comments: Rc<RefCell<Vec<Comment>>>,
    }

    impl CommentRepository for FakeCommentRepository {
        fn list(&self, query: &CommentListQuery) -> Result<Vec<Comment>, CommentRepositoryError> {
            Ok(self
                .comments
                .borrow()
                .iter()
                .filter(|comment| query.includes(comment))
                .cloned()
                .collect())
        }

        fn add(
            &self,
            scope: &CommentScope,
            comment: Comment,
        ) -> Result<Comment, CommentRepositoryError> {
            if !scope.contains_comment(&comment) {
                return Err(CommentRepositoryError::scope_mismatch(
                    scope.file_key(),
                    comment.anchor().file_key(),
                ));
            }

            if self
                .comments
                .borrow()
                .iter()
                .any(|existing| existing.id() == comment.id())
            {
                return Err(CommentRepositoryError::duplicate(comment.id().clone()));
            }

            self.comments.borrow_mut().push(comment.clone());

            Ok(comment)
        }

        fn update(
            &self,
            scope: &CommentScope,
            comment: Comment,
        ) -> Result<Comment, CommentRepositoryError> {
            if !scope.contains_comment(&comment) {
                return Err(CommentRepositoryError::scope_mismatch(
                    scope.file_key(),
                    comment.anchor().file_key(),
                ));
            }

            let mut comments = self.comments.borrow_mut();
            let existing = comments
                .iter_mut()
                .find(|existing| existing.id() == comment.id())
                .ok_or_else(|| CommentRepositoryError::not_found(comment.id().clone()))?;

            *existing = comment.clone();

            Ok(comment)
        }

        fn delete(
            &self,
            _scope: &CommentScope,
            id: &CommentId,
        ) -> Result<(), CommentRepositoryError> {
            let mut comments = self.comments.borrow_mut();
            let initial_len = comments.len();
            comments.retain(|comment| comment.id() != id);

            if comments.len() == initial_len {
                return Err(CommentRepositoryError::not_found(id.clone()));
            }

            Ok(())
        }
    }

    #[derive(Debug, Clone)]
    struct FakeIdGenerator {
        id: CommentId,
    }

    impl GenerateCommentId for FakeIdGenerator {
        fn generate_comment_id(&self) -> Result<CommentId, AppUseCaseError> {
            Ok(self.id.clone())
        }
    }

    #[derive(Debug, Clone)]
    struct FakeClock {
        now: DateTime<Utc>,
    }

    impl GetCurrentTime for FakeClock {
        fn now(&self) -> DateTime<Utc> {
            self.now
        }
    }

    #[derive(Debug, Clone)]
    struct FailingCommentRepository {
        message: String,
    }

    impl CommentRepository for FailingCommentRepository {
        fn list(&self, _query: &CommentListQuery) -> Result<Vec<Comment>, CommentRepositoryError> {
            Err(CommentRepositoryError::invalid_data(self.message.clone()))
        }

        fn add(
            &self,
            _scope: &CommentScope,
            _comment: Comment,
        ) -> Result<Comment, CommentRepositoryError> {
            unreachable!("failing repository is only used for list")
        }

        fn update(
            &self,
            _scope: &CommentScope,
            _comment: Comment,
        ) -> Result<Comment, CommentRepositoryError> {
            unreachable!("failing repository is only used for list")
        }

        fn delete(
            &self,
            _scope: &CommentScope,
            _id: &CommentId,
        ) -> Result<(), CommentRepositoryError> {
            unreachable!("failing repository is only used for list")
        }
    }

    fn use_cases(
        repository: FakeCommentRepository,
    ) -> CommentUseCases<FakeCommentRepository, FakeIdGenerator, FakeClock> {
        CommentUseCases::new(
            repository,
            FakeIdGenerator {
                id: CommentId::new("cmt_generated").expect("comment id should be valid"),
            },
            FakeClock { now: timestamp(5) },
        )
    }

    fn timestamp(second: u32) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(&format!("2026-05-05T12:00:{second:02}Z"))
            .expect("timestamp should parse")
            .with_timezone(&Utc)
    }

    fn anchor(file_key: SpecFileKey) -> CommentAnchor {
        anchor_with(
            file_key,
            BlockType::Paragraph,
            2,
            "sha256:11111111",
            "selected text",
        )
    }

    fn anchor_with(
        file_key: SpecFileKey,
        block_type: BlockType,
        block_index: usize,
        text_hash: &str,
        text_snippet: &str,
    ) -> CommentAnchor {
        CommentAnchor::new(
            file_key,
            block_type,
            BlockIndex::new(block_index),
            TextHash::new(text_hash).expect("hash should be valid"),
            TextSnippet::new(text_snippet).expect("snippet should be valid"),
            CharRange::new(3, 16).expect("range should be valid"),
        )
    }

    fn comment(
        id: &str,
        file_key: SpecFileKey,
        body: &str,
        status: CommentStatus,
        updated_second: u32,
    ) -> Comment {
        Comment::restore(
            CommentId::new(id).expect("comment id should be valid"),
            anchor(file_key),
            CommentBody::new(body).expect("body should be valid"),
            status,
            timestamp(1),
            timestamp(updated_second),
        )
        .expect("comment should be valid")
    }

    fn comment_with_anchor(id: &str, anchor: CommentAnchor) -> Comment {
        Comment::restore(
            CommentId::new(id).expect("comment id should be valid"),
            anchor,
            CommentBody::new("Body").expect("body should be valid"),
            CommentStatus::Open,
            timestamp(1),
            timestamp(1),
        )
        .expect("comment should be valid")
    }

    fn markdown_block(
        block_type: MarkdownBlockType,
        index: usize,
        raw: &str,
        normalized: &str,
        text_hash: &str,
    ) -> MarkdownBlock {
        MarkdownBlock::new(
            block_type,
            MarkdownBlockIndex::new(index),
            MarkdownBlockText::new(raw, normalized).expect("block text should be valid"),
            MarkdownBlockHash::new(text_hash).expect("block hash should be valid"),
            None,
        )
    }

    #[test]
    fn list_comments_filters_by_scope_and_status() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().extend([
            comment(
                "cmt_open",
                SpecFileKey::Impl,
                "Open",
                CommentStatus::Open,
                1,
            ),
            comment(
                "cmt_resolved",
                SpecFileKey::Impl,
                "Resolved",
                CommentStatus::Resolved,
                2,
            ),
            comment(
                "cmt_tasks",
                SpecFileKey::Tasks,
                "Tasks",
                CommentStatus::Open,
                1,
            ),
        ]);
        let use_cases = use_cases(repository);

        let comments = use_cases
            .list_comments("auth-flow", SpecFileKey::Impl, CommentStatusFilter::Open)
            .expect("comments should list");

        assert_eq!(1, comments.len());
        assert_eq!("cmt_open", comments[0].id().as_str());
    }

    #[test]
    fn add_comment_generates_id_and_timestamps_in_app_layer() {
        let repository = FakeCommentRepository::default();
        let use_cases = use_cases(repository.clone());

        let added = use_cases
            .add_comment(
                "auth-flow",
                anchor(SpecFileKey::Impl),
                "  Please clarify.  ",
            )
            .expect("comment should be added");

        assert_eq!("cmt_generated", added.id().as_str());
        assert_eq!("Please clarify.", added.body().as_str());
        assert_eq!(timestamp(5), added.created_at());
        assert_eq!(timestamp(5), added.updated_at());
        assert_eq!(vec![added], *repository.comments.borrow());
    }

    #[test]
    fn add_comment_rejects_empty_body_before_persistence() {
        let repository = FakeCommentRepository::default();
        let use_cases = use_cases(repository.clone());

        let result = use_cases.add_comment("auth-flow", anchor(SpecFileKey::Impl), "   ");

        assert_eq!(
            Err(AppUseCaseError::InvalidComment {
                message: "comment body is required".to_string()
            }),
            result
        );
        assert!(repository.comments.borrow().is_empty());
    }

    #[test]
    fn update_comment_preserves_anchor_status_and_created_at() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment(
            "cmt_existing",
            SpecFileKey::Impl,
            "Old body",
            CommentStatus::Open,
            1,
        ));
        let use_cases = use_cases(repository);

        let updated = use_cases
            .update_comment(
                "auth-flow",
                SpecFileKey::Impl,
                "cmt_existing",
                "Updated body",
            )
            .expect("comment should update");

        assert_eq!("Updated body", updated.body().as_str());
        assert_eq!(SpecFileKey::Impl, updated.anchor().file_key());
        assert_eq!(CommentStatus::Open, updated.status());
        assert_eq!(timestamp(1), updated.created_at());
        assert_eq!(timestamp(5), updated.updated_at());
    }

    #[test]
    fn resolve_reopen_and_toggle_comment_status() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment(
            "cmt_existing",
            SpecFileKey::Impl,
            "Body",
            CommentStatus::Open,
            1,
        ));
        let use_cases = use_cases(repository.clone());

        let resolved = use_cases
            .resolve_comment("auth-flow", SpecFileKey::Impl, "cmt_existing")
            .expect("comment should resolve");
        let reopened = use_cases
            .reopen_comment("auth-flow", SpecFileKey::Impl, "cmt_existing")
            .expect("comment should reopen");
        let toggled = use_cases
            .toggle_comment_resolved("auth-flow", SpecFileKey::Impl, "cmt_existing")
            .expect("comment should toggle");

        assert_eq!(CommentStatus::Resolved, resolved.status());
        assert_eq!(CommentStatus::Open, reopened.status());
        assert_eq!(CommentStatus::Resolved, toggled.status());
        assert_eq!(timestamp(5), toggled.updated_at());
        assert_eq!(vec![toggled], *repository.comments.borrow());
    }

    #[test]
    fn resolve_comment_anchors_returns_exact_match_when_index_type_and_hash_match() {
        let repository = FakeCommentRepository::default();
        repository
            .comments
            .borrow_mut()
            .push(comment_with_anchor("cmt_exact", anchor(SpecFileKey::Impl)));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Paragraph,
            2,
            "selected text",
            "selected text",
            "sha256:11111111",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Resolved, resolution.status());
        assert_eq!(AnchorResolutionReason::ExactMatch, resolution.reason());
        assert_eq!(None, resolution.details());
        assert_eq!(
            2,
            resolution
                .target()
                .expect("target should exist")
                .block()
                .index()
                .value()
        );
        assert_eq!(
            "sha256:11111111",
            resolution.original_anchor().text_hash().as_str()
        );
    }

    #[test]
    fn resolve_comment_anchors_uses_snippet_not_hash_exact_for_legacy_fnv1a() {
        let repository = FakeCommentRepository::default();
        let legacy_anchor = anchor_with(
            SpecFileKey::Impl,
            BlockType::Paragraph,
            2,
            "fnv1a:89abcdef",
            "selected text",
        );
        repository
            .comments
            .borrow_mut()
            .push(comment_with_anchor("cmt_legacy", legacy_anchor));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Paragraph,
            2,
            "selected text",
            "selected text",
            "sha256:1234abcd",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("legacy anchor should remain recoverable");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Moved, resolution.status());
        assert_eq!(AnchorResolutionReason::StaleSnippet, resolution.reason());
        assert_eq!(
            "fnv1a:89abcdef",
            resolution.original_anchor().text_hash().as_str()
        );
    }

    #[test]
    fn resolve_comment_anchors_falls_back_to_document_hash_for_moved_block() {
        let repository = FakeCommentRepository::default();
        repository
            .comments
            .borrow_mut()
            .push(comment_with_anchor("cmt_moved", anchor(SpecFileKey::Impl)));
        let use_cases = use_cases(repository);
        let blocks = [
            markdown_block(
                MarkdownBlockType::Paragraph,
                0,
                "selected text",
                "selected text",
                "sha256:11111111",
            ),
            markdown_block(
                MarkdownBlockType::Paragraph,
                2,
                "replacement",
                "replacement",
                "sha256:22222222",
            ),
        ];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Moved, resolution.status());
        assert_eq!(AnchorResolutionReason::MovedByHash, resolution.reason());
        assert_eq!(
            0,
            resolution
                .target()
                .expect("target should exist")
                .block()
                .index()
                .value()
        );
    }

    #[test]
    fn resolve_comment_anchors_orphans_deleted_text_when_original_block_changed() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_deleted",
            anchor(SpecFileKey::Impl),
        ));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Paragraph,
            2,
            "different block text after deletion",
            "different block text after deletion",
            "sha256:33333333",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Orphaned, resolution.status());
        assert_eq!(AnchorResolutionReason::DeletedText, resolution.reason());
        assert!(resolution.is_orphaned());
        assert!(resolution.target().is_none());
        assert!(resolution
            .details()
            .expect("details should explain orphaning")
            .contains("original block is still present"));
    }

    #[test]
    fn resolve_comment_anchors_orphans_deleted_text_when_snippet_exists_elsewhere() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_deleted_elsewhere",
            anchor(SpecFileKey::Impl),
        ));
        let use_cases = use_cases(repository);
        let blocks = [
            markdown_block(
                MarkdownBlockType::Paragraph,
                2,
                "different block text after deletion",
                "different block text after deletion",
                "sha256:33333333",
            ),
            markdown_block(
                MarkdownBlockType::Paragraph,
                7,
                "selected text",
                "selected text",
                "sha256:44444444",
            ),
        ];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Orphaned, resolution.status());
        assert_eq!(AnchorResolutionReason::DeletedText, resolution.reason());
        assert!(resolution.target().is_none());
    }

    #[test]
    fn resolve_comment_anchors_marks_stale_when_snippet_matches_after_hash_mismatch() {
        let repository = FakeCommentRepository::default();
        repository
            .comments
            .borrow_mut()
            .push(comment_with_anchor("cmt_stale", anchor(SpecFileKey::Impl)));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Paragraph,
            3,
            "selected text with edits",
            "selected text with edits",
            "sha256:55555555",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Moved, resolution.status());
        assert_eq!(AnchorResolutionReason::StaleSnippet, resolution.reason());
        assert_eq!(
            3,
            resolution
                .target()
                .expect("target should exist")
                .block()
                .index()
                .value()
        );
    }

    #[test]
    fn resolve_comment_anchors_marks_fuzzy_for_snippet_typo() {
        let repository = FakeCommentRepository::default();
        repository
            .comments
            .borrow_mut()
            .push(comment_with_anchor("cmt_typo", anchor(SpecFileKey::Impl)));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Paragraph,
            4,
            "selected tezt",
            "selected tezt",
            "sha256:66666666",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        let target = resolution.target().expect("target should exist");
        assert_eq!(AnchorResolutionStatus::Fuzzy, resolution.status());
        assert_eq!(AnchorResolutionReason::FuzzyMatch, resolution.reason());
        assert_eq!(4, target.block().index().value());
        assert!(target.score() >= FUZZY_MATCH_THRESHOLD);
        assert!(target.score() < EXACT_MATCH_SCORE);
    }

    #[test]
    fn resolve_comment_anchors_marks_fuzzy_for_moved_reworded_block() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_reworded",
            anchor_with(
                SpecFileKey::Impl,
                BlockType::Paragraph,
                2,
                "sha256:77777777",
                "review payment failure handling",
            ),
        ));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Paragraph,
            7,
            "Review payment error handling",
            "Review payment error handling",
            "sha256:88888888",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        let target = resolution.target().expect("target should exist");
        assert_eq!(AnchorResolutionStatus::Fuzzy, resolution.status());
        assert_eq!(AnchorResolutionReason::FuzzyMatch, resolution.reason());
        assert_eq!(7, target.block().index().value());
        assert!(target.score() >= FUZZY_MATCH_THRESHOLD);
    }

    #[test]
    fn resolve_comment_anchors_orphans_when_fuzzy_score_is_below_threshold() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_low_score",
            anchor_with(
                SpecFileKey::Impl,
                BlockType::Paragraph,
                2,
                "sha256:77777777",
                "review payment failure handling",
            ),
        ));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Paragraph,
            8,
            "Release checklist and deployment notes",
            "Release checklist and deployment notes",
            "sha256:99999999",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Orphaned, resolution.status());
        assert_eq!(AnchorResolutionReason::BelowThreshold, resolution.reason());
        assert!(resolution
            .details()
            .expect("details should include score")
            .contains("below threshold"));
        assert!(resolution.target().is_none());
    }

    #[test]
    fn resolve_comment_anchors_uses_nearest_index_as_fuzzy_tie_breaker() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_tie_breaker",
            anchor(SpecFileKey::Impl),
        ));
        let use_cases = use_cases(repository);
        let blocks = [
            markdown_block(
                MarkdownBlockType::Paragraph,
                0,
                "selected text",
                "selected text",
                "sha256:aaaaaaaa",
            ),
            markdown_block(
                MarkdownBlockType::Paragraph,
                3,
                "selected text",
                "selected text",
                "sha256:bbbbbbbb",
            ),
        ];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        let target = resolution.target().expect("target should exist");
        assert_eq!(AnchorResolutionStatus::Moved, resolution.status());
        assert_eq!(AnchorResolutionReason::StaleSnippet, resolution.reason());
        assert_eq!(3, target.block().index().value());
        assert_eq!(EXACT_MATCH_SCORE, target.score());
    }

    #[test]
    fn resolve_comment_anchors_orphans_ambiguous_duplicate_text() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_duplicate",
            anchor(SpecFileKey::Impl),
        ));
        let use_cases = use_cases(repository);
        let blocks = [
            markdown_block(
                MarkdownBlockType::Paragraph,
                0,
                "selected text",
                "selected text",
                "sha256:aaaaaaaa",
            ),
            markdown_block(
                MarkdownBlockType::Paragraph,
                4,
                "selected text",
                "selected text",
                "sha256:cccccccc",
            ),
        ];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Orphaned, resolution.status());
        assert_eq!(
            AnchorResolutionReason::AmbiguousFuzzyCandidates,
            resolution.reason()
        );
        assert!(resolution.is_orphaned());
        assert!(resolution
            .details()
            .expect("details should mention tied candidates")
            .contains("2 fuzzy candidates"));
    }

    #[test]
    fn resolve_comment_anchors_filters_fuzzy_candidates_by_block_type() {
        let repository = FakeCommentRepository::default();
        repository
            .comments
            .borrow_mut()
            .push(comment_with_anchor("cmt_type", anchor(SpecFileKey::Impl)));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Heading,
            4,
            "selected text",
            "selected text",
            "sha256:dddddddd",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Orphaned, resolution.status());
        assert_eq!(
            AnchorResolutionReason::MissingOriginalBlock,
            resolution.reason()
        );
        assert!(resolution.target().is_none());
    }

    #[test]
    fn resolve_comment_anchors_keeps_duplicate_paragraph_when_original_hash_matches() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_duplicate_exact",
            anchor(SpecFileKey::Impl),
        ));
        let use_cases = use_cases(repository);
        let blocks = [
            markdown_block(
                MarkdownBlockType::Paragraph,
                0,
                "selected text",
                "selected text",
                "sha256:44444444",
            ),
            markdown_block(
                MarkdownBlockType::Paragraph,
                2,
                "selected text",
                "selected text",
                "sha256:11111111",
            ),
            markdown_block(
                MarkdownBlockType::Paragraph,
                4,
                "selected text",
                "selected text",
                "sha256:abcdef12",
            ),
        ];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Resolved, resolution.status());
        assert_eq!(AnchorResolutionReason::ExactMatch, resolution.reason());
        assert_eq!(
            2,
            resolution
                .target()
                .expect("target should exist")
                .block()
                .index()
                .value()
        );
    }

    #[test]
    fn resolve_comment_anchors_keeps_identical_heading_when_original_hash_matches() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_heading_exact",
            anchor_with(
                SpecFileKey::Impl,
                BlockType::Heading,
                1,
                "sha256:dddddddd",
                "Overview",
            ),
        ));
        let use_cases = use_cases(repository);
        let blocks = [
            markdown_block(
                MarkdownBlockType::Heading,
                0,
                "# Overview",
                "Overview",
                "sha256:eeeeeeee",
            ),
            markdown_block(
                MarkdownBlockType::Heading,
                1,
                "## Overview",
                "Overview",
                "sha256:dddddddd",
            ),
        ];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Resolved, resolution.status());
        assert_eq!(AnchorResolutionReason::ExactMatch, resolution.reason());
        assert_eq!(
            1,
            resolution
                .target()
                .expect("target should exist")
                .block()
                .index()
                .value()
        );
    }

    #[test]
    fn resolve_comment_anchors_ignores_short_snippets_for_fuzzy_matching() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_short",
            anchor_with(
                SpecFileKey::Impl,
                BlockType::Paragraph,
                2,
                "sha256:77777777",
                "short",
            ),
        ));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Paragraph,
            9,
            "short",
            "short",
            "sha256:fedcba98",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Orphaned, resolution.status());
        assert_eq!(
            AnchorResolutionReason::MissingOriginalBlock,
            resolution.reason()
        );
        assert!(resolution.target().is_none());
    }

    #[test]
    fn resolve_comment_anchors_orphans_missing_original_block_when_no_block_can_be_matched() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_missing",
            anchor(SpecFileKey::Impl),
        ));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Heading,
            0,
            "Overview",
            "Overview",
            "sha256:0123abcd",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Orphaned, resolution.status());
        assert_eq!(
            AnchorResolutionReason::MissingOriginalBlock,
            resolution.reason()
        );
        assert!(resolution.is_orphaned());
        assert!(resolution.target().is_none());
    }

    #[test]
    fn resolve_comment_anchors_orphans_unsupported_anchor_block_type() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment_with_anchor(
            "cmt_unsupported",
            anchor_with(
                SpecFileKey::Impl,
                BlockType::Other,
                2,
                "sha256:77777777",
                "selected text",
            ),
        ));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Other,
            2,
            "selected text",
            "selected text",
            "sha256:77777777",
        )];

        let result = use_cases
            .resolve_comment_anchors(
                "auth-flow",
                SpecFileKey::Impl,
                CommentStatusFilter::All,
                &blocks,
            )
            .expect("anchors should resolve");

        let resolution = &result.resolutions()[0];
        assert_eq!(AnchorResolutionStatus::Orphaned, resolution.status());
        assert_eq!(
            AnchorResolutionReason::UnsupportedBlockType,
            resolution.reason()
        );
        assert!(resolution.target().is_none());
    }

    #[test]
    fn resolve_comment_anchors_returns_invalid_data_for_malformed_comment_json() {
        let use_cases = CommentUseCases::new(
            FailingCommentRepository {
                message: "comment JSON is malformed at impl.json".to_string(),
            },
            FakeIdGenerator {
                id: CommentId::new("cmt_generated").expect("comment id should be valid"),
            },
            FakeClock { now: timestamp(5) },
        );

        let result = use_cases.resolve_comment_anchors(
            "auth-flow",
            SpecFileKey::Impl,
            CommentStatusFilter::All,
            &[],
        );

        assert!(matches!(
            result,
            Err(AppUseCaseError::CommentRepository { message }) if message.contains("malformed")
        ));
    }

    #[test]
    fn delete_comment_removes_existing_comment() {
        let repository = FakeCommentRepository::default();
        repository.comments.borrow_mut().push(comment(
            "cmt_existing",
            SpecFileKey::Impl,
            "Body",
            CommentStatus::Open,
            1,
        ));
        let use_cases = use_cases(repository.clone());

        use_cases
            .delete_comment("auth-flow", SpecFileKey::Impl, "cmt_existing")
            .expect("comment should delete");

        assert!(repository.comments.borrow().is_empty());
    }
}
