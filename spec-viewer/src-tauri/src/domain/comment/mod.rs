//! Comment domain concepts.

mod anchor;
mod anchor_resolution;
mod body;
mod entity;
mod errors;
mod export;
mod exported_comment;
mod fuzzy;
mod id;
mod llm_prompt;
mod repository;
mod resolution_status;
mod status;
mod thread;

pub use anchor::{BlockIndex, BlockType, CharRange, CommentAnchor, TextHash, TextSnippet};
pub use anchor_resolution::{CommentAnchorResolution, CommentAnchorResolutionTarget};
pub use body::CommentBody;
pub use entity::Comment;
pub use errors::CommentDomainError;
pub use export::{
    CommentExport, CommentExportFile, CommentExportFormat, CommentExportRenderError,
    CommentExportTarget,
};
pub use exported_comment::ExportedComment;
pub use id::CommentId;
pub use llm_prompt::{LlmPrompt, LlmPromptFile};
pub use repository::{
    CommentListQuery, CommentRepository, CommentRepositoryError, CommentScope, CommentStatusFilter,
};
pub use resolution_status::{AnchorResolutionReason, AnchorResolutionStatus};
pub use status::CommentStatus;
pub use thread::CommentThread;
