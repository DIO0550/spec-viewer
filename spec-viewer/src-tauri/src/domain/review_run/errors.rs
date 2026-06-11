//! Review run domain errors.

use thiserror::Error;

use crate::domain::review_run::UserReviewRunStatus;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ReviewRunDomainError {
    #[error("review run id is required")]
    MissingReviewRunId,
    #[error("review run id is invalid: {id}")]
    InvalidReviewRunId { id: String },
    #[error("review run status is unsupported: {status}")]
    UnsupportedStatus { status: String },
    #[error("review run path is invalid: {path}")]
    InvalidPathValue { path: String },
    #[error("review run branch name is invalid: {branch_name}")]
    InvalidBranchName { branch_name: String },
    #[error("review run relative path is invalid: {path}")]
    InvalidRelativePath { path: String },
    #[error("source file is outside workspace: {path}")]
    SourceFileOutsideWorkspace { path: String },
    #[error("review run requires at least one source file")]
    MissingSourceFiles,
    #[error("review run requires at least one comment id")]
    MissingCommentIds,
    #[error("archived review run requires archived timestamp")]
    MissingArchivedAt,
    #[error("review run archived timestamp cannot be before created timestamp")]
    ArchivedBeforeCreated,
    #[error("review run status cannot transition from {current} to {next}")]
    InvalidStatusTransition {
        current: UserReviewRunStatus,
        next: UserReviewRunStatus,
    },
}
