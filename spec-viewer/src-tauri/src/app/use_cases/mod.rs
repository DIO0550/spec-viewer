//! Use cases that coordinate domain logic and infrastructure.

mod app;
pub mod comments;
mod error;
mod ports;
mod results;
pub mod review_runs;

pub use crate::domain::comment::{AnchorResolutionReason, AnchorResolutionStatus};
pub use app::{AppUseCases, FilesystemAppUseCases};
pub use comments::{
    CommentAnchorResolution, CommentAnchorResolutionTarget, CommentUseCases, ExportCommentsError,
    ExportCommentsInput, ExportCommentsResult, FilesystemCommentUseCases, GenerateCommentId,
    GenerateLlmPromptInput, GetCurrentTime, ResolveCommentAnchorsResult, UtcCommentClock,
    UuidCommentIdGenerator,
};
pub use error::AppUseCaseError;
pub use ports::{DetectWorkspace, LoadWorkspaceConfig, ReadSpecFile, ScanSpecTree};
pub use results::{
    AppMarkdownDocument, AppMissingMarkdownFile, ArchiveSpecResult, ListSpecsResult,
    LoadWorkspaceResult, ReadSpecFileResult,
};
pub use review_runs::{
    ArchiveReviewRunInput, ArchiveReviewRunResult, CreateReviewRunInput, CreateReviewRunResult,
    ListReviewRunsInput, ListReviewRunsResult, ListedReviewRun, ReviewRunExecutionMode,
    ReviewRunListProblem, ReviewRunListProblemState,
};
