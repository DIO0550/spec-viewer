//! Review run command DTOs and handlers.

use std::str::FromStr;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app::use_cases::{
        AppUseCaseError, CreateReviewRunInput, ListReviewRunsInput, ReviewRunExecutionMode,
    },
    domain::{
        comment::CommentId,
        review_run::{
            UserReviewExecutionTarget, UserReviewRun, UserReviewRunTarget, UserReviewSourceFile,
        },
        spec::{SpecFileKey, SpecId},
    },
};

use super::{CommandError, CommandResult, CommandState};

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateReviewRunRequest {
    workspace_path: String,
    target: ReviewRunTargetRequest,
    comment_ids: Vec<String>,
    execution_mode: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(
    tag = "scope",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ReviewRunTargetRequest {
    File { spec_id: String, file_key: String },
    Spec { spec_id: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateReviewRunResponse {
    review_run: ReviewRunResponse,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListReviewRunsRequest {
    workspace_path: String,
    target: ReviewRunTargetRequest,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListReviewRunsResponse {
    active: Vec<ReviewRunResponse>,
    archived: Vec<ReviewRunResponse>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRunResponse {
    id: String,
    status: String,
    target: ReviewRunTargetResponse,
    execution_target: ReviewRunExecutionTargetResponse,
    spec_folder_path: String,
    folder_path: String,
    source_files: Vec<ReviewRunSourceFileResponse>,
    comment_count: usize,
    created_at: DateTime<Utc>,
    archived_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRunSourceFileResponse {
    spec_id: String,
    file_key: String,
    relative_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "scope",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ReviewRunTargetResponse {
    File { spec_id: String, file_key: String },
    Spec { spec_id: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "mode",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ReviewRunExecutionTargetResponse {
    CurrentWorkspace {
        workspace_path: String,
    },
    Worktree {
        repository_path: String,
        worktree_path: String,
        branch_name: String,
    },
}

#[tauri::command]
pub fn create_review_run(
    state: State<'_, CommandState>,
    request: CreateReviewRunRequest,
) -> CommandResult<CreateReviewRunResponse> {
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let input = CreateReviewRunInput::new(
        request.target.into_domain()?,
        parse_comment_ids(&request.comment_ids)?,
        parse_execution_mode(&request.execution_mode)?,
    );
    let result = state.use_cases().create_review_run(&workspace, input)?;

    Ok(CreateReviewRunResponse {
        review_run: ReviewRunResponse::from_run(result.review_run(), result.folder_path()),
    })
}

#[tauri::command]
pub fn list_review_runs(
    state: State<'_, CommandState>,
    request: ListReviewRunsRequest,
) -> CommandResult<ListReviewRunsResponse> {
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let result = state.use_cases().list_review_runs(
        &workspace,
        ListReviewRunsInput::new(request.target.into_domain()?),
    )?;

    Ok(ListReviewRunsResponse {
        active: result
            .active()
            .iter()
            .map(|run| ReviewRunResponse::from_run(run.review_run(), run.folder_path()))
            .collect(),
        archived: result
            .archived()
            .iter()
            .map(|run| ReviewRunResponse::from_run(run.review_run(), run.folder_path()))
            .collect(),
    })
}

impl ReviewRunTargetRequest {
    fn into_domain(self) -> CommandResult<UserReviewRunTarget> {
        match self {
            Self::File { spec_id, file_key } => Ok(UserReviewRunTarget::file(
                SpecId::new(spec_id).map_err(invalid_spec)?,
                SpecFileKey::from_str(&file_key).map_err(invalid_spec)?,
            )),
            Self::Spec { spec_id } => Ok(UserReviewRunTarget::spec(
                SpecId::new(spec_id).map_err(invalid_spec)?,
            )),
        }
    }
}

impl ReviewRunResponse {
    fn from_run(run: &UserReviewRun, folder_path: &str) -> Self {
        Self {
            id: run.id().as_str().to_string(),
            status: run.status().as_str().to_string(),
            target: ReviewRunTargetResponse::from_target(run.target()),
            execution_target: ReviewRunExecutionTargetResponse::from_execution_target(
                run.execution_target(),
            ),
            spec_folder_path: run.spec_folder_path().as_str().to_string(),
            folder_path: folder_path.to_string(),
            source_files: run
                .source_files()
                .iter()
                .map(ReviewRunSourceFileResponse::from_source_file)
                .collect(),
            comment_count: run.comment_ids().len(),
            created_at: run.created_at(),
            archived_at: run.archived_at(),
        }
    }
}

impl ReviewRunTargetResponse {
    fn from_target(target: &UserReviewRunTarget) -> Self {
        match target {
            UserReviewRunTarget::File { spec_id, file_key } => Self::File {
                spec_id: spec_id.as_str().to_string(),
                file_key: file_key.as_str().to_string(),
            },
            UserReviewRunTarget::Spec { spec_id } => Self::Spec {
                spec_id: spec_id.as_str().to_string(),
            },
        }
    }
}

impl ReviewRunExecutionTargetResponse {
    fn from_execution_target(target: &UserReviewExecutionTarget) -> Self {
        match target {
            UserReviewExecutionTarget::CurrentWorkspace { workspace_path } => {
                Self::CurrentWorkspace {
                    workspace_path: workspace_path.as_str().to_string(),
                }
            }
            UserReviewExecutionTarget::Worktree {
                repository_path,
                worktree_path,
                branch_name,
            } => Self::Worktree {
                repository_path: repository_path.as_str().to_string(),
                worktree_path: worktree_path.as_str().to_string(),
                branch_name: branch_name.as_str().to_string(),
            },
        }
    }
}

impl ReviewRunSourceFileResponse {
    fn from_source_file(source_file: &UserReviewSourceFile) -> Self {
        Self {
            spec_id: source_file.spec_id().as_str().to_string(),
            file_key: source_file.file_key().as_str().to_string(),
            relative_path: source_file.relative_path().as_str().to_string(),
        }
    }
}

fn parse_comment_ids(values: &[String]) -> CommandResult<Vec<CommentId>> {
    values
        .iter()
        .map(|value| CommentId::new(value).map_err(invalid_comment))
        .collect()
}

fn parse_execution_mode(value: &str) -> CommandResult<ReviewRunExecutionMode> {
    match value {
        "currentWorkspace" => Ok(ReviewRunExecutionMode::CurrentWorkspace),
        "worktree" => Ok(ReviewRunExecutionMode::Worktree),
        _ => Err(CommandError::invalid_request(format!(
            "unsupported review run execution mode: {value}"
        ))),
    }
}

fn invalid_spec(error: crate::domain::spec::SpecDomainError) -> CommandError {
    CommandError::from(AppUseCaseError::from(error))
}

fn invalid_comment(error: crate::domain::comment::CommentDomainError) -> CommandError {
    CommandError::from(AppUseCaseError::from(error))
}
