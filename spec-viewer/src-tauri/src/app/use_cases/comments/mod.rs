//! Comment use cases that orchestrate repository operations.

mod crud;
mod export;
mod llm_prompt;
mod resolve_anchors;
#[cfg(test)]
pub(crate) mod test_support;

pub use crate::domain::comment::{CommentAnchorResolution, CommentAnchorResolutionTarget};
pub use export::{ExportCommentsError, ExportCommentsInput, ExportCommentsResult};
pub use llm_prompt::GenerateLlmPromptInput;
pub use resolve_anchors::ResolveCommentAnchorsResult;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::{
    app::use_cases::{AppUseCaseError, LoadWorkspaceResult},
    domain::comment::CommentId,
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
