//! Domain-facing persistence contract for repository Diff comments.

use thiserror::Error;

use super::diff::{
    CancellationToken, DiffAnchorTarget, DiffCommentRevision, DiffReviewIdentity, DiffSide,
    StaleAnchorReason, StoredDiffCommentDocument,
};
use crate::domain::repository::{RepositoryPortError, RepositoryRelativePath};

#[derive(Debug, Error)]
pub enum DiffCommentRepositoryError {
    #[error("Diff comment store is busy")]
    StoreBusy,
    #[error("Diff comment store permission denied")]
    Permission,
    #[error("invalid Diff comment store")]
    InvalidStore,
    #[error("Diff comment store I/O failed")]
    Io,
    #[error("line already has a comment")]
    LineAlreadyCommented,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StoredMutationOutcome {
    Committed {
        document: StoredDiffCommentDocument,
        durability_uncertain: bool,
    },
    Conflict {
        latest_document: StoredDiffCommentDocument,
    },
    RevisionOverflow {
        current_document: StoredDiffCommentDocument,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DiffCommentResolutionError {
    Stale {
        reason: StaleAnchorReason,
        candidate_count: u32,
    },
    Unavailable(RepositoryPortError),
}

pub trait DiffCommentRepository: Send + Sync {
    fn load(
        &self,
        identity: &DiffReviewIdentity,
    ) -> Result<StoredDiffCommentDocument, DiffCommentRepositoryError>;

    fn mutate(
        &self,
        identity: &DiffReviewIdentity,
        expected_revision: DiffCommentRevision,
        mutation: &(dyn Fn(
            &StoredDiffCommentDocument,
            DiffCommentRevision,
        ) -> Result<StoredDiffCommentDocument, DiffCommentRepositoryError>
              + Send
              + Sync),
    ) -> Result<StoredMutationOutcome, DiffCommentRepositoryError>;
}

/// Application-facing port combining the snapshot-bound source and persistent store.
pub trait DiffCommentBackendPort: Clone + Send + Sync + 'static {
    type ResolutionContext: Clone + Send + Sync;

    fn resolution_context(
        &self,
        identity: &DiffReviewIdentity,
        cancellation: &CancellationToken,
    ) -> Result<Self::ResolutionContext, RepositoryPortError>;
    fn load_document(
        &self,
        context: &Self::ResolutionContext,
    ) -> Result<StoredDiffCommentDocument, DiffCommentRepositoryError>;
    fn mutate_document(
        &self,
        context: &Self::ResolutionContext,
        expected_revision: DiffCommentRevision,
        mutation: &(dyn Fn(
            &StoredDiffCommentDocument,
            DiffCommentRevision,
        ) -> Result<StoredDiffCommentDocument, DiffCommentRepositoryError>
              + Send
              + Sync),
    ) -> Result<StoredMutationOutcome, DiffCommentRepositoryError>;
    fn validate_target(
        &self,
        context: &Self::ResolutionContext,
        target: &DiffAnchorTarget,
    ) -> Result<(), RepositoryPortError>;
    fn resolve_target(
        &self,
        context: &Self::ResolutionContext,
        target: &DiffAnchorTarget,
    ) -> Result<DiffAnchorTarget, DiffCommentResolutionError>;
    fn load_source(
        &self,
        context: &Self::ResolutionContext,
        side: DiffSide,
        path: &RepositoryRelativePath,
        cancellation: &CancellationToken,
    ) -> Result<String, DiffCommentResolutionError>;
}
