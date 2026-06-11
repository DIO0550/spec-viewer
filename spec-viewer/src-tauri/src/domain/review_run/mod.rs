//! User review run domain concepts.

mod branch;
pub mod bundle;
mod errors;
mod execution_target;
mod id;
mod path;
mod run;
mod source_file;
mod status;
mod target;

pub use branch::ReviewRunBranchName;
pub use bundle::{
    ReviewRunAnchorResolutionDocument, ReviewRunAnchorResolutionTargetDocument,
    ReviewRunBundleFile, ReviewRunCommentDocument, ReviewRunResultMarkdown,
};
pub use errors::ReviewRunDomainError;
pub use execution_target::UserReviewExecutionTarget;
pub use id::UserReviewRunId;
pub use path::{ReviewRunPathValue, ReviewRunRelativePath};
pub use run::UserReviewRun;
pub use source_file::UserReviewSourceFile;
pub use status::UserReviewRunStatus;
pub use target::UserReviewRunTarget;

pub const USER_REVIEW_MANIFEST_SCHEMA_VERSION: &str = "spec-reviewer.review-run.v1";
