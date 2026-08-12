//! Concrete composition of the domain Diff comment backend port.

use crate::{
    domain::{
        comment::{
            diff::{
                CancellationToken, DiffAnchorTarget, DiffCommentRevision, DiffReviewIdentity,
                DiffSide, StaleAnchorReason, StoredDiffCommentDocument,
            },
            diff_repository::{
                DiffCommentBackendPort, DiffCommentRepository, DiffCommentRepositoryError,
                DiffCommentResolutionError, StoredMutationOutcome,
            },
        },
        repository::{RepositoryPortError, RepositoryRelativePath},
    },
    infrastructure::git::{DiffCommentResolutionContext, GitRepositoryAdapter},
};

use super::diff_comment_store::FilesystemDiffCommentStore;

#[derive(Debug, Clone)]
pub struct FilesystemDiffCommentBackend {
    git: GitRepositoryAdapter,
}

impl FilesystemDiffCommentBackend {
    pub fn new(git: GitRepositoryAdapter) -> Self {
        Self { git }
    }
    fn store(context: &DiffCommentResolutionContext) -> FilesystemDiffCommentStore {
        FilesystemDiffCommentStore::new(context.common_dir().to_path_buf())
    }
}

fn map_source_error(error: RepositoryPortError) -> DiffCommentResolutionError {
    match error {
        RepositoryPortError::ContentTooLarge
        | RepositoryPortError::GitOutputLimitExceeded { .. } => DiffCommentResolutionError::Stale {
            reason: StaleAnchorReason::Unsupported,
            candidate_count: 0,
        },
        RepositoryPortError::InvalidRepositoryPath => DiffCommentResolutionError::Stale {
            reason: StaleAnchorReason::PathMissing,
            candidate_count: 0,
        },
        other => DiffCommentResolutionError::Unavailable(other),
    }
}

impl DiffCommentBackendPort for FilesystemDiffCommentBackend {
    type ResolutionContext = DiffCommentResolutionContext;

    fn resolution_context(
        &self,
        identity: &DiffReviewIdentity,
        cancellation: &CancellationToken,
    ) -> Result<Self::ResolutionContext, RepositoryPortError> {
        if cancellation.is_cancelled() {
            return Err(RepositoryPortError::Cancelled);
        }
        let context = self.git.diff_comment_resolution_context(identity)?;
        if cancellation.is_cancelled() {
            return Err(RepositoryPortError::Cancelled);
        }
        Ok(context)
    }
    fn load_document(
        &self,
        context: &Self::ResolutionContext,
    ) -> Result<StoredDiffCommentDocument, DiffCommentRepositoryError> {
        Self::store(context).load(context.identity())
    }
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
    ) -> Result<StoredMutationOutcome, DiffCommentRepositoryError> {
        Self::store(context).mutate(context.identity(), expected_revision, mutation)
    }
    fn validate_target(
        &self,
        context: &Self::ResolutionContext,
        target: &DiffAnchorTarget,
    ) -> Result<(), RepositoryPortError> {
        self.git.validate_diff_comment_target(context, target)
    }
    fn resolve_target(
        &self,
        context: &Self::ResolutionContext,
        target: &DiffAnchorTarget,
    ) -> Result<DiffAnchorTarget, DiffCommentResolutionError> {
        self.git.resolve_diff_comment_target(context, target)
    }
    fn load_source(
        &self,
        context: &Self::ResolutionContext,
        side: DiffSide,
        path: &RepositoryRelativePath,
        cancellation: &CancellationToken,
    ) -> Result<String, DiffCommentResolutionError> {
        if cancellation.is_cancelled() {
            return Err(DiffCommentResolutionError::Unavailable(
                RepositoryPortError::Cancelled,
            ));
        }
        let source = self
            .git
            .load_diff_comment_source(context, side, path)
            .map_err(map_source_error)?;
        if cancellation.is_cancelled() {
            return Err(DiffCommentResolutionError::Unavailable(
                RepositoryPortError::Cancelled,
            ));
        }
        Ok(source)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn oversized_current_and_base_sources_are_semantic_unsupported() {
        for error in [
            RepositoryPortError::ContentTooLarge,
            RepositoryPortError::GitOutputLimitExceeded {
                stream: "stdout".into(),
            },
        ] {
            assert_eq!(
                map_source_error(error),
                DiffCommentResolutionError::Stale {
                    reason: StaleAnchorReason::Unsupported,
                    candidate_count: 0,
                }
            );
        }
    }

    #[test]
    fn operational_source_errors_remain_unavailable() {
        assert_eq!(
            map_source_error(RepositoryPortError::PermissionDenied),
            DiffCommentResolutionError::Unavailable(RepositoryPortError::PermissionDenied)
        );
    }
}
