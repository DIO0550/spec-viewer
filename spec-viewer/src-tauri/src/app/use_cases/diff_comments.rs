//! Application orchestration for repository Diff comments.

use std::{
    collections::{HashMap, HashSet},
    num::NonZeroU32,
    sync::Arc,
    time::{Duration, Instant},
};

use chrono::Utc;
use thiserror::Error;
use uuid::Uuid;

use crate::domain::{
    comment::{
        diff::{
            canonical_lines, line_hash, truncate_context, CancellationToken, DiffAnchorResolution,
            DiffAnchorTarget, DiffCommentError, DiffCommentRevision, DiffLineAnchor,
            DiffReviewIdentity, ResolutionWarning, ResolutionWarningCode, ResolvedDiffComment,
            ResolvedDiffComments, StaleAnchorReason, StoredDiffComment, StoredDiffCommentDocument,
            UnavailableReason,
        },
        diff_repository::{
            DiffCommentBackendPort, DiffCommentRepositoryError, DiffCommentResolutionError,
            StoredMutationOutcome,
        },
    },
    repository::RepositoryPortError,
};

const RESOLUTION_TOTAL_DEADLINE: Duration = Duration::from_millis(200);
const MAX_RESOLUTION_COMMENTS: usize = 10_000;
const MAX_UNIQUE_FILES: usize = 10_000;
const MAX_UNIQUE_SIDE_SOURCES: usize = 20_000;
const MAX_LOADED_SOURCE_BYTES: usize = 64 * 1024 * 1024;
const MAX_LOADED_LOGICAL_LINES: usize = 2_000_000;
const MAX_GIT_FILE_LOADS: usize = 2_048;

#[derive(Debug, Error)]
pub enum DiffCommentUseCaseError {
    #[error("invalid request: {0}")]
    InvalidRequest(&'static str),
    #[error("line already has a comment")]
    LineAlreadyCommented,
    #[error("repository identity is unavailable")]
    IdentityUnavailable,
    #[error("Diff comment store failed")]
    Store(#[from] DiffCommentRepositoryError),
    #[error("repository failed")]
    Repository(#[from] RepositoryPortError),
}

#[derive(Debug, Clone)]
pub enum DiffCommentMutationOutcome {
    Committed {
        document: ResolvedDiffComments,
        durability_uncertain: bool,
    },
    Conflict {
        latest_document: ResolvedDiffComments,
    },
    PreCommitFailure {
        code: PreCommitFailureCode,
        current_document: Option<ResolvedDiffComments>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PreCommitFailureCode {
    RevisionOverflow,
    StoreBusy,
    Io,
    Permission,
    InvalidStore,
}

pub trait ResolutionClock: Send + Sync {
    fn now(&self) -> Instant;
}

#[derive(Debug)]
struct SystemResolutionClock;

impl ResolutionClock for SystemResolutionClock {
    fn now(&self) -> Instant {
        Instant::now()
    }
}

#[derive(Debug)]
struct SourceIndex {
    lines: Vec<String>,
    by_hash: HashMap<String, Vec<usize>>,
}

#[derive(Debug, Clone, Copy)]
enum CachedSourceFailure {
    Stale {
        reason: StaleAnchorReason,
        candidate_count: u32,
    },
    Unavailable(UnavailableReason),
}

impl SourceIndex {
    fn build(source: &str) -> Self {
        let lines = canonical_lines(source)
            .into_iter()
            .map(ToOwned::to_owned)
            .collect::<Vec<_>>();
        let mut by_hash = HashMap::<String, Vec<usize>>::new();
        for (index, line) in lines.iter().enumerate() {
            by_hash.entry(line_hash(line)).or_default().push(index);
        }
        Self { lines, by_hash }
    }
}

impl PreCommitFailureCode {
    pub fn retryable(self) -> bool {
        matches!(self, Self::StoreBusy | Self::Io)
    }
}

#[derive(Clone)]
pub struct DiffCommentUseCases<B: DiffCommentBackendPort> {
    backend: B,
    clock: Arc<dyn ResolutionClock>,
}

impl<B: DiffCommentBackendPort> std::fmt::Debug for DiffCommentUseCases<B> {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("DiffCommentUseCases")
            .finish_non_exhaustive()
    }
}

impl<B: DiffCommentBackendPort> DiffCommentUseCases<B> {
    pub fn new(backend: B) -> Self {
        Self {
            backend,
            clock: Arc::new(SystemResolutionClock),
        }
    }

    pub fn with_clock(backend: B, clock: Arc<dyn ResolutionClock>) -> Self {
        Self { backend, clock }
    }

    pub fn load(
        &self,
        identity: &DiffReviewIdentity,
        cancellation: &CancellationToken,
    ) -> Result<ResolvedDiffComments, DiffCommentUseCaseError> {
        let deadline = self.clock.now() + RESOLUTION_TOTAL_DEADLINE;
        let context = self.backend.resolution_context(identity, cancellation)?;
        let document = self.backend.load_document(&context)?;
        Ok(self.resolve_until(identity, &context, document, cancellation, deadline))
    }

    pub fn save(
        &self,
        identity: &DiffReviewIdentity,
        expected_revision: DiffCommentRevision,
        target: DiffAnchorTarget,
        body: String,
        cancellation: &CancellationToken,
    ) -> Result<DiffCommentMutationOutcome, DiffCommentUseCaseError> {
        let context = self.backend.resolution_context(identity, cancellation)?;
        let anchor = self.derive_anchor(&context, identity, target, cancellation)?;
        let comment =
            StoredDiffComment::new(Uuid::new_v4().to_string(), body, false, Utc::now(), anchor)
                .map_err(map_domain)?;
        let outcome =
            self.backend
                .mutate_document(&context, expected_revision, &|document, revision| {
                    let existing = self.resolve(identity, &context, document.clone(), cancellation);
                    let requested_key = (
                        comment.anchor().target().side_path(),
                        comment.anchor().target().side(),
                        comment.anchor().target().line(),
                    );
                    if existing.comments.iter().any(|existing| {
                        matches!(
                            existing.anchor_resolution,
                            DiffAnchorResolution::Unavailable { .. }
                        )
                    }) {
                        return Err(DiffCommentRepositoryError::Io);
                    }
                    let occupied = existing.comments.iter().any(|existing| {
                        match &existing.anchor_resolution {
                            DiffAnchorResolution::Exact {
                                side_path,
                                side,
                                line,
                                ..
                            }
                            | DiffAnchorResolution::Relocated {
                                side_path,
                                side,
                                line,
                                ..
                            } => (side_path, *side, *line) == requested_key,
                            _ => false,
                        }
                    });
                    if occupied {
                        return Err(DiffCommentRepositoryError::LineAlreadyCommented);
                    }
                    let mut comments = document.comments().to_vec();
                    comments.push(comment.clone());
                    document
                        .with_comments(revision, comments)
                        .map_err(|_| DiffCommentRepositoryError::InvalidStore)
                });
        self.resolve_mutation(identity, &context, outcome, cancellation)
    }

    pub fn update(
        &self,
        identity: &DiffReviewIdentity,
        expected_revision: DiffCommentRevision,
        comment_id: &str,
        body: Option<String>,
        resolved: Option<bool>,
        cancellation: &CancellationToken,
    ) -> Result<DiffCommentMutationOutcome, DiffCommentUseCaseError> {
        let context = self.backend.resolution_context(identity, cancellation)?;
        if body.is_none() && resolved.is_none() {
            return Err(DiffCommentUseCaseError::InvalidRequest("empty update"));
        }
        let id = comment_id.to_owned();
        let outcome =
            self.backend
                .mutate_document(&context, expected_revision, &|document, revision| {
                    let mut found = false;
                    let comments = document
                        .comments()
                        .iter()
                        .map(|comment| {
                            if comment.id() == id {
                                found = true;
                                comment
                                    .update(body.clone(), resolved)
                                    .map_err(|_| DiffCommentRepositoryError::InvalidStore)
                            } else {
                                Ok(comment.clone())
                            }
                        })
                        .collect::<Result<Vec<_>, _>>()?;
                    if !found {
                        return Err(DiffCommentRepositoryError::InvalidStore);
                    }
                    document
                        .with_comments(revision, comments)
                        .map_err(|_| DiffCommentRepositoryError::InvalidStore)
                });
        self.resolve_mutation(identity, &context, outcome, cancellation)
    }

    fn derive_anchor(
        &self,
        context: &B::ResolutionContext,
        identity: &DiffReviewIdentity,
        target: DiffAnchorTarget,
        cancellation: &CancellationToken,
    ) -> Result<DiffLineAnchor, DiffCommentUseCaseError> {
        self.backend.validate_target(context, &target)?;
        let source = self
            .backend
            .load_source(context, target.side(), target.side_path(), cancellation)
            .map_err(map_resolution_use_case)?;
        let lines = canonical_lines(&source);
        let index = target.line().get() as usize - 1;
        let line = lines
            .get(index)
            .ok_or(DiffCommentUseCaseError::InvalidRequest("line out of range"))?;
        let before = lines[index.saturating_sub(3)..index]
            .iter()
            .map(|line| truncate_context(line))
            .collect();
        let after = lines[index + 1..lines.len().min(index + 4)]
            .iter()
            .map(|line| truncate_context(line))
            .collect();
        DiffLineAnchor::new(
            identity.clone(),
            target,
            line_hash(line),
            truncate_context(line),
            before,
            after,
        )
        .map_err(map_domain)
    }

    fn resolve_mutation(
        &self,
        identity: &DiffReviewIdentity,
        context: &B::ResolutionContext,
        outcome: Result<StoredMutationOutcome, DiffCommentRepositoryError>,
        cancellation: &CancellationToken,
    ) -> Result<DiffCommentMutationOutcome, DiffCommentUseCaseError> {
        match outcome {
            Ok(StoredMutationOutcome::Committed {
                document,
                durability_uncertain,
            }) => {
                let mut document = self.resolve(identity, context, document, cancellation);
                if durability_uncertain {
                    document.resolution_warnings.push(ResolutionWarning {
                        code: ResolutionWarningCode::DurabilityUncertain,
                        message:
                            "The comment was committed, but durable flush could not be confirmed."
                                .into(),
                    });
                }
                Ok(DiffCommentMutationOutcome::Committed {
                    document,
                    durability_uncertain,
                })
            }
            Ok(StoredMutationOutcome::Conflict { latest_document }) => {
                Ok(DiffCommentMutationOutcome::Conflict {
                    latest_document: self.resolve(identity, context, latest_document, cancellation),
                })
            }
            Ok(StoredMutationOutcome::RevisionOverflow { current_document }) => {
                Ok(DiffCommentMutationOutcome::PreCommitFailure {
                    code: PreCommitFailureCode::RevisionOverflow,
                    current_document: Some(self.resolve(
                        identity,
                        context,
                        current_document,
                        cancellation,
                    )),
                })
            }
            Err(DiffCommentRepositoryError::LineAlreadyCommented) => {
                Err(DiffCommentUseCaseError::LineAlreadyCommented)
            }
            Err(error) => Ok(DiffCommentMutationOutcome::PreCommitFailure {
                code: match error {
                    DiffCommentRepositoryError::StoreBusy => PreCommitFailureCode::StoreBusy,
                    DiffCommentRepositoryError::Permission => PreCommitFailureCode::Permission,
                    DiffCommentRepositoryError::InvalidStore => PreCommitFailureCode::InvalidStore,
                    DiffCommentRepositoryError::Io => PreCommitFailureCode::Io,
                    DiffCommentRepositoryError::LineAlreadyCommented => {
                        unreachable!("handled above")
                    }
                },
                current_document: None,
            }),
        }
    }

    fn resolve(
        &self,
        current_identity: &DiffReviewIdentity,
        context: &B::ResolutionContext,
        document: StoredDiffCommentDocument,
        cancellation: &CancellationToken,
    ) -> ResolvedDiffComments {
        let deadline = self.clock.now() + RESOLUTION_TOTAL_DEADLINE;
        self.resolve_until(current_identity, context, document, cancellation, deadline)
    }

    fn resolve_until(
        &self,
        current_identity: &DiffReviewIdentity,
        context: &B::ResolutionContext,
        document: StoredDiffCommentDocument,
        cancellation: &CancellationToken,
        deadline: Instant,
    ) -> ResolvedDiffComments {
        let mut order = document.comments().to_vec();
        order.sort_by(|left, right| {
            (
                left.anchor().target().side_path().as_str(),
                left.anchor().target().side(),
                left.id(),
            )
                .cmp(&(
                    right.anchor().target().side_path().as_str(),
                    right.anchor().target().side(),
                    right.id(),
                ))
        });

        let mut sources: HashMap<
            (String, crate::domain::comment::diff::DiffSide),
            Result<SourceIndex, CachedSourceFailure>,
        > = HashMap::new();
        let mut loaded_bytes = 0usize;
        let mut loaded_lines = 0usize;
        let mut loads = 0usize;
        let mut unique_files = HashSet::new();
        let mut stopped = None;
        let mut resolved = Vec::with_capacity(order.len());
        let mut warning_codes = HashSet::new();

        for comment in order {
            let early_unavailable = if cancellation.is_cancelled() {
                Some(UnavailableReason::Cancelled)
            } else if self.clock.now() >= deadline || resolved.len() >= MAX_RESOLUTION_COMMENTS {
                Some(UnavailableReason::BudgetExceeded)
            } else {
                stopped
            };
            if let Some(reason) = early_unavailable {
                stopped = Some(reason);
                warning_codes.insert(reason);
                resolved.push(ResolvedDiffComment {
                    comment,
                    anchor_resolution: DiffAnchorResolution::Unavailable { reason },
                });
                continue;
            }
            let anchor = comment.anchor();
            let mapped_target = self.backend.resolve_target(context, anchor.target());
            let target = match &mapped_target {
                Ok(target) => target,
                Err(DiffCommentResolutionError::Stale {
                    reason,
                    candidate_count,
                }) => {
                    resolved.push(ResolvedDiffComment {
                        comment,
                        anchor_resolution: DiffAnchorResolution::Stale {
                            reason: *reason,
                            candidate_count: *candidate_count,
                        },
                    });
                    continue;
                }
                Err(DiffCommentResolutionError::Unavailable(error)) => {
                    let reason = map_repository_unavailable(error.clone());
                    warning_codes.insert(reason);
                    resolved.push(ResolvedDiffComment {
                        comment,
                        anchor_resolution: DiffAnchorResolution::Unavailable { reason },
                    });
                    continue;
                }
            };
            let key = (target.side_path().as_str().to_owned(), target.side());
            unique_files.insert(target.side_path().as_str().to_owned());
            let unavailable = if cancellation.is_cancelled() {
                Some(UnavailableReason::Cancelled)
            } else if self.clock.now() >= deadline
                || resolved.len() >= MAX_RESOLUTION_COMMENTS
                || unique_files.len() > MAX_UNIQUE_FILES
                || sources.len() >= MAX_UNIQUE_SIDE_SOURCES
            {
                Some(UnavailableReason::BudgetExceeded)
            } else {
                stopped
            };
            let resolution = if let Some(reason) = unavailable {
                stopped = Some(reason);
                DiffAnchorResolution::Unavailable { reason }
            } else {
                let source = sources.entry(key).or_insert_with(|| {
                    if cancellation.is_cancelled() {
                        return Err(CachedSourceFailure::Unavailable(
                            UnavailableReason::Cancelled,
                        ));
                    }
                    if self.clock.now() >= deadline || loads >= MAX_GIT_FILE_LOADS {
                        return Err(CachedSourceFailure::Unavailable(
                            UnavailableReason::BudgetExceeded,
                        ));
                    }
                    loads += 1;
                    let loaded = self
                        .backend
                        .load_source(context, target.side(), target.side_path(), cancellation)
                        .map_err(|error| match error {
                            DiffCommentResolutionError::Stale {
                                reason,
                                candidate_count,
                            } => CachedSourceFailure::Stale {
                                reason,
                                candidate_count,
                            },
                            DiffCommentResolutionError::Unavailable(error) => {
                                CachedSourceFailure::Unavailable(map_repository_unavailable(error))
                            }
                        })?;
                    if cancellation.is_cancelled() {
                        return Err(CachedSourceFailure::Unavailable(
                            UnavailableReason::Cancelled,
                        ));
                    }
                    if self.clock.now() >= deadline {
                        return Err(CachedSourceFailure::Unavailable(
                            UnavailableReason::BudgetExceeded,
                        ));
                    }
                    let line_count = canonical_lines(&loaded).len();
                    if cancellation.is_cancelled() {
                        return Err(CachedSourceFailure::Unavailable(
                            UnavailableReason::Cancelled,
                        ));
                    }
                    if self.clock.now() >= deadline {
                        return Err(CachedSourceFailure::Unavailable(
                            UnavailableReason::BudgetExceeded,
                        ));
                    }
                    if !source_within_budget(loaded_bytes, loaded_lines, loaded.len(), line_count) {
                        return Err(CachedSourceFailure::Unavailable(
                            UnavailableReason::BudgetExceeded,
                        ));
                    }
                    loaded_bytes += loaded.len();
                    loaded_lines += line_count;
                    let index = SourceIndex::build(&loaded);
                    if cancellation.is_cancelled() {
                        return Err(CachedSourceFailure::Unavailable(
                            UnavailableReason::Cancelled,
                        ));
                    }
                    if self.clock.now() >= deadline {
                        return Err(CachedSourceFailure::Unavailable(
                            UnavailableReason::BudgetExceeded,
                        ));
                    }
                    Ok(index)
                });
                let resolution = match source {
                    Err(CachedSourceFailure::Stale {
                        reason,
                        candidate_count,
                    }) => DiffAnchorResolution::Stale {
                        reason: *reason,
                        candidate_count: *candidate_count,
                    },
                    Err(CachedSourceFailure::Unavailable(reason)) => {
                        DiffAnchorResolution::Unavailable { reason: *reason }
                    }
                    Ok(source) => resolve_one_for_target(
                        anchor,
                        target,
                        source,
                        anchor.identity() == current_identity,
                    ),
                };
                if let DiffAnchorResolution::Unavailable {
                    reason:
                        reason @ (UnavailableReason::BudgetExceeded | UnavailableReason::Cancelled),
                } = resolution
                {
                    stopped = Some(reason);
                }
                resolution
            };
            if let DiffAnchorResolution::Unavailable { reason } = resolution {
                warning_codes.insert(reason);
            }
            resolved.push(ResolvedDiffComment {
                comment,
                anchor_resolution: resolution,
            });
        }
        let mut codes = warning_codes.into_iter().collect::<Vec<_>>();
        codes.sort_by_key(|code| unavailable_order(*code));
        let resolution_warnings = codes
            .into_iter()
            .map(|code| ResolutionWarning {
                code: ResolutionWarningCode::ResolutionUnavailable(code),
                message: unavailable_message(code).into(),
            })
            .collect();
        ResolvedDiffComments {
            current_identity: current_identity.clone(),
            document,
            comments: resolved,
            resolution_warnings,
        }
    }
}

#[cfg(test)]
fn resolve_one(anchor: &DiffLineAnchor, source: &SourceIndex) -> DiffAnchorResolution {
    resolve_one_for_target(anchor, anchor.target(), source, true)
}

fn resolve_one_for_target(
    anchor: &DiffLineAnchor,
    runtime_target: &DiffAnchorTarget,
    source: &SourceIndex,
    identity_matches: bool,
) -> DiffAnchorResolution {
    let lines = &source.lines;
    let original = anchor.target().line().get() as usize - 1;
    if identity_matches
        && lines
            .get(original)
            .is_some_and(|line| line_hash(line) == anchor.line_hash())
    {
        return DiffAnchorResolution::Exact {
            selection_path: runtime_target.selection_path().clone(),
            side_path: anchor.target().side_path().clone(),
            side: anchor.target().side(),
            line: anchor.target().line(),
        };
    }
    let candidates = source
        .by_hash
        .get(anchor.line_hash())
        .into_iter()
        .flatten()
        .copied()
        .filter(|candidate| context_matches(anchor, lines, *candidate))
        .collect::<Vec<_>>();
    if candidates.len() == 1 {
        return DiffAnchorResolution::Relocated {
            selection_path: runtime_target.selection_path().clone(),
            side_path: anchor.target().side_path().clone(),
            side: anchor.target().side(),
            line: NonZeroU32::new((candidates[0] + 1) as u32).expect("positive"),
        };
    }
    DiffAnchorResolution::Stale {
        reason: if candidates.is_empty() {
            StaleAnchorReason::ContextNotFound
        } else {
            StaleAnchorReason::AmbiguousContext
        },
        candidate_count: candidates.len().min(u32::MAX as usize) as u32,
    }
}

fn context_matches(anchor: &DiffLineAnchor, lines: &[String], candidate: usize) -> bool {
    let before_count = anchor.context_before().len();
    let before_start = candidate.saturating_sub(before_count);
    let candidate_before = lines[before_start..candidate]
        .iter()
        .map(|line| truncate_context(line))
        .collect::<Vec<_>>();
    let after_end = lines
        .len()
        .min(candidate + 1 + anchor.context_after().len());
    let candidate_after = lines[candidate + 1..after_end]
        .iter()
        .map(|line| truncate_context(line))
        .collect::<Vec<_>>();
    candidate_before == anchor.context_before() && candidate_after == anchor.context_after()
}

fn map_resolution_use_case(error: DiffCommentResolutionError) -> DiffCommentUseCaseError {
    match error {
        DiffCommentResolutionError::Stale { .. } => {
            DiffCommentUseCaseError::InvalidRequest("target is not commentable")
        }
        DiffCommentResolutionError::Unavailable(error) => {
            DiffCommentUseCaseError::Repository(error)
        }
    }
}

fn map_repository_unavailable(error: RepositoryPortError) -> UnavailableReason {
    match error {
        RepositoryPortError::PermissionDenied => UnavailableReason::Permission,
        RepositoryPortError::Cancelled => UnavailableReason::Cancelled,
        RepositoryPortError::StaleSnapshot
        | RepositoryPortError::EntryChangedDuringRead
        | RepositoryPortError::HeadChangedDuringRead => UnavailableReason::RepositoryChanged,
        _ => UnavailableReason::Io,
    }
}

fn unavailable_order(reason: UnavailableReason) -> u8 {
    match reason {
        UnavailableReason::Io => 0,
        UnavailableReason::Permission => 1,
        UnavailableReason::BudgetExceeded => 2,
        UnavailableReason::Cancelled => 3,
        UnavailableReason::RepositoryChanged => 4,
    }
}

fn unavailable_message(reason: UnavailableReason) -> &'static str {
    match reason {
        UnavailableReason::Io => "Some comment locations could not be read.",
        UnavailableReason::Permission => "Permission denied while resolving comment locations.",
        UnavailableReason::BudgetExceeded => "Comment resolution stopped at its safety budget.",
        UnavailableReason::Cancelled => "Comment resolution was cancelled.",
        UnavailableReason::RepositoryChanged => "The repository changed during comment resolution.",
    }
}

fn source_within_budget(
    loaded_bytes: usize,
    loaded_lines: usize,
    additional_bytes: usize,
    additional_lines: usize,
) -> bool {
    loaded_bytes.saturating_add(additional_bytes) <= MAX_LOADED_SOURCE_BYTES
        && loaded_lines.saturating_add(additional_lines) <= MAX_LOADED_LOGICAL_LINES
}

fn map_domain(_error: DiffCommentError) -> DiffCommentUseCaseError {
    DiffCommentUseCaseError::InvalidRequest("invalid Diff comment")
}

#[cfg(test)]
mod tests {
    use std::sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Mutex,
    };

    use super::*;
    use crate::domain::{
        comment::diff::{DiffSide, WorktreeStorageId},
        repository::{CommitSha, RepositoryId, RepositoryRelativePath, SnapshotId},
    };
    use crate::infrastructure::{
        git::{DiffCommentResolutionContext, GitRepositoryAdapter},
        persistence::diff_comment_backend::FilesystemDiffCommentBackend,
    };

    fn identity() -> DiffReviewIdentity {
        DiffReviewIdentity::new(
            RepositoryId::parse(format!("rr1_{}", "1".repeat(64))).unwrap(),
            WorktreeStorageId::parse(format!("rw1_{}", "2".repeat(64))).unwrap(),
            CommitSha::parse("3".repeat(40)).unwrap(),
            SnapshotId::parse(format!("rs1_{}", "4".repeat(64))).unwrap(),
        )
    }

    fn anchor(line: u32, text: &str) -> DiffLineAnchor {
        let target = DiffAnchorTarget::new(
            DiffSide::Current,
            None,
            Some(RepositoryRelativePath::parse("src/lib.rs").unwrap()),
            NonZeroU32::new(line).unwrap(),
        )
        .unwrap();
        DiffLineAnchor::new(
            identity(),
            target,
            line_hash(text),
            truncate_context(text),
            vec![],
            vec![],
        )
        .unwrap()
    }

    fn document() -> StoredDiffCommentDocument {
        let comment = StoredDiffComment::new(
            "c1".into(),
            "body".into(),
            false,
            Utc::now(),
            anchor(1, "line"),
        )
        .unwrap();
        StoredDiffCommentDocument::new(identity().scope(), DiffCommentRevision::ZERO, vec![comment])
            .unwrap()
    }

    #[derive(Clone)]
    struct FakeBackend {
        document: StoredDiffCommentDocument,
        source_calls: Arc<AtomicUsize>,
        context_calls: Arc<AtomicUsize>,
        fail_source_after: Option<usize>,
        cancel_after_first_source: bool,
        advance_deadline_on_document_load: Option<Arc<AtomicBool>>,
        last_mutation_error: Arc<Mutex<Option<&'static str>>>,
    }

    impl FakeBackend {
        fn new(document: StoredDiffCommentDocument, fail_source_after: Option<usize>) -> Self {
            Self {
                document,
                source_calls: Arc::new(AtomicUsize::new(0)),
                context_calls: Arc::new(AtomicUsize::new(0)),
                fail_source_after,
                cancel_after_first_source: false,
                advance_deadline_on_document_load: None,
                last_mutation_error: Arc::new(Mutex::new(None)),
            }
        }

        fn cancelling_after_first_source(mut self) -> Self {
            self.cancel_after_first_source = true;
            self
        }

        fn advancing_deadline_on_document_load(mut self, advanced: Arc<AtomicBool>) -> Self {
            self.advance_deadline_on_document_load = Some(advanced);
            self
        }
    }

    impl DiffCommentBackendPort for FakeBackend {
        type ResolutionContext = ();

        fn resolution_context(
            &self,
            _identity: &DiffReviewIdentity,
            _cancellation: &CancellationToken,
        ) -> Result<Self::ResolutionContext, RepositoryPortError> {
            self.context_calls.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }

        fn load_document(
            &self,
            _context: &Self::ResolutionContext,
        ) -> Result<StoredDiffCommentDocument, DiffCommentRepositoryError> {
            if let Some(advanced) = &self.advance_deadline_on_document_load {
                advanced.store(true, Ordering::SeqCst);
            }
            Ok(self.document.clone())
        }

        fn mutate_document(
            &self,
            _context: &Self::ResolutionContext,
            _expected_revision: DiffCommentRevision,
            mutation: &(dyn Fn(
                &StoredDiffCommentDocument,
                DiffCommentRevision,
            ) -> Result<StoredDiffCommentDocument, DiffCommentRepositoryError>
                  + Send
                  + Sync),
        ) -> Result<StoredMutationOutcome, DiffCommentRepositoryError> {
            match mutation(&self.document, "1".parse().unwrap()) {
                Ok(document) => Ok(StoredMutationOutcome::Committed {
                    document,
                    durability_uncertain: false,
                }),
                Err(error) => {
                    *self.last_mutation_error.lock().unwrap() = Some("failed-closed");
                    Err(error)
                }
            }
        }

        fn validate_target(
            &self,
            _context: &Self::ResolutionContext,
            _target: &DiffAnchorTarget,
        ) -> Result<(), RepositoryPortError> {
            Ok(())
        }

        fn resolve_target(
            &self,
            _context: &Self::ResolutionContext,
            target: &DiffAnchorTarget,
        ) -> Result<DiffAnchorTarget, DiffCommentResolutionError> {
            Ok(target.clone())
        }

        fn load_source(
            &self,
            _context: &Self::ResolutionContext,
            _side: DiffSide,
            _path: &RepositoryRelativePath,
            cancellation: &CancellationToken,
        ) -> Result<String, DiffCommentResolutionError> {
            let call = self.source_calls.fetch_add(1, Ordering::SeqCst);
            if self.cancel_after_first_source && call == 0 {
                cancellation.cancel();
            }
            if self.fail_source_after.is_some_and(|limit| call >= limit) {
                return Err(DiffCommentResolutionError::Unavailable(
                    RepositoryPortError::Io,
                ));
            }
            Ok("line".into())
        }
    }

    struct StepClock {
        start: Instant,
        calls: AtomicUsize,
    }

    impl ResolutionClock for StepClock {
        fn now(&self) -> Instant {
            if self.calls.fetch_add(1, Ordering::SeqCst) == 0 {
                self.start
            } else {
                self.start + RESOLUTION_TOTAL_DEADLINE + Duration::from_millis(1)
            }
        }
    }

    struct AdvancingClock {
        start: Instant,
        advanced: Arc<AtomicBool>,
    }

    impl ResolutionClock for AdvancingClock {
        fn now(&self) -> Instant {
            if self.advanced.load(Ordering::SeqCst) {
                self.start + RESOLUTION_TOTAL_DEADLINE + Duration::from_millis(1)
            } else {
                self.start
            }
        }
    }

    struct ExpiringAfterClockCalls {
        start: Instant,
        calls: AtomicUsize,
        allowed_calls: usize,
    }

    impl ResolutionClock for ExpiringAfterClockCalls {
        fn now(&self) -> Instant {
            if self.calls.fetch_add(1, Ordering::SeqCst) < self.allowed_calls {
                self.start
            } else {
                self.start + RESOLUTION_TOTAL_DEADLINE + Duration::from_millis(1)
            }
        }
    }

    #[test]
    fn precommit_retryability_is_literal_and_overflow_is_not_retryable() {
        assert!(PreCommitFailureCode::StoreBusy.retryable());
        assert!(PreCommitFailureCode::Io.retryable());
        assert!(!PreCommitFailureCode::Permission.retryable());
        assert!(!PreCommitFailureCode::RevisionOverflow.retryable());
    }

    #[test]
    fn load_obtains_one_context_and_returns_io_as_unavailable() {
        let backend = FakeBackend::new(document(), Some(0));
        let resolved = DiffCommentUseCases::new(backend.clone())
            .load(&identity(), &CancellationToken::default())
            .unwrap();
        assert_eq!(backend.context_calls.load(Ordering::SeqCst), 1);
        assert_eq!(backend.source_calls.load(Ordering::SeqCst), 1);
        assert!(matches!(
            resolved.comments[0].anchor_resolution,
            DiffAnchorResolution::Unavailable {
                reason: UnavailableReason::Io,
            }
        ));
        assert_eq!(resolved.resolution_warnings.len(), 1);
    }

    #[test]
    fn load_deadline_includes_context_and_document_acquisition() {
        let advanced = Arc::new(AtomicBool::new(false));
        let backend = FakeBackend::new(document(), None)
            .advancing_deadline_on_document_load(advanced.clone());
        let clock = Arc::new(AdvancingClock {
            start: Instant::now(),
            advanced,
        });
        let resolved = DiffCommentUseCases::with_clock(backend.clone(), clock)
            .load(&identity(), &CancellationToken::default())
            .unwrap();

        assert_eq!(backend.context_calls.load(Ordering::SeqCst), 1);
        assert_eq!(backend.source_calls.load(Ordering::SeqCst), 0);
        assert!(matches!(
            resolved.comments[0].anchor_resolution,
            DiffAnchorResolution::Unavailable {
                reason: UnavailableReason::BudgetExceeded,
            }
        ));
        assert_eq!(resolved.resolution_warnings.len(), 1);
    }

    #[test]
    fn save_fails_closed_when_occupancy_resolution_is_unavailable() {
        let backend = FakeBackend::new(document(), Some(1));
        let target = anchor(1, "line").target().clone();
        let outcome = DiffCommentUseCases::new(backend.clone())
            .save(
                &identity(),
                DiffCommentRevision::ZERO,
                target,
                "new body".into(),
                &CancellationToken::default(),
            )
            .unwrap();
        assert!(matches!(
            outcome,
            DiffCommentMutationOutcome::PreCommitFailure {
                code: PreCommitFailureCode::Io,
                current_document: None,
            }
        ));
        assert_eq!(backend.context_calls.load(Ordering::SeqCst), 1);
        assert_eq!(backend.source_calls.load(Ordering::SeqCst), 2);
        assert_eq!(
            *backend.last_mutation_error.lock().unwrap(),
            Some("failed-closed")
        );
    }

    #[test]
    fn save_fails_closed_when_occupancy_resolution_is_cancelled() {
        let backend = FakeBackend::new(document(), None).cancelling_after_first_source();
        let cancellation = CancellationToken::default();
        let outcome = DiffCommentUseCases::new(backend.clone())
            .save(
                &identity(),
                DiffCommentRevision::ZERO,
                anchor(1, "line").target().clone(),
                "new body".into(),
                &cancellation,
            )
            .unwrap();
        assert!(cancellation.is_cancelled());
        assert!(matches!(
            outcome,
            DiffCommentMutationOutcome::PreCommitFailure {
                code: PreCommitFailureCode::Io,
                current_document: None,
            }
        ));
        assert_eq!(backend.context_calls.load(Ordering::SeqCst), 1);
        assert_eq!(backend.source_calls.load(Ordering::SeqCst), 1);
        assert_eq!(
            *backend.last_mutation_error.lock().unwrap(),
            Some("failed-closed")
        );
    }

    #[test]
    fn save_fails_closed_when_occupancy_resolution_exceeds_deadline_budget() {
        let backend = FakeBackend::new(document(), None);
        let clock = Arc::new(StepClock {
            start: Instant::now(),
            calls: AtomicUsize::new(0),
        });
        let outcome = DiffCommentUseCases::with_clock(backend.clone(), clock)
            .save(
                &identity(),
                DiffCommentRevision::ZERO,
                anchor(1, "line").target().clone(),
                "new body".into(),
                &CancellationToken::default(),
            )
            .unwrap();
        assert!(matches!(
            outcome,
            DiffCommentMutationOutcome::PreCommitFailure {
                code: PreCommitFailureCode::Io,
                current_document: None,
            }
        ));
        assert_eq!(backend.context_calls.load(Ordering::SeqCst), 1);
        assert_eq!(backend.source_calls.load(Ordering::SeqCst), 1);
        assert_eq!(
            *backend.last_mutation_error.lock().unwrap(),
            Some("failed-closed")
        );
    }

    #[test]
    fn resolved_comment_still_occupies_its_runtime_location() {
        let resolved_comment = document().comments()[0].update(None, Some(true)).unwrap();
        let resolved_document = StoredDiffCommentDocument::new(
            identity().scope(),
            DiffCommentRevision::ZERO,
            vec![resolved_comment],
        )
        .unwrap();
        let backend = FakeBackend::new(resolved_document, None);
        let result = DiffCommentUseCases::new(backend).save(
            &identity(),
            DiffCommentRevision::ZERO,
            anchor(1, "line").target().clone(),
            "new body".into(),
            &CancellationToken::default(),
        );
        assert!(matches!(
            result,
            Err(DiffCommentUseCaseError::LineAlreadyCommented)
        ));
    }

    #[test]
    fn resolver_distinguishes_exact_relocated_and_ambiguous_stale() {
        let indexed = |source: &str| SourceIndex::build(source);
        assert!(matches!(
            resolve_one(&anchor(1, "target"), &indexed("target\nother")),
            DiffAnchorResolution::Exact { line, .. } if line.get() == 1
        ));
        assert!(matches!(
            resolve_one(&anchor(1, "target"), &indexed("other\ntarget")),
            DiffAnchorResolution::Relocated { line, .. } if line.get() == 2
        ));
        assert!(matches!(
            resolve_one(&anchor(1, "target"), &indexed("other\ntarget\ntarget")),
            DiffAnchorResolution::Stale {
                reason: StaleAnchorReason::AmbiguousContext,
                candidate_count: 2,
            }
        ));
    }

    #[test]
    fn refreshed_same_line_is_relocated_and_preserves_historical_side_path() {
        let old_path = RepositoryRelativePath::parse("src/old.rs").unwrap();
        let new_path = RepositoryRelativePath::parse("src/new.rs").unwrap();
        let historical = DiffAnchorTarget::new(
            DiffSide::Base,
            Some(old_path.clone()),
            Some(old_path.clone()),
            NonZeroU32::new(1).unwrap(),
        )
        .unwrap();
        let stored = DiffLineAnchor::new(
            identity(),
            historical,
            line_hash("target"),
            "target".into(),
            vec![],
            vec![],
        )
        .unwrap();
        let runtime = DiffAnchorTarget::new(
            DiffSide::Base,
            Some(old_path.clone()),
            Some(new_path.clone()),
            NonZeroU32::new(1).unwrap(),
        )
        .unwrap();
        assert!(matches!(
            resolve_one_for_target(&stored, &runtime, &SourceIndex::build("target"), false),
            DiffAnchorResolution::Relocated {
                selection_path,
                side_path,
                line,
                ..
            } if selection_path == new_path && side_path == old_path && line.get() == 1
        ));
    }

    #[test]
    fn per_side_index_supports_one_thousand_lookups_in_ten_thousand_lines() {
        let source = (0..10_000)
            .map(|line| format!("line-{line}"))
            .collect::<Vec<_>>()
            .join("\n");
        let index = SourceIndex::build(&source);
        assert_eq!(index.lines.len(), 10_000);
        assert_eq!(index.by_hash.len(), 10_000);
        for line in 1..=1_000 {
            let text = format!("line-{}", line - 1);
            assert!(matches!(
                resolve_one(&anchor(line, &text), &index),
                DiffAnchorResolution::Exact { .. }
            ));
        }
    }

    #[test]
    fn canonical_truncated_context_disambiguates_hash_candidates() {
        let repeated = "x".repeat(300);
        let source = SourceIndex::build(&format!("before-a\n{repeated}\nbefore-b\n{repeated}"));
        let selected = anchor(2, &repeated);
        let selected = DiffLineAnchor::new(
            identity(),
            selected.target().clone(),
            selected.line_hash().to_owned(),
            truncate_context(&repeated),
            vec!["before-a".into()],
            vec!["before-b".into()],
        )
        .unwrap();
        assert!(matches!(
            resolve_one(&selected, &source),
            DiffAnchorResolution::Exact { .. }
        ));
    }

    #[test]
    fn cancelled_resolution_returns_every_comment_as_unavailable() {
        let token = CancellationToken::default();
        token.cancel();
        let context = DiffCommentResolutionContext::empty(identity());
        let resolved = DiffCommentUseCases::new(FilesystemDiffCommentBackend::new(
            GitRepositoryAdapter::default(),
        ))
        .resolve(&identity(), &context, document(), &token);
        assert_eq!(resolved.comments.len(), 1);
        assert!(matches!(
            resolved.comments[0].anchor_resolution,
            DiffAnchorResolution::Unavailable {
                reason: UnavailableReason::Cancelled,
            }
        ));
    }

    #[test]
    fn monotonic_deadline_stops_before_external_load() {
        let clock = Arc::new(StepClock {
            start: Instant::now(),
            calls: AtomicUsize::new(0),
        });
        let context = DiffCommentResolutionContext::empty(identity());
        let resolved = DiffCommentUseCases::with_clock(
            FilesystemDiffCommentBackend::new(GitRepositoryAdapter::default()),
            clock,
        )
        .resolve(
            &identity(),
            &context,
            document(),
            &CancellationToken::default(),
        );
        assert!(matches!(
            resolved.comments[0].anchor_resolution,
            DiffAnchorResolution::Unavailable {
                reason: UnavailableReason::BudgetExceeded,
            }
        ));
    }

    #[test]
    fn deadline_expiring_after_source_index_build_prevents_anchor_resolution() {
        let clock = Arc::new(ExpiringAfterClockCalls {
            start: Instant::now(),
            calls: AtomicUsize::new(0),
            allowed_calls: 6,
        });
        let backend = FakeBackend::new(document(), None);
        let resolved = DiffCommentUseCases::with_clock(backend, clock)
            .load(&identity(), &CancellationToken::default())
            .unwrap();

        assert!(matches!(
            resolved.comments[0].anchor_resolution,
            DiffAnchorResolution::Unavailable {
                reason: UnavailableReason::BudgetExceeded,
            }
        ));
    }

    #[test]
    fn byte_and_line_budgets_accept_limits_and_reject_oversized_sources() {
        assert!(source_within_budget(
            0,
            0,
            MAX_LOADED_SOURCE_BYTES,
            MAX_LOADED_LOGICAL_LINES
        ));
        assert!(!source_within_budget(0, 0, MAX_LOADED_SOURCE_BYTES + 1, 1));
        assert!(!source_within_budget(0, 0, 1, MAX_LOADED_LOGICAL_LINES + 1));
        assert!(!source_within_budget(usize::MAX, 0, 1, 0));
    }
}
