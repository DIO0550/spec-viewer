//! Git worktree listing command DTOs and handlers.

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app::use_cases::worktrees::{ListWorkspaceWorktreesResult, ListedWorktree},
    domain::repository::RepositoryPortError,
};

use super::CommandState;

pub type ListWorktreesCommandResult<T> = Result<T, WorktreesCommandError>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreesCommandError {
    code: WorktreesCommandErrorCode,
    message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WorktreesCommandErrorCode {
    InvalidRequest,
    NotRepository,
    GitUnavailable,
    GitTimedOut,
    GitOutputLimitExceeded,
    GitFailed,
    UnsupportedPathEncoding,
    Io,
    Unexpected,
}

impl WorktreesCommandError {
    fn new(code: WorktreesCommandErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    fn invalid_request(message: impl Into<String>) -> Self {
        Self::new(WorktreesCommandErrorCode::InvalidRequest, message)
    }

    fn from_repository_error(error: RepositoryPortError) -> Self {
        let code = match &error {
            RepositoryPortError::NotRepository
            | RepositoryPortError::BareRepository
            | RepositoryPortError::WorktreeUnavailable
            | RepositoryPortError::IdentityMismatch
            | RepositoryPortError::CommonDirBoundaryEscape => {
                WorktreesCommandErrorCode::NotRepository
            }
            RepositoryPortError::GitUnavailable => WorktreesCommandErrorCode::GitUnavailable,
            RepositoryPortError::GitTimedOut { .. } => WorktreesCommandErrorCode::GitTimedOut,
            RepositoryPortError::GitOutputLimitExceeded { .. } => {
                WorktreesCommandErrorCode::GitOutputLimitExceeded
            }
            RepositoryPortError::GitFailed { .. }
            | RepositoryPortError::UnsupportedDiffStatus { .. } => {
                WorktreesCommandErrorCode::GitFailed
            }
            RepositoryPortError::UnsupportedPathEncoding => {
                WorktreesCommandErrorCode::UnsupportedPathEncoding
            }
            RepositoryPortError::Io => WorktreesCommandErrorCode::Io,
            RepositoryPortError::InvalidRepositoryPath => WorktreesCommandErrorCode::InvalidRequest,
            RepositoryPortError::UnbornHead
            | RepositoryPortError::HeadChangedDuringRead
            | RepositoryPortError::RevisionNotFound
            | RepositoryPortError::RevisionNotCommit
            | RepositoryPortError::InvalidHistoryOutput
            | RepositoryPortError::StaleBase
            | RepositoryPortError::StaleSnapshot
            | RepositoryPortError::StaleCursor
            | RepositoryPortError::InvalidCursor
            | RepositoryPortError::EntryChangedDuringRead
            | RepositoryPortError::Cancelled
            | RepositoryPortError::ContentTooLarge
            | RepositoryPortError::PermissionDenied => WorktreesCommandErrorCode::Unexpected,
        };

        Self::new(code, error.to_string())
    }
}

impl From<RepositoryPortError> for WorktreesCommandError {
    fn from(error: RepositoryPortError) -> Self {
        Self::from_repository_error(error)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListWorktreesRequest {
    workspace_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListWorktreesResponse {
    workspace_id: String,
    worktrees: Vec<WorktreeResponse>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeResponse {
    id: String,
    name: String,
    category_path: Vec<String>,
}

#[tauri::command]
pub fn list_worktrees(
    state: State<'_, CommandState>,
    request: ListWorktreesRequest,
) -> ListWorktreesCommandResult<ListWorktreesResponse> {
    if request.workspace_path.trim().is_empty() {
        return Err(WorktreesCommandError::invalid_request(
            "workspace path is required",
        ));
    }

    state
        .worktree_use_cases()
        .list(&request.workspace_path)
        .map(ListWorktreesResponse::from)
        .map_err(Into::into)
}

impl From<ListWorkspaceWorktreesResult> for ListWorktreesResponse {
    fn from(result: ListWorkspaceWorktreesResult) -> Self {
        Self {
            workspace_id: result.workspace_id().to_owned(),
            worktrees: result
                .worktrees()
                .iter()
                .map(WorktreeResponse::from)
                .collect(),
        }
    }
}

impl From<&ListedWorktree> for WorktreeResponse {
    fn from(worktree: &ListedWorktree) -> Self {
        Self {
            id: worktree.id().as_str().to_owned(),
            name: worktree.name().to_owned(),
            category_path: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn worktree_response_serializes_frontend_shape() {
        let response = WorktreeResponse {
            id: "/workspace/review".to_owned(),
            name: "feature/review".to_owned(),
            category_path: Vec::new(),
        };

        let value = serde_json::to_value(response).expect("response should serialize");

        assert_eq!("/workspace/review", value["id"]);
        assert_eq!("feature/review", value["name"]);
        assert_eq!(serde_json::json!([]), value["categoryPath"]);
    }

    #[test]
    fn worktrees_command_error_serializes_git_failure_code() {
        let error = WorktreesCommandError::from_repository_error(RepositoryPortError::GitFailed {
            operation: "worktree-list".to_owned(),
            code: Some(128),
            stderr: "not a repository".to_owned(),
        });

        let value = serde_json::to_value(error).expect("error should serialize");

        assert_eq!("gitFailed", value["code"]);
    }
}
