//! Comment use cases that orchestrate repository operations.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::{
    app::use_cases::{AppUseCaseError, LoadWorkspaceResult},
    domain::{
        comment::{
            Comment, CommentAnchor, CommentBody, CommentId, CommentListQuery, CommentRepository,
            CommentRepositoryError, CommentScope, CommentStatusFilter,
        },
        spec::{MarkdownBlock, SpecFileKey, SpecId},
    },
    infrastructure::persistence::comment_store::JsonCommentRepository,
};

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
    status: CommentAnchorResolutionStatus,
    target: Option<CommentAnchorResolutionTarget>,
}

impl CommentAnchorResolution {
    fn new(
        comment: Comment,
        status: CommentAnchorResolutionStatus,
        target: Option<CommentAnchorResolutionTarget>,
    ) -> Self {
        let original_anchor = comment.anchor().clone();

        Self {
            comment,
            original_anchor,
            status,
            target,
        }
    }

    pub fn comment(&self) -> &Comment {
        &self.comment
    }

    pub fn original_anchor(&self) -> &CommentAnchor {
        &self.original_anchor
    }

    pub fn status(&self) -> CommentAnchorResolutionStatus {
        self.status
    }

    pub fn target(&self) -> Option<&CommentAnchorResolutionTarget> {
        self.target.as_ref()
    }

    pub fn is_orphaned(&self) -> bool {
        self.target.is_none()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommentAnchorResolutionStatus {
    Exact,
    MovedByHash,
    Stale,
    IndexFallback,
    Missing,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentAnchorResolutionTarget {
    block: MarkdownBlock,
}

impl CommentAnchorResolutionTarget {
    fn new(block: &MarkdownBlock) -> Self {
        Self {
            block: block.clone(),
        }
    }

    pub fn block(&self) -> &MarkdownBlock {
        &self.block
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
    let anchor = comment.anchor();
    let indexed_block = current_blocks.iter().find(|block| {
        block.index().value() == anchor.block_index().value()
            && crate::domain::comment::BlockType::from(block.block_type()) == anchor.block_type()
    });

    if let Some(block) =
        indexed_block.filter(|block| block.text_hash().as_str() == anchor.text_hash().as_str())
    {
        return CommentAnchorResolution::new(
            comment,
            CommentAnchorResolutionStatus::Exact,
            Some(CommentAnchorResolutionTarget::new(block)),
        );
    }

    if let Some(block) = current_blocks
        .iter()
        .find(|block| block.text_hash().as_str() == anchor.text_hash().as_str())
    {
        return CommentAnchorResolution::new(
            comment,
            CommentAnchorResolutionStatus::MovedByHash,
            Some(CommentAnchorResolutionTarget::new(block)),
        );
    }

    if let Some(block) = current_blocks
        .iter()
        .find(|block| block_contains_anchor_snippet(block, anchor))
    {
        return CommentAnchorResolution::new(
            comment,
            CommentAnchorResolutionStatus::Stale,
            Some(CommentAnchorResolutionTarget::new(block)),
        );
    }

    if let Some(block) = indexed_block {
        return CommentAnchorResolution::new(
            comment,
            CommentAnchorResolutionStatus::IndexFallback,
            Some(CommentAnchorResolutionTarget::new(block)),
        );
    }

    CommentAnchorResolution::new(comment, CommentAnchorResolutionStatus::Missing, None)
}

fn block_contains_anchor_snippet(block: &MarkdownBlock, anchor: &CommentAnchor) -> bool {
    let snippet = anchor.text_snippet().as_str().trim();

    if snippet.is_empty() {
        return false;
    }

    block.text().raw().contains(snippet) || block.text().normalized().contains(snippet) || {
        let snippet = snippet.to_lowercase();
        block.text().raw().to_lowercase().contains(&snippet)
            || block.text().normalized().to_lowercase().contains(&snippet)
    }
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
            "sha256_prefix_8chars",
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
            "sha256_prefix_8chars",
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
        assert_eq!(CommentAnchorResolutionStatus::Exact, resolution.status());
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
            "sha256_prefix_8chars",
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
                "sha256_prefix_8chars",
            ),
            markdown_block(
                MarkdownBlockType::Paragraph,
                2,
                "replacement",
                "replacement",
                "sha256_replacement",
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
        assert_eq!(
            CommentAnchorResolutionStatus::MovedByHash,
            resolution.status()
        );
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
    fn resolve_comment_anchors_uses_index_fallback_after_hash_and_snippet_miss() {
        let repository = FakeCommentRepository::default();
        repository
            .comments
            .borrow_mut()
            .push(comment_with_anchor("cmt_index", anchor(SpecFileKey::Impl)));
        let use_cases = use_cases(repository);
        let blocks = [markdown_block(
            MarkdownBlockType::Paragraph,
            2,
            "different block text",
            "different block text",
            "sha256_different",
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
        assert_eq!(
            CommentAnchorResolutionStatus::IndexFallback,
            resolution.status()
        );
        assert_eq!(
            "sha256_different",
            resolution
                .target()
                .expect("target should exist")
                .block()
                .text_hash()
                .as_str()
        );
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
            "sha256_changed",
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
        assert_eq!(CommentAnchorResolutionStatus::Stale, resolution.status());
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
    fn resolve_comment_anchors_returns_missing_when_no_block_can_be_matched() {
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
            "sha256_overview",
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
        assert_eq!(CommentAnchorResolutionStatus::Missing, resolution.status());
        assert!(resolution.is_orphaned());
        assert!(resolution.target().is_none());
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
