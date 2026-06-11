//! Review run use cases that export user comments into filesystem bundles.

mod archive;
mod create;
mod inputs;
mod list;
mod outputs;
#[cfg(test)]
pub(crate) mod test_support;

pub use inputs::{
    ArchiveReviewRunInput, CreateReviewRunInput, ListReviewRunsInput, ReviewRunExecutionMode,
};
pub use outputs::{
    ArchiveReviewRunResult, CreateReviewRunResult, ListReviewRunsResult, ListedReviewRun,
    ReviewRunListProblem, ReviewRunListProblemState,
};

use crate::{
    app::use_cases::AppUseCaseError,
    infrastructure::git::GitReviewWorktreeError,
    infrastructure::persistence::{
        review_run_reader::ReviewRunReadError, review_run_schema::ReviewRunManifestRestoreError,
        review_run_writer::ReviewRunArchiveError,
    },
};

impl From<crate::domain::review_run::ReviewRunDomainError> for AppUseCaseError {
    fn from(source: crate::domain::review_run::ReviewRunDomainError) -> Self {
        Self::ReviewRunExport {
            message: source.to_string(),
        }
    }
}

impl From<crate::infrastructure::persistence::review_run_paths::ReviewRunPathError>
    for AppUseCaseError
{
    fn from(
        source: crate::infrastructure::persistence::review_run_paths::ReviewRunPathError,
    ) -> Self {
        Self::ReviewRunExport {
            message: source.to_string(),
        }
    }
}

impl From<crate::infrastructure::persistence::review_run_writer::ReviewRunBundleWriteError>
    for AppUseCaseError
{
    fn from(
        source: crate::infrastructure::persistence::review_run_writer::ReviewRunBundleWriteError,
    ) -> Self {
        Self::ReviewRunExport {
            message: source.to_string(),
        }
    }
}

impl From<GitReviewWorktreeError> for AppUseCaseError {
    fn from(source: GitReviewWorktreeError) -> Self {
        Self::ReviewRunExport {
            message: source.message(),
        }
    }
}

impl From<ReviewRunManifestRestoreError> for AppUseCaseError {
    fn from(source: ReviewRunManifestRestoreError) -> Self {
        match source {
            ReviewRunManifestRestoreError::ReviewRun(error) => Self::from(error),
            ReviewRunManifestRestoreError::Spec(error) => Self::from(error),
            ReviewRunManifestRestoreError::Comment(error) => Self::from(error),
        }
    }
}

impl From<ReviewRunReadError> for AppUseCaseError {
    fn from(source: ReviewRunReadError) -> Self {
        match source {
            ReviewRunReadError::Storage { message } => Self::ReviewRunExport { message },
            ReviewRunReadError::SpecPath(error) => Self::from(error),
            ReviewRunReadError::Restore(error) => Self::from(error),
        }
    }
}

impl From<ReviewRunArchiveError> for AppUseCaseError {
    fn from(source: ReviewRunArchiveError) -> Self {
        Self::ReviewRunExport {
            message: source.to_string(),
        }
    }
}
