//! User-review command DTOs and handlers.

use std::str::FromStr;

use chrono::{DateTime, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app::{
        services::performance::{emit_span, start_span, PerformanceContext},
        use_cases::{
            AppUseCaseError, ArchiveUserReviewInput, CreateUserReviewInput, ListUserReviewsInput,
            UserReviewUseCaseError,
        },
    },
    domain::{
        comment::CommentId,
        spec::{SpecFileKey, SpecId},
        user_review::{
            UserReview, UserReviewDomainError, UserReviewId, UserReviewRecordProblem,
            UserReviewRecordProblemKind, UserReviewStatus, UserReviewTarget,
        },
    },
    infrastructure::persistence::user_review_document::USER_REVIEW_DOCUMENT_SCHEMA_VERSION,
};

use super::{CommandError, CommandResult, CommandState};

pub type CreateUserReviewCommandResult<T> = Result<T, UserReviewCommandError>;
pub type ListUserReviewsCommandResult<T> = Result<T, UserReviewCommandError>;
pub type ArchiveUserReviewCommandResult<T> = Result<T, UserReviewCommandError>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserReviewCommandError {
    code: UserReviewCommandErrorCode,
    message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum UserReviewCommandErrorCode {
    InvalidRequest,
    WorkspaceDetection,
    ConfigLoad,
    InvalidSpec,
    InvalidComment,
    CommentRepository,
    InvalidUserReview,
    UserReviewCollision,
    UserReviewRepository,
    Unexpected,
}

impl UserReviewCommandError {
    fn new(code: UserReviewCommandErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    fn from_app_error(error: AppUseCaseError) -> Self {
        let code = match &error {
            AppUseCaseError::WorkspaceDetection { .. } => {
                UserReviewCommandErrorCode::WorkspaceDetection
            }
            AppUseCaseError::ConfigLoad { .. } => UserReviewCommandErrorCode::ConfigLoad,
            AppUseCaseError::InvalidSpec { .. } => UserReviewCommandErrorCode::InvalidSpec,
            AppUseCaseError::InvalidComment { .. } => UserReviewCommandErrorCode::InvalidComment,
            AppUseCaseError::CommentRepository { .. } => {
                UserReviewCommandErrorCode::CommentRepository
            }
            AppUseCaseError::UserReview {
                source: UserReviewUseCaseError::CreateIdCollision { .. },
            } => UserReviewCommandErrorCode::UserReviewCollision,
            AppUseCaseError::UserReview {
                source: UserReviewUseCaseError::Repository(_),
            } => UserReviewCommandErrorCode::UserReviewRepository,
            AppUseCaseError::UserReview { .. } => UserReviewCommandErrorCode::InvalidUserReview,
            AppUseCaseError::SpecTreeScan { .. }
            | AppUseCaseError::SpecArchive { .. }
            | AppUseCaseError::MarkdownRead { .. } => UserReviewCommandErrorCode::Unexpected,
        };

        Self::new(code, error.to_string())
    }

    fn from_command_error(error: CommandError) -> Self {
        let code = match error.code() {
            "invalidRequest" => UserReviewCommandErrorCode::InvalidRequest,
            "workspaceDetection" => UserReviewCommandErrorCode::WorkspaceDetection,
            "configLoad" => UserReviewCommandErrorCode::ConfigLoad,
            "invalidSpec" => UserReviewCommandErrorCode::InvalidSpec,
            "invalidComment" => UserReviewCommandErrorCode::InvalidComment,
            "commentRepository" => UserReviewCommandErrorCode::CommentRepository,
            "invalidUserReview" => UserReviewCommandErrorCode::InvalidUserReview,
            "userReviewCollision" => UserReviewCommandErrorCode::UserReviewCollision,
            "userReviewRepository" => UserReviewCommandErrorCode::UserReviewRepository,
            _ => UserReviewCommandErrorCode::Unexpected,
        };

        Self::new(code, error.message())
    }
}

impl From<AppUseCaseError> for UserReviewCommandError {
    fn from(error: AppUseCaseError) -> Self {
        Self::from_app_error(error)
    }
}

impl From<CommandError> for UserReviewCommandError {
    fn from(error: CommandError) -> Self {
        Self::from_command_error(error)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateUserReviewRequest {
    workspace_path: String,
    target: UserReviewTargetRequest,
    comment_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(
    tag = "scope",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum UserReviewTargetRequest {
    File { spec_id: String, file_key: String },
    Spec { spec_id: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUserReviewResponse {
    user_review: UserReviewSummaryResponse,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ListUserReviewsRequest {
    workspace_path: String,
    target: UserReviewTargetRequest,
    correlation_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListUserReviewsResponse {
    active: Vec<UserReviewSummaryResponse>,
    archived: Vec<UserReviewSummaryResponse>,
    problems: Vec<UserReviewListProblemResponse>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ArchiveUserReviewRequest {
    workspace_path: String,
    target: UserReviewTargetRequest,
    user_review_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveUserReviewResponse {
    user_review: UserReviewSummaryResponse,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserReviewSummaryResponse {
    schema_version: &'static str,
    id: String,
    status: String,
    target: UserReviewTargetResponse,
    record_locator: String,
    comment_count: usize,
    created_at: String,
    updated_at: String,
    archived_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserReviewListProblemResponse {
    record_locator: String,
    kind: UserReviewListProblemKindResponse,
    message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum UserReviewListProblemKindResponse {
    LegacyFolderBundle,
    UnsupportedSchemaVersion,
    MalformedDocument,
    RecoverableDuplicate,
    ConflictingCopies,
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

#[tauri::command]
pub fn create_user_review(
    state: State<'_, CommandState>,
    request: CreateUserReviewRequest,
) -> CreateUserReviewCommandResult<CreateUserReviewResponse> {
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let target = request.target.into_domain()?;
    let service = state
        .use_cases()
        .user_review_use_cases(&workspace, &target)?;
    let created = service.create_user_review(CreateUserReviewInput::new(
        target,
        parse_comment_ids(&request.comment_ids)?,
    ))?;

    Ok(CreateUserReviewResponse {
        user_review: UserReviewSummaryResponse::from_review(created.user_review()),
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
    let end_span = performance_context
        .as_ref()
        .map(|context| start_span(context, "command.list_user_reviews"));
    let target = request.target.into_domain()?;
    let result = state
        .use_cases()
        .user_review_use_cases(&workspace, &target)?
        .list_user_reviews(ListUserReviewsInput::new(target));

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
                metadata.insert(
                    "error_code",
                    CommandError::from(error.clone()).code().to_string(),
                );
            }
        }
        emit_span(context, end_span(metadata));
    }

    let result = result?;
    Ok(ListUserReviewsResponse {
        active: result
            .active()
            .iter()
            .map(UserReviewSummaryResponse::from_review)
            .collect(),
        archived: result
            .archived()
            .iter()
            .map(UserReviewSummaryResponse::from_review)
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
    let target = request.target.into_domain()?;
    let user_review_id = UserReviewId::new(request.user_review_id).map_err(invalid_user_review)?;
    let archived = state
        .use_cases()
        .user_review_use_cases(&workspace, &target)?
        .archive_user_review(ArchiveUserReviewInput::new(target, user_review_id))?;

    Ok(ArchiveUserReviewResponse {
        user_review: UserReviewSummaryResponse::from_review(archived.user_review()),
    })
}

impl UserReviewTargetRequest {
    fn into_domain(self) -> CommandResult<UserReviewTarget> {
        match self {
            Self::File { spec_id, file_key } => Ok(UserReviewTarget::file(
                SpecId::new(spec_id).map_err(invalid_spec)?,
                SpecFileKey::from_str(&file_key).map_err(invalid_spec)?,
            )),
            Self::Spec { spec_id } => Ok(UserReviewTarget::spec(
                SpecId::new(spec_id).map_err(invalid_spec)?,
            )),
        }
    }
}

impl UserReviewSummaryResponse {
    fn from_review(review: &UserReview) -> Self {
        Self {
            schema_version: USER_REVIEW_DOCUMENT_SCHEMA_VERSION,
            id: review.id().as_str().to_string(),
            status: format_status(review.status()).to_string(),
            target: UserReviewTargetResponse::from_target(review.target()),
            record_locator: format!("{}.json", review.id()),
            comment_count: review.comments().len(),
            created_at: format_timestamp(review.created_at()),
            updated_at: format_timestamp(review.updated_at()),
            archived_at: review.archived_at().map(format_timestamp),
        }
    }
}

impl UserReviewTargetResponse {
    fn from_target(target: &UserReviewTarget) -> Self {
        match target {
            UserReviewTarget::File { spec_id, file_key } => Self::File {
                spec_id: spec_id.as_str().to_string(),
                file_key: file_key.as_str().to_string(),
            },
            UserReviewTarget::Spec { spec_id } => Self::Spec {
                spec_id: spec_id.as_str().to_string(),
            },
        }
    }
}

impl UserReviewListProblemResponse {
    fn from_problem(problem: &UserReviewRecordProblem) -> Self {
        let kind = UserReviewListProblemKindResponse::from_kind(problem.kind());
        let record_locator = problem.locator().as_str().to_string();

        Self {
            message: format_problem_message(kind, &record_locator),
            record_locator,
            kind,
        }
    }
}

impl UserReviewListProblemKindResponse {
    fn from_kind(kind: UserReviewRecordProblemKind) -> Self {
        match kind {
            UserReviewRecordProblemKind::LegacyRecord => Self::LegacyFolderBundle,
            UserReviewRecordProblemKind::UnsupportedRecordVersion => Self::UnsupportedSchemaVersion,
            UserReviewRecordProblemKind::MalformedRecord => Self::MalformedDocument,
            UserReviewRecordProblemKind::RecoverableDuplicate => Self::RecoverableDuplicate,
            UserReviewRecordProblemKind::ConflictingCopies => Self::ConflictingCopies,
        }
    }
}

fn parse_comment_ids(values: &[String]) -> CommandResult<Vec<CommentId>> {
    values
        .iter()
        .map(|value| CommentId::new(value).map_err(invalid_comment))
        .collect()
}

fn invalid_spec(error: crate::domain::spec::SpecDomainError) -> CommandError {
    CommandError::from(AppUseCaseError::from(error))
}

fn invalid_comment(error: crate::domain::comment::CommentDomainError) -> CommandError {
    CommandError::from(AppUseCaseError::from(error))
}

fn invalid_user_review(error: UserReviewDomainError) -> CommandError {
    CommandError::from(AppUseCaseError::from(UserReviewUseCaseError::Domain(error)))
}

fn format_status(status: UserReviewStatus) -> &'static str {
    match status {
        UserReviewStatus::Active => "active",
        UserReviewStatus::Archived => "archived",
    }
}

fn format_timestamp(timestamp: DateTime<Utc>) -> String {
    timestamp.to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn format_problem_message(kind: UserReviewListProblemKindResponse, locator: &str) -> String {
    match kind {
        UserReviewListProblemKindResponse::LegacyFolderBundle => {
            format!("Legacy user-review folder was left untouched: {locator}")
        }
        UserReviewListProblemKindResponse::UnsupportedSchemaVersion => {
            format!("User-review schema version is unsupported: {locator}")
        }
        UserReviewListProblemKindResponse::MalformedDocument => {
            format!("User-review document is malformed: {locator}")
        }
        UserReviewListProblemKindResponse::RecoverableDuplicate => {
            format!("User-review archive cleanup can be retried: {locator}")
        }
        UserReviewListProblemKindResponse::ConflictingCopies => {
            format!("User-review active and archived copies conflict: {locator}")
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::{json, Value};

    use super::*;
    use crate::domain::{
        comment::{CommentBody, CommentStatus, TextSnippet},
        spec::{MarkdownBlockHash, MarkdownBlockType},
        user_review::{PositiveLineNumber, UserReviewComment, UserReviewSource},
        workspace::WorkspaceRelativePath,
    };

    fn timestamp(minute: u32) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(&format!("2026-05-06T12:{minute:02}:00.000Z"))
            .expect("timestamp should parse")
            .with_timezone(&Utc)
    }

    fn review() -> UserReview {
        let target = UserReviewTarget::file(
            SpecId::new("001-auth-flow").expect("spec ID should be valid"),
            SpecFileKey::Tasks,
        );
        let comment = UserReviewComment::new(
            CommentId::new("cmt_1").expect("comment ID should be valid"),
            CommentStatus::Open,
            UserReviewSource::new(
                target.spec_id().clone(),
                SpecFileKey::Tasks,
                WorkspaceRelativePath::new(".plugin-workspace/.specs/001-auth-flow/tasks.md")
                    .expect("path should be valid"),
            ),
            MarkdownBlockType::Paragraph,
            PositiveLineNumber::new(42).expect("line should be valid"),
            PositiveLineNumber::new(48).expect("line should be valid"),
            TextSnippet::new("Target text").expect("snippet should be valid"),
            MarkdownBlockHash::new("sha256:d4b1ea57").expect("hash should be valid"),
            CommentBody::new("Split this task").expect("body should be valid"),
            timestamp(39),
            timestamp(39),
        )
        .expect("comment should be valid");

        UserReview::new(
            UserReviewId::new("urv_00000000000000000000000000000001")
                .expect("review ID should be valid"),
            target,
            vec![comment],
            timestamp(40),
        )
        .expect("review should be valid")
    }

    #[test]
    fn create_request_accepts_single_json_contract_without_workspace_mode() {
        let request = serde_json::from_value::<CreateUserReviewRequest>(json!({
            "workspacePath": "/workspace/project",
            "target": {
                "scope": "file",
                "specId": "001-auth-flow",
                "fileKey": "tasks"
            },
            "commentIds": ["cmt_1"]
        }));

        assert!(request.is_ok());
    }

    #[test]
    fn create_request_rejects_removed_workspace_mode() {
        let request = serde_json::from_value::<CreateUserReviewRequest>(json!({
            "workspacePath": "/workspace/project",
            "target": {
                "scope": "file",
                "specId": "001-auth-flow",
                "fileKey": "tasks"
            },
            "commentIds": ["cmt_1"],
            "workspaceMode": "worktree"
        }));

        assert!(request.is_err());
    }

    #[test]
    fn summary_serializes_only_the_single_json_contract() {
        let value = serde_json::to_value(UserReviewSummaryResponse::from_review(&review()))
            .expect("summary should serialize");
        let object = value.as_object().expect("summary should be an object");

        assert_eq!(
            [
                "archivedAt",
                "commentCount",
                "createdAt",
                "id",
                "recordLocator",
                "schemaVersion",
                "status",
                "target",
                "updatedAt",
            ]
            .into_iter()
            .collect::<std::collections::BTreeSet<_>>(),
            object
                .keys()
                .map(String::as_str)
                .collect::<std::collections::BTreeSet<_>>()
        );
        assert_eq!(
            Some(&Value::String("spec-reviewer.user-review.v1".to_string())),
            object.get("schemaVersion")
        );
        assert_eq!(
            Some(&Value::String("2026-05-06T12:40:00.000Z".to_string())),
            object.get("createdAt")
        );
        assert!(!object.contains_key("folderPath"));
        assert!(!object.contains_key("workspace"));
        assert!(!object.contains_key("sourceFiles"));
        assert!(!object.contains_key("summary"));
        assert!(!object.contains_key("warnings"));
    }

    #[test]
    fn legacy_problem_uses_the_stable_single_json_problem_token() {
        let problem = UserReviewRecordProblem::new(
            crate::domain::user_review::UserReviewRecordLocator::new("legacy-run")
                .expect("locator should be valid"),
            UserReviewRecordProblemKind::LegacyRecord,
        );
        let value = serde_json::to_value(UserReviewListProblemResponse::from_problem(&problem))
            .expect("problem should serialize");

        assert_eq!(
            Some(&Value::String("legacyFolderBundle".to_string())),
            value.get("kind")
        );
        assert_eq!(
            Some(&Value::String("legacy-run".to_string())),
            value.get("recordLocator")
        );
    }
}
