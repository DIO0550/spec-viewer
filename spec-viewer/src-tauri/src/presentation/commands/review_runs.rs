//! Review run command DTOs and handlers.

use std::str::FromStr;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app::services::performance::{emit_span, start_span, PerformanceContext},
    app::use_cases::{
        AppUseCaseError, ArchiveReviewRunInput, CreateReviewRunInput, ListReviewRunsInput,
        ReviewRunExecutionMode, ReviewRunListProblem, ReviewRunListProblemState,
    },
    domain::{
        comment::CommentId,
        review_run::{
            UserReviewExecutionTarget, UserReviewRun, UserReviewRunId, UserReviewRunTarget,
            UserReviewSourceFile,
        },
        spec::{SpecFileKey, SpecId},
    },
};

use super::{CommandError, CommandResult, CommandState};

pub type CreateUserReviewCommandResult<T> = Result<T, ReviewRunCommandError>;
pub type ListUserReviewsCommandResult<T> = Result<T, ReviewRunCommandError>;
pub type ArchiveUserReviewCommandResult<T> = Result<T, ReviewRunCommandError>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRunCommandError {
    code: ReviewRunCommandErrorCode,
    message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ReviewRunCommandErrorCode {
    InvalidRequest,
    WorkspaceDetection,
    ConfigLoad,
    InvalidSpec,
    InvalidComment,
    CommentRepository,
    UserReviewExport,
    Unexpected,
}

impl ReviewRunCommandError {
    fn new(code: ReviewRunCommandErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    fn from_app_error(error: AppUseCaseError) -> Self {
        let code = match error {
            AppUseCaseError::WorkspaceDetection { .. } => {
                ReviewRunCommandErrorCode::WorkspaceDetection
            }
            AppUseCaseError::ConfigLoad { .. } => ReviewRunCommandErrorCode::ConfigLoad,
            AppUseCaseError::InvalidSpec { .. } => ReviewRunCommandErrorCode::InvalidSpec,
            AppUseCaseError::InvalidComment { .. } => ReviewRunCommandErrorCode::InvalidComment,
            AppUseCaseError::CommentRepository { .. } => {
                ReviewRunCommandErrorCode::CommentRepository
            }
            AppUseCaseError::ReviewRunExport { .. } => ReviewRunCommandErrorCode::UserReviewExport,
            AppUseCaseError::UserReview { .. } => ReviewRunCommandErrorCode::UserReviewExport,
            AppUseCaseError::SpecTreeScan { .. }
            | AppUseCaseError::SpecArchive { .. }
            | AppUseCaseError::MarkdownRead { .. } => ReviewRunCommandErrorCode::Unexpected,
        };

        Self::new(code, error.to_string())
    }

    fn from_command_error(error: CommandError) -> Self {
        let code = match error.code() {
            "invalidRequest" => ReviewRunCommandErrorCode::InvalidRequest,
            "workspaceDetection" => ReviewRunCommandErrorCode::WorkspaceDetection,
            "configLoad" => ReviewRunCommandErrorCode::ConfigLoad,
            "invalidSpec" => ReviewRunCommandErrorCode::InvalidSpec,
            "invalidComment" => ReviewRunCommandErrorCode::InvalidComment,
            "commentRepository" => ReviewRunCommandErrorCode::CommentRepository,
            "userReviewExport" => ReviewRunCommandErrorCode::UserReviewExport,
            _ => ReviewRunCommandErrorCode::Unexpected,
        };

        Self::new(code, error.message())
    }
}

impl From<AppUseCaseError> for ReviewRunCommandError {
    fn from(error: AppUseCaseError) -> Self {
        Self::from_app_error(error)
    }
}

impl From<CommandError> for ReviewRunCommandError {
    fn from(error: CommandError) -> Self {
        Self::from_command_error(error)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUserReviewRequest {
    workspace_path: String,
    target: UserReviewTargetRequest,
    comment_ids: Vec<String>,
    workspace_mode: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(
    tag = "scope",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum UserReviewTargetRequest {
    File { spec_id: String, file_key: String },
    Spec { spec_id: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUserReviewResponse {
    user_review: UserReviewResponse,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListUserReviewsRequest {
    workspace_path: String,
    target: UserReviewTargetRequest,
    correlation_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListUserReviewsResponse {
    active: Vec<UserReviewResponse>,
    archived: Vec<UserReviewResponse>,
    problems: Vec<UserReviewListProblemResponse>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveUserReviewRequest {
    workspace_path: String,
    target: UserReviewTargetRequest,
    user_review_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveUserReviewResponse {
    user_review: UserReviewResponse,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserReviewResponse {
    id: String,
    status: String,
    target: UserReviewTargetResponse,
    workspace: UserReviewWorkspaceResponse,
    spec_folder_path: String,
    folder_path: String,
    source_files: Vec<ReviewSourceFileResponse>,
    comment_count: usize,
    created_at: DateTime<Utc>,
    archived_at: Option<DateTime<Utc>>,
    summary: Option<String>,
    warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserReviewListProblemResponse {
    folder_path: String,
    state: String,
    message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewSourceFileResponse {
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
pub enum UserReviewTargetResponse {
    File { spec_id: String, file_key: String },
    Spec { spec_id: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "mode",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum UserReviewWorkspaceResponse {
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
pub fn create_user_review(
    state: State<'_, CommandState>,
    request: CreateUserReviewRequest,
) -> CreateUserReviewCommandResult<CreateUserReviewResponse> {
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let input = CreateReviewRunInput::new(
        request.target.into_domain()?,
        parse_comment_ids(&request.comment_ids)?,
        parse_workspace_mode(&request.workspace_mode)?,
    );
    let result = state.use_cases().create_review_run(&workspace, input)?;

    Ok(CreateUserReviewResponse {
        user_review: UserReviewResponse::from_run(
            result.review_run(),
            result.folder_path(),
            None,
            Vec::new(),
        ),
    })
}

#[tauri::command]
pub fn list_user_reviews(
    state: State<'_, CommandState>,
    request: ListUserReviewsRequest,
) -> ListUserReviewsCommandResult<ListUserReviewsResponse> {
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let performance_context = request
        .correlation_id
        .as_ref()
        .map(|correlation_id| PerformanceContext::new(correlation_id, "list_user_reviews"));
    // Rust span measures command-internal workspace load, use case, and DTO conversion.
    let end_span = performance_context
        .as_ref()
        .map(|context| start_span(context, "command.list_user_reviews"));
    let result = (|| {
        let target = request.target.into_domain()?;
        let result = state
            .use_cases()
            .list_review_runs(&workspace, ListReviewRunsInput::new(target))?;

        Ok::<_, CommandError>(result)
    })();
    if let (Some(context), Some(end_span)) = (performance_context.as_ref(), end_span) {
        let mut metadata = std::collections::BTreeMap::new();
        match &result {
            Ok(result) => {
                metadata.insert("active_count", result.active().len().to_string());
                metadata.insert("archived_count", result.archived().len().to_string());
                metadata.insert("problem_count", result.problems().len().to_string());
            }
            Err(error) => {
                metadata.insert("error", "true".to_string());
                metadata.insert("error_code", error.code().to_string());
            }
        }
        emit_span(context, end_span(metadata));
    }

    let result = result?;
    Ok(ListUserReviewsResponse {
        active: result
            .active()
            .iter()
            .map(UserReviewResponse::from_listed)
            .collect(),
        archived: result
            .archived()
            .iter()
            .map(UserReviewResponse::from_listed)
            .collect(),
        problems: result
            .problems()
            .iter()
            .map(UserReviewListProblemResponse::from_problem)
            .collect(),
    })
}

#[tauri::command]
pub fn archive_user_review(
    state: State<'_, CommandState>,
    request: ArchiveUserReviewRequest,
) -> ArchiveUserReviewCommandResult<ArchiveUserReviewResponse> {
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let input = ArchiveReviewRunInput::new(
        request.target.into_domain()?,
        UserReviewRunId::new(request.user_review_id).map_err(invalid_review_run)?,
    );
    let result = state.use_cases().archive_review_run(&workspace, input)?;

    Ok(ArchiveUserReviewResponse {
        user_review: UserReviewResponse::from_run(
            result.review_run(),
            result.folder_path(),
            result.summary().map(str::to_string),
            result.warnings().to_vec(),
        ),
    })
}

impl UserReviewTargetRequest {
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

impl UserReviewResponse {
    fn from_run(
        run: &UserReviewRun,
        folder_path: &str,
        summary: Option<String>,
        warnings: Vec<String>,
    ) -> Self {
        Self {
            id: run.id().as_str().to_string(),
            status: run.status().as_str().to_string(),
            target: UserReviewTargetResponse::from_target(run.target()),
            workspace: UserReviewWorkspaceResponse::from_workspace(run.execution_target()),
            spec_folder_path: run.spec_folder_path().as_str().to_string(),
            folder_path: folder_path.to_string(),
            source_files: run
                .source_files()
                .iter()
                .map(ReviewSourceFileResponse::from_source_file)
                .collect(),
            comment_count: run.comment_ids().len(),
            created_at: run.created_at(),
            archived_at: run.archived_at(),
            summary,
            warnings,
        }
    }

    fn from_listed(run: &crate::app::use_cases::ListedReviewRun) -> Self {
        Self::from_run(
            run.review_run(),
            run.folder_path(),
            run.summary().map(str::to_string),
            run.warnings().to_vec(),
        )
    }
}

impl UserReviewTargetResponse {
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

impl UserReviewWorkspaceResponse {
    fn from_workspace(target: &UserReviewExecutionTarget) -> Self {
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

impl ReviewSourceFileResponse {
    fn from_source_file(source_file: &UserReviewSourceFile) -> Self {
        Self {
            spec_id: source_file.spec_id().as_str().to_string(),
            file_key: source_file.file_key().as_str().to_string(),
            relative_path: source_file.relative_path().as_str().to_string(),
        }
    }
}

impl UserReviewListProblemResponse {
    fn from_problem(problem: &ReviewRunListProblem) -> Self {
        Self {
            folder_path: problem.folder_path().to_string(),
            state: format_problem_state(problem.state()).to_string(),
            message: problem.message().to_string(),
        }
    }
}

fn parse_comment_ids(values: &[String]) -> CommandResult<Vec<CommentId>> {
    values
        .iter()
        .map(|value| CommentId::new(value).map_err(invalid_comment))
        .collect()
}

fn parse_workspace_mode(value: &str) -> CommandResult<ReviewRunExecutionMode> {
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

fn invalid_review_run(error: crate::domain::review_run::ReviewRunDomainError) -> CommandError {
    CommandError::from(AppUseCaseError::from(error))
}

fn format_problem_state(state: ReviewRunListProblemState) -> &'static str {
    state.as_str()
}
