//! Comment command DTOs and handlers.

use std::{fs, path::Path, str::FromStr};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app::services::performance::{emit_span, start_span, PerformanceContext},
    app::use_cases::{
        AnchorResolutionReason, AnchorResolutionStatus, AppMarkdownDocument, AppUseCaseError,
        CommentAnchorResolution, CommentAnchorResolutionTarget, ReadSpecFileResult,
    },
    domain::{
        comment::{
            BlockIndex, BlockType, CharRange, Comment, CommentAnchor, CommentBody,
            CommentDomainError, CommentId, CommentStatus, CommentStatusFilter, TextHash,
            TextSnippet,
        },
        spec::{MarkdownBlock, MarkdownBlockSourceRange, SpecFileKey, SpecId, SpecNode},
    },
};

use super::{CommandError, CommandResult, CommandState};

pub type AddCommentCommandResult<T> = Result<T, AddCommentCommandError>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddCommentCommandError {
    code: AddCommentCommandErrorCode,
    message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AddCommentCommandErrorCode {
    InvalidRequest,
    WorkspaceDetection,
    ConfigLoad,
    InvalidComment,
    CommentRepository,
    Unexpected,
}

impl AddCommentCommandError {
    fn new(code: AddCommentCommandErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    fn from_app_error(error: AppUseCaseError) -> Self {
        let code = match error {
            AppUseCaseError::WorkspaceDetection { .. } => {
                AddCommentCommandErrorCode::WorkspaceDetection
            }
            AppUseCaseError::ConfigLoad { .. } => AddCommentCommandErrorCode::ConfigLoad,
            AppUseCaseError::InvalidComment { .. } => AddCommentCommandErrorCode::InvalidComment,
            AppUseCaseError::InvalidSpec { .. } => AddCommentCommandErrorCode::InvalidRequest,
            AppUseCaseError::CommentRepository { .. } => {
                AddCommentCommandErrorCode::CommentRepository
            }
            AppUseCaseError::SpecTreeScan { .. }
            | AppUseCaseError::SpecArchive { .. }
            | AppUseCaseError::MarkdownRead { .. }
            | AppUseCaseError::ReviewRunExport { .. } => AddCommentCommandErrorCode::Unexpected,
        };

        Self::new(code, error.to_string())
    }

    fn from_command_error(error: CommandError) -> Self {
        let code = match error.code() {
            "invalidRequest" => AddCommentCommandErrorCode::InvalidRequest,
            "invalidComment" => AddCommentCommandErrorCode::InvalidComment,
            _ => AddCommentCommandErrorCode::Unexpected,
        };

        Self::new(code, error.message())
    }

    pub fn code(&self) -> AddCommentCommandErrorCode {
        self.code
    }

    pub fn message(&self) -> &str {
        &self.message
    }
}

impl From<CommentDomainError> for AddCommentCommandError {
    fn from(error: CommentDomainError) -> Self {
        Self::from_app_error(AppUseCaseError::from(error))
    }
}

pub type CommentCommandResult<T> = Result<T, CommentCommandError>;
pub type ListCommentsCommandResult<T> = CommentCommandResult<T>;
pub type UpdateCommentCommandResult<T> = CommentCommandResult<T>;
pub type DeleteCommentCommandResult<T> = CommentCommandResult<T>;
pub type CommentStatusCommandResult<T> = CommentCommandResult<T>;
pub type ExportCommentsCommandResult<T> = CommentCommandResult<T>;
pub type GenerateLlmPromptCommandResult<T> = CommentCommandResult<T>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentCommandError {
    code: CommentCommandErrorCode,
    message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CommentCommandErrorCode {
    InvalidRequest,
    WorkspaceDetection,
    ConfigLoad,
    MarkdownRead,
    InvalidComment,
    CommentRepository,
    Unexpected,
}

impl CommentCommandError {
    fn new(code: CommentCommandErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    fn from_app_error(error: AppUseCaseError) -> Self {
        let code = match error {
            AppUseCaseError::WorkspaceDetection { .. } => {
                CommentCommandErrorCode::WorkspaceDetection
            }
            AppUseCaseError::ConfigLoad { .. } => CommentCommandErrorCode::ConfigLoad,
            AppUseCaseError::MarkdownRead { .. } => CommentCommandErrorCode::MarkdownRead,
            AppUseCaseError::InvalidSpec { .. } => CommentCommandErrorCode::InvalidRequest,
            AppUseCaseError::InvalidComment { .. } => CommentCommandErrorCode::InvalidComment,
            AppUseCaseError::CommentRepository { .. } => CommentCommandErrorCode::CommentRepository,
            AppUseCaseError::SpecTreeScan { .. }
            | AppUseCaseError::SpecArchive { .. }
            | AppUseCaseError::ReviewRunExport { .. } => CommentCommandErrorCode::Unexpected,
        };

        Self::new(code, error.to_string())
    }

    fn from_command_error(error: CommandError) -> Self {
        let code = match error.code() {
            "invalidRequest" => CommentCommandErrorCode::InvalidRequest,
            "invalidSpec" => CommentCommandErrorCode::InvalidRequest,
            "workspaceDetection" => CommentCommandErrorCode::WorkspaceDetection,
            "configLoad" => CommentCommandErrorCode::ConfigLoad,
            "markdownRead" => CommentCommandErrorCode::MarkdownRead,
            "invalidComment" => CommentCommandErrorCode::InvalidComment,
            "commentRepository" => CommentCommandErrorCode::CommentRepository,
            _ => CommentCommandErrorCode::Unexpected,
        };

        Self::new(code, error.message())
    }

    pub fn code(&self) -> CommentCommandErrorCode {
        self.code
    }
}

impl From<AppUseCaseError> for CommentCommandError {
    fn from(error: AppUseCaseError) -> Self {
        Self::from_app_error(error)
    }
}

impl From<CommandError> for CommentCommandError {
    fn from(error: CommandError) -> Self {
        Self::from_command_error(error)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCommentsRequest {
    workspace_path: String,
    spec_id: String,
    file_key: String,
    status_filter: Option<String>,
    correlation_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddCommentRequest {
    workspace_path: String,
    spec_id: String,
    anchor: CommentAnchorRequest,
    body: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCommentRequest {
    workspace_path: String,
    spec_id: String,
    file_key: String,
    comment_id: String,
    body: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCommentRequest {
    workspace_path: String,
    spec_id: String,
    file_key: String,
    comment_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentStatusRequest {
    workspace_path: String,
    spec_id: String,
    file_key: String,
    comment_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportCommentsRequest {
    workspace_path: String,
    target: ExportCommentsTargetRequest,
    destination_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateLlmPromptRequest {
    workspace_path: String,
    target: ExportCommentsTargetRequest,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(tag = "scope", rename_all = "camelCase")]
pub enum ExportCommentsTargetRequest {
    File { spec_id: String, file_key: String },
    Spec { spec_id: String },
    Workspace,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentAnchorRequest {
    file_key: String,
    block_type: String,
    block_index: usize,
    text_hash: String,
    text_snippet: String,
    char_range: CharRangeDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCommentsResponse {
    comments: Vec<CommentResponse>,
}

impl ListCommentsResponse {
    pub fn comments(&self) -> &[CommentResponse] {
        &self.comments
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentResponse {
    id: String,
    anchor: CommentAnchorResponse,
    body: String,
    status: String,
    resolved: bool,
    anchor_resolution: Option<CommentAnchorResolutionResponse>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl CommentResponse {
    pub fn id(&self) -> &str {
        &self.id
    }

    pub fn anchor(&self) -> &CommentAnchorResponse {
        &self.anchor
    }

    pub fn body(&self) -> &str {
        &self.body
    }

    pub fn status(&self) -> &str {
        &self.status
    }

    pub fn resolved(&self) -> bool {
        self.resolved
    }

    pub fn anchor_resolution(&self) -> Option<&CommentAnchorResolutionResponse> {
        self.anchor_resolution.as_ref()
    }

    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    pub fn updated_at(&self) -> DateTime<Utc> {
        self.updated_at
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentAnchorResponse {
    file_key: String,
    block_type: String,
    block_index: usize,
    text_hash: String,
    text_snippet: String,
    char_range: CharRangeDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentAnchorResolutionResponse {
    status: String,
    reason: String,
    details: Option<String>,
    target: Option<CommentAnchorResolutionTargetResponse>,
}

impl CommentAnchorResolutionResponse {
    pub fn status(&self) -> &str {
        &self.status
    }

    pub fn reason(&self) -> &str {
        &self.reason
    }

    pub fn details(&self) -> Option<&str> {
        self.details.as_deref()
    }

    pub fn target(&self) -> Option<&CommentAnchorResolutionTargetResponse> {
        self.target.as_ref()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentAnchorResolutionTargetResponse {
    block_type: String,
    block_index: usize,
    text_hash: String,
    text_snippet: String,
    source_range: Option<CommentSourceRangeResponse>,
    score: u8,
}

impl CommentAnchorResolutionTargetResponse {
    pub fn block_type(&self) -> &str {
        &self.block_type
    }

    pub fn block_index(&self) -> usize {
        self.block_index
    }

    pub fn text_hash(&self) -> &str {
        &self.text_hash
    }

    pub fn text_snippet(&self) -> &str {
        &self.text_snippet
    }

    pub fn source_range(&self) -> Option<&CommentSourceRangeResponse> {
        self.source_range.as_ref()
    }

    pub fn score(&self) -> u8 {
        self.score
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentSourceRangeResponse {
    start_byte_offset: usize,
    end_byte_offset: usize,
}

impl CommentSourceRangeResponse {
    pub fn start_byte_offset(&self) -> usize {
        self.start_byte_offset
    }

    pub fn end_byte_offset(&self) -> usize {
        self.end_byte_offset
    }
}

impl CommentAnchorResponse {
    pub fn file_key(&self) -> &str {
        &self.file_key
    }

    pub fn block_type(&self) -> &str {
        &self.block_type
    }

    pub fn block_index(&self) -> usize {
        self.block_index
    }

    pub fn text_hash(&self) -> &str {
        &self.text_hash
    }

    pub fn text_snippet(&self) -> &str {
        &self.text_snippet
    }

    pub fn char_range(&self) -> &CharRangeDto {
        &self.char_range
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CharRangeDto {
    start: usize,
    end: usize,
}

impl CharRangeDto {
    pub fn start(&self) -> usize {
        self.start
    }

    pub fn end(&self) -> usize {
        self.end
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCommentResponse {
    deleted: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportCommentsResponse {
    destination_path: String,
    format: String,
    comment_count: usize,
}

impl ExportCommentsResponse {
    pub fn destination_path(&self) -> &str {
        &self.destination_path
    }

    pub fn format(&self) -> &str {
        &self.format
    }

    pub fn comment_count(&self) -> usize {
        self.comment_count
    }
}

impl DeleteCommentResponse {
    pub fn deleted(&self) -> bool {
        self.deleted
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateLlmPromptResponse {
    prompt: String,
    comment_count: usize,
    context_file_count: usize,
}

impl GenerateLlmPromptResponse {
    pub fn prompt(&self) -> &str {
        &self.prompt
    }

    pub fn comment_count(&self) -> usize {
        self.comment_count
    }

    pub fn context_file_count(&self) -> usize {
        self.context_file_count
    }
}

#[tauri::command]
pub fn list_comments(
    state: State<'_, CommandState>,
    request: ListCommentsRequest,
) -> ListCommentsCommandResult<ListCommentsResponse> {
    let file_key = parse_file_key(&request.file_key)?;
    let status_filter = parse_status_filter(request.status_filter.as_deref())?;
    let spec_id = parse_spec_id(&request.spec_id)?;
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let performance_context = request
        .correlation_id
        .as_ref()
        .map(|correlation_id| PerformanceContext::new(correlation_id, "list_comments"));
    let end_span = performance_context
        .as_ref()
        .map(|context| start_span(context, "command.list_comments"));
    let result = (|| {
        let current_blocks = state
            .use_cases()
            .read_spec_blocks_cached(&workspace, spec_id.as_str(), file_key)
            .map_err(CommandError::from)?;
        let resolutions = state
            .use_cases()
            .comment_use_cases(&workspace)
            .resolve_comment_anchors(&spec_id, file_key, status_filter, &current_blocks)?;

        Ok::<_, CommandError>((current_blocks.len(), resolutions))
    })();

    if let (Some(context), Some(end_span)) = (performance_context.as_ref(), end_span) {
        let mut metadata = std::collections::BTreeMap::new();
        metadata.insert("spec_id", request.spec_id.clone());
        metadata.insert("file_key", request.file_key.clone());
        match &result {
            Ok((block_count, resolutions)) => {
                metadata.insert("block_count", block_count.to_string());
                metadata.insert("comment_count", resolutions.resolutions().len().to_string());
            }
            Err(error) => {
                metadata.insert("error", "true".to_string());
                metadata.insert("error_code", error.code().to_string());
            }
        }
        emit_span(context, end_span(metadata));
    }

    let (_block_count, resolutions) = result?;
    Ok(ListCommentsResponse::from(resolutions.into_resolutions()))
}

#[tauri::command]
pub fn add_comment(
    state: State<'_, CommandState>,
    request: AddCommentRequest,
) -> AddCommentCommandResult<CommentResponse> {
    let anchor = request
        .anchor
        .into_domain()
        .map_err(AddCommentCommandError::from_command_error)?;
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(AddCommentCommandError::from_app_error)?;
    let spec_id =
        parse_spec_id(&request.spec_id).map_err(AddCommentCommandError::from_app_error)?;
    let body = parse_comment_body(&request.body).map_err(AddCommentCommandError::from_app_error)?;
    let comment = state
        .use_cases()
        .comment_use_cases(&workspace)
        .add_comment(&spec_id, anchor, body)
        .map_err(AddCommentCommandError::from_app_error)?;

    Ok(CommentResponse::from(&comment))
}

#[tauri::command]
pub fn update_comment(
    state: State<'_, CommandState>,
    request: UpdateCommentRequest,
) -> UpdateCommentCommandResult<CommentResponse> {
    let file_key = parse_file_key(&request.file_key)?;
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let spec_id = parse_spec_id(&request.spec_id)?;
    let comment_id = parse_comment_id(&request.comment_id)?;
    let body = parse_comment_body(&request.body)?;
    let comment = state
        .use_cases()
        .comment_use_cases(&workspace)
        .update_comment(&spec_id, file_key, &comment_id, body)?;

    Ok(CommentResponse::from(&comment))
}

#[tauri::command]
pub fn delete_comment(
    state: State<'_, CommandState>,
    request: DeleteCommentRequest,
) -> DeleteCommentCommandResult<DeleteCommentResponse> {
    let file_key = parse_file_key(&request.file_key)?;
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let spec_id = parse_spec_id(&request.spec_id)?;
    let comment_id = parse_comment_id(&request.comment_id)?;

    state
        .use_cases()
        .comment_use_cases(&workspace)
        .delete_comment(&spec_id, file_key, &comment_id)?;

    Ok(DeleteCommentResponse { deleted: true })
}

#[tauri::command]
pub fn resolve_comment(
    state: State<'_, CommandState>,
    request: CommentStatusRequest,
) -> CommentStatusCommandResult<CommentResponse> {
    update_comment_status(state, request, CommentStatusAction::Resolve)
}

#[tauri::command]
pub fn reopen_comment(
    state: State<'_, CommandState>,
    request: CommentStatusRequest,
) -> CommentStatusCommandResult<CommentResponse> {
    update_comment_status(state, request, CommentStatusAction::Reopen)
}

#[tauri::command]
pub fn toggle_comment_resolved(
    state: State<'_, CommandState>,
    request: CommentStatusRequest,
) -> CommentStatusCommandResult<CommentResponse> {
    update_comment_status(state, request, CommentStatusAction::Toggle)
}

#[tauri::command]
pub fn export_comments(
    state: State<'_, CommandState>,
    request: ExportCommentsRequest,
) -> ExportCommentsCommandResult<ExportCommentsResponse> {
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let generated_at = Utc::now();
    let export = build_comment_export(state.use_cases(), &workspace, &request, generated_at)?;
    write_export_file(&request.destination_path, &export.contents)?;

    Ok(ExportCommentsResponse {
        destination_path: request.destination_path,
        format: export.format.as_str().to_string(),
        comment_count: export.comment_count,
    })
}

#[tauri::command]
pub fn generate_llm_prompt(
    state: State<'_, CommandState>,
    request: GenerateLlmPromptRequest,
) -> GenerateLlmPromptCommandResult<GenerateLlmPromptResponse> {
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let generated_at = Utc::now();

    build_llm_prompt(state.use_cases(), &workspace, &request, generated_at)
}

impl From<Vec<CommentAnchorResolution>> for ListCommentsResponse {
    fn from(resolutions: Vec<CommentAnchorResolution>) -> Self {
        Self {
            comments: resolutions.iter().map(CommentResponse::from).collect(),
        }
    }
}

impl From<&Comment> for CommentResponse {
    fn from(comment: &Comment) -> Self {
        Self {
            id: comment.id().as_str().to_string(),
            anchor: CommentAnchorResponse::from(comment.anchor()),
            body: comment.body().as_str().to_string(),
            status: status_to_response(comment.status()).to_string(),
            resolved: comment.is_resolved(),
            anchor_resolution: None,
            created_at: comment.created_at(),
            updated_at: comment.updated_at(),
        }
    }
}

impl From<&CommentAnchorResolution> for CommentResponse {
    fn from(resolution: &CommentAnchorResolution) -> Self {
        let mut response = Self::from(resolution.comment());
        response.anchor_resolution = Some(CommentAnchorResolutionResponse::from(resolution));

        response
    }
}

impl From<&CommentAnchor> for CommentAnchorResponse {
    fn from(anchor: &CommentAnchor) -> Self {
        let char_range = anchor.char_range();

        Self {
            file_key: anchor.file_key().as_str().to_string(),
            block_type: block_type_to_response(anchor.block_type()).to_string(),
            block_index: anchor.block_index().value(),
            text_hash: anchor.text_hash().as_str().to_string(),
            text_snippet: anchor.text_snippet().as_str().to_string(),
            char_range: CharRangeDto {
                start: char_range.start(),
                end: char_range.end(),
            },
        }
    }
}

impl From<&CommentAnchorResolution> for CommentAnchorResolutionResponse {
    fn from(resolution: &CommentAnchorResolution) -> Self {
        Self {
            status: anchor_resolution_status_to_response(resolution.status()).to_string(),
            reason: anchor_resolution_reason_to_response(resolution.reason()).to_string(),
            details: resolution.details().map(str::to_string),
            target: resolution
                .target()
                .map(CommentAnchorResolutionTargetResponse::from),
        }
    }
}

impl From<&CommentAnchorResolutionTarget> for CommentAnchorResolutionTargetResponse {
    fn from(target: &CommentAnchorResolutionTarget) -> Self {
        let block = target.block();

        Self {
            block_type: block.block_type().as_str().to_string(),
            block_index: block.index().value(),
            text_hash: block.text_hash().as_str().to_string(),
            text_snippet: create_block_text_snippet(block.text().normalized()),
            source_range: block.source_range().map(CommentSourceRangeResponse::from),
            score: target.score(),
        }
    }
}

impl From<MarkdownBlockSourceRange> for CommentSourceRangeResponse {
    fn from(range: MarkdownBlockSourceRange) -> Self {
        Self {
            start_byte_offset: range.start_byte_offset(),
            end_byte_offset: range.end_byte_offset(),
        }
    }
}

impl CommentAnchorRequest {
    fn into_domain(self) -> CommandResult<CommentAnchor> {
        let file_key = parse_file_key(&self.file_key)?;
        let block_type = parse_block_type(&self.block_type)?;
        let char_range =
            CharRange::new(self.char_range.start, self.char_range.end).map_err(invalid_comment)?;

        Ok(CommentAnchor::new(
            file_key,
            block_type,
            BlockIndex::new(self.block_index),
            TextHash::new(self.text_hash).map_err(invalid_comment)?,
            TextSnippet::new(self.text_snippet).map_err(invalid_comment)?,
            char_range,
        ))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CommentStatusAction {
    Resolve,
    Reopen,
    Toggle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CommentExportFormat {
    Markdown,
    Json,
}

impl CommentExportFormat {
    fn as_str(self) -> &'static str {
        match self {
            Self::Markdown => "markdown",
            Self::Json => "json",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct CommentExport {
    format: CommentExportFormat,
    contents: String,
    comment_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ExportedCommentFile {
    spec_id: String,
    spec_label: String,
    file_key: SpecFileKey,
    file_label: String,
    comments: Vec<CommentResponse>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct LlmPromptFile {
    spec_id: String,
    spec_label: String,
    file_key: SpecFileKey,
    file_label: String,
    markdown_path: String,
    markdown_contents: Option<String>,
    unresolved_comments: Vec<CommentResponse>,
    orphaned_comments: Vec<CommentResponse>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct PromptMarkdownDocument {
    path: String,
    contents: Option<String>,
    blocks: Vec<MarkdownBlock>,
}

impl PromptMarkdownDocument {
    fn from_found(document: AppMarkdownDocument) -> Self {
        Self {
            path: document.path().to_string(),
            contents: Some(document.contents().to_string()),
            blocks: document.blocks().to_vec(),
        }
    }

    fn from_missing(path: impl Into<String>) -> Self {
        Self {
            path: path.into(),
            contents: None,
            blocks: Vec::new(),
        }
    }

    fn path(&self) -> &str {
        &self.path
    }

    fn contents(&self) -> Option<&str> {
        self.contents.as_deref()
    }

    fn blocks(&self) -> &[MarkdownBlock] {
        &self.blocks
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportCommentsJsonDocument {
    version: u8,
    generated_at: DateTime<Utc>,
    target: ExportCommentsJsonTarget,
    workspace_path: String,
    comment_count: usize,
    specs: Vec<ExportCommentsJsonSpec>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportCommentsJsonTarget {
    scope: String,
    format: String,
    spec_id: Option<String>,
    file_key: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportCommentsJsonSpec {
    spec_id: String,
    spec_label: String,
    files: Vec<ExportCommentsJsonFile>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportCommentsJsonFile {
    file_key: String,
    file_label: String,
    comment_count: usize,
    comments: Vec<CommentResponse>,
}

fn update_comment_status(
    state: State<'_, CommandState>,
    request: CommentStatusRequest,
    action: CommentStatusAction,
) -> UpdateCommentCommandResult<CommentResponse> {
    let file_key = parse_file_key(&request.file_key)?;
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let spec_id = parse_spec_id(&request.spec_id)?;
    let comment_id = parse_comment_id(&request.comment_id)?;
    let comment_use_cases = state.use_cases().comment_use_cases(&workspace);
    let comment = match action {
        CommentStatusAction::Resolve => {
            comment_use_cases.resolve_comment(&spec_id, file_key, &comment_id)?
        }
        CommentStatusAction::Reopen => {
            comment_use_cases.reopen_comment(&spec_id, file_key, &comment_id)?
        }
        CommentStatusAction::Toggle => {
            comment_use_cases.toggle_comment_resolved(&spec_id, file_key, &comment_id)?
        }
    };

    Ok(CommentResponse::from(&comment))
}

fn build_comment_export(
    use_cases: &crate::app::use_cases::FilesystemAppUseCases,
    workspace: &crate::app::use_cases::LoadWorkspaceResult,
    request: &ExportCommentsRequest,
    generated_at: DateTime<Utc>,
) -> CommandResult<CommentExport> {
    match &request.target {
        ExportCommentsTargetRequest::File { spec_id, file_key } => {
            let file_key = parse_file_key(file_key)?;
            let parsed_spec_id = parse_spec_id(spec_id)?;
            let file = export_comment_file(
                use_cases,
                workspace,
                &parsed_spec_id,
                spec_id,
                file_key,
                file_key.display_label(),
            )?;
            let comment_count = count_exported_comments(std::slice::from_ref(&file));
            let contents = render_markdown_comment_export(
                "Current File Comments",
                &request.workspace_path,
                generated_at,
                std::slice::from_ref(&file),
                comment_count,
            );

            Ok(CommentExport {
                format: CommentExportFormat::Markdown,
                contents,
                comment_count,
            })
        }
        ExportCommentsTargetRequest::Spec { spec_id } => {
            let specs = use_cases.list_specs(workspace)?.into_specs();
            let spec = find_spec_node(&specs, spec_id).ok_or_else(|| {
                CommandError::invalid_request(format!("unknown spec id: {spec_id}"))
            })?;
            let files = export_comment_files_for_spec(use_cases, workspace, spec)?;
            let comment_count = count_exported_comments(&files);
            let contents = render_markdown_comment_export(
                "Current Spec Comments",
                &request.workspace_path,
                generated_at,
                &files,
                comment_count,
            );

            Ok(CommentExport {
                format: CommentExportFormat::Markdown,
                contents,
                comment_count,
            })
        }
        ExportCommentsTargetRequest::Workspace => {
            let specs = use_cases.list_specs(workspace)?.into_specs();
            let files = specs
                .iter()
                .flat_map(|spec| collect_spec_nodes(spec).into_iter())
                .map(|spec| export_comment_files_for_spec(use_cases, workspace, spec))
                .collect::<CommandResult<Vec<_>>>()?
                .into_iter()
                .flatten()
                .collect::<Vec<_>>();
            let comment_count = count_exported_comments(&files);
            let document = build_workspace_json_export(
                &request.workspace_path,
                generated_at,
                &files,
                comment_count,
            );
            let contents = serde_json::to_string_pretty(&document).map_err(|source| {
                CommandError::from(AppUseCaseError::CommentRepository {
                    message: format!("failed to serialize comment export: {source}"),
                })
            })?;

            Ok(CommentExport {
                format: CommentExportFormat::Json,
                contents,
                comment_count,
            })
        }
    }
}

fn build_llm_prompt(
    use_cases: &crate::app::use_cases::FilesystemAppUseCases,
    workspace: &crate::app::use_cases::LoadWorkspaceResult,
    request: &GenerateLlmPromptRequest,
    generated_at: DateTime<Utc>,
) -> GenerateLlmPromptCommandResult<GenerateLlmPromptResponse> {
    let files = match &request.target {
        ExportCommentsTargetRequest::File { spec_id, file_key } => {
            let file_key = parse_file_key(file_key)?;
            let parsed_spec_id = parse_spec_id(spec_id)?;
            vec![prompt_file(
                use_cases,
                workspace,
                &parsed_spec_id,
                spec_id,
                file_key,
                file_key.display_label(),
            )?]
        }
        ExportCommentsTargetRequest::Spec { spec_id } => {
            let specs = use_cases.list_specs(workspace)?.into_specs();
            let spec = find_spec_node(&specs, spec_id).ok_or_else(|| {
                CommandError::invalid_request(format!("unknown spec id: {spec_id}"))
            })?;

            prompt_files_for_spec(use_cases, workspace, spec)?
        }
        ExportCommentsTargetRequest::Workspace => {
            let specs = use_cases.list_specs(workspace)?.into_specs();
            specs
                .iter()
                .flat_map(|spec| collect_spec_nodes(spec).into_iter())
                .map(|spec| prompt_files_for_spec(use_cases, workspace, spec))
                .collect::<CommandResult<Vec<_>>>()?
                .into_iter()
                .flatten()
                .collect()
        }
    };
    let comment_count = count_prompt_comments(&files);
    let prompt = render_llm_prompt(
        &request.workspace_path,
        &request.target,
        generated_at,
        &files,
        comment_count,
    );

    Ok(GenerateLlmPromptResponse {
        prompt,
        comment_count,
        context_file_count: files.len(),
    })
}

fn export_comment_files_for_spec(
    use_cases: &crate::app::use_cases::FilesystemAppUseCases,
    workspace: &crate::app::use_cases::LoadWorkspaceResult,
    spec: &SpecNode,
) -> CommandResult<Vec<ExportedCommentFile>> {
    spec.files()
        .iter()
        .map(|file| {
            export_comment_file(
                use_cases,
                workspace,
                spec.id(),
                spec.label(),
                file.key(),
                file.display_label(),
            )
        })
        .collect()
}

fn prompt_files_for_spec(
    use_cases: &crate::app::use_cases::FilesystemAppUseCases,
    workspace: &crate::app::use_cases::LoadWorkspaceResult,
    spec: &SpecNode,
) -> CommandResult<Vec<LlmPromptFile>> {
    spec.files()
        .iter()
        .map(|file| {
            prompt_file(
                use_cases,
                workspace,
                spec.id(),
                spec.label(),
                file.key(),
                file.display_label(),
            )
        })
        .collect()
}

fn export_comment_file(
    use_cases: &crate::app::use_cases::FilesystemAppUseCases,
    workspace: &crate::app::use_cases::LoadWorkspaceResult,
    spec_id: &SpecId,
    spec_label: &str,
    file_key: SpecFileKey,
    file_label: &str,
) -> CommandResult<ExportedCommentFile> {
    let current_blocks =
        read_current_markdown_blocks(use_cases, workspace, spec_id.as_str(), file_key)?;
    let resolutions = use_cases
        .comment_use_cases(workspace)
        .resolve_comment_anchors(spec_id, file_key, CommentStatusFilter::All, &current_blocks)?;

    Ok(ExportedCommentFile {
        spec_id: spec_id.as_str().to_string(),
        spec_label: spec_label.to_string(),
        file_key,
        file_label: file_label.to_string(),
        comments: resolutions
            .resolutions()
            .iter()
            .map(CommentResponse::from)
            .collect(),
    })
}

fn prompt_file(
    use_cases: &crate::app::use_cases::FilesystemAppUseCases,
    workspace: &crate::app::use_cases::LoadWorkspaceResult,
    spec_id: &SpecId,
    spec_label: &str,
    file_key: SpecFileKey,
    file_label: &str,
) -> CommandResult<LlmPromptFile> {
    let document =
        read_current_markdown_document(use_cases, workspace, spec_id.as_str(), file_key)?;
    let resolutions = use_cases
        .comment_use_cases(workspace)
        .resolve_comment_anchors(
            spec_id,
            file_key,
            CommentStatusFilter::Open,
            document.blocks(),
        )?;
    let mut unresolved_comments = Vec::new();
    let mut orphaned_comments = Vec::new();

    for resolution in resolutions.resolutions() {
        let comment = CommentResponse::from(resolution);

        if is_orphaned_comment(&comment) {
            orphaned_comments.push(comment);
            continue;
        }

        unresolved_comments.push(comment);
    }

    Ok(LlmPromptFile {
        spec_id: spec_id.as_str().to_string(),
        spec_label: spec_label.to_string(),
        file_key,
        file_label: file_label.to_string(),
        markdown_path: document.path().to_string(),
        markdown_contents: document.contents().map(str::to_string),
        unresolved_comments,
        orphaned_comments,
    })
}

fn find_spec_node<'a>(specs: &'a [SpecNode], spec_id: &str) -> Option<&'a SpecNode> {
    specs.iter().find_map(|spec| {
        if spec.id().as_str() == spec_id {
            return Some(spec);
        }

        find_spec_node(spec.children(), spec_id)
    })
}

fn collect_spec_nodes(spec: &SpecNode) -> Vec<&SpecNode> {
    let mut nodes = Vec::new();

    if !spec.files().is_empty() {
        nodes.push(spec);
    }

    for child in spec.children() {
        nodes.extend(collect_spec_nodes(child));
    }

    nodes
}

fn count_exported_comments(files: &[ExportedCommentFile]) -> usize {
    files.iter().map(|file| file.comments.len()).sum()
}

fn count_prompt_comments(files: &[LlmPromptFile]) -> usize {
    files
        .iter()
        .map(|file| file.unresolved_comments.len() + file.orphaned_comments.len())
        .sum()
}

fn render_llm_prompt(
    workspace_path: &str,
    target: &ExportCommentsTargetRequest,
    generated_at: DateTime<Utc>,
    files: &[LlmPromptFile],
    comment_count: usize,
) -> String {
    let mut output = String::new();
    output.push_str("# Spec Review LLM Prompt\n\n");
    output.push_str("You are helping review a Markdown specification. Use the Markdown context and unresolved comments below to propose concrete edits, answer open questions, and call out risks. Treat orphaned comments separately because their original anchor no longer resolves cleanly.\n\n");
    output.push_str("## Export Metadata\n\n");
    output.push_str(&format!("- Workspace: `{workspace_path}`\n"));
    output.push_str(&format!("- Scope: `{}`\n", format_prompt_target(target)));
    output.push_str(&format!("- Generated: `{}`\n", generated_at.to_rfc3339()));
    output.push_str(&format!("- Context files: `{}`\n", files.len()));
    output.push_str(&format!("- Unresolved comments: `{comment_count}`\n\n"));
    render_prompt_context(&mut output, files);
    render_prompt_comment_section(
        &mut output,
        "Unresolved Anchored Comments",
        files,
        PromptCommentKind::Anchored,
    );
    render_prompt_comment_section(
        &mut output,
        "Orphaned Comments",
        files,
        PromptCommentKind::Orphaned,
    );

    output
}

fn render_prompt_context(output: &mut String, files: &[LlmPromptFile]) {
    output.push_str("## Markdown Context\n\n");

    if files.is_empty() {
        output.push_str("No Markdown files were found for this prompt target.\n\n");
        return;
    }

    for file in files {
        output.push_str(&format!(
            "### {} / {} (`{}`)\n\n",
            file.spec_label,
            file.file_label,
            file.file_key.as_str()
        ));
        output.push_str(&format!("- Spec id: `{}`\n", file.spec_id));
        output.push_str(&format!("- Path: `{}`\n\n", file.markdown_path));

        match &file.markdown_contents {
            Some(contents) if !contents.trim().is_empty() => {
                output.push_str("````markdown\n");
                output.push_str(contents.trim());
                output.push_str("\n````\n\n");
            }
            Some(_) => output.push_str("_This Markdown file is empty._\n\n"),
            None => output.push_str("_This Markdown file is missing._\n\n"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PromptCommentKind {
    Anchored,
    Orphaned,
}

fn render_prompt_comment_section(
    output: &mut String,
    title: &str,
    files: &[LlmPromptFile],
    kind: PromptCommentKind,
) {
    output.push_str(&format!("## {title}\n\n"));
    let mut has_comments = false;

    for file in files {
        let comments = match kind {
            PromptCommentKind::Anchored => &file.unresolved_comments,
            PromptCommentKind::Orphaned => &file.orphaned_comments,
        };

        if comments.is_empty() {
            continue;
        }

        has_comments = true;
        output.push_str(&format!(
            "### {} / {} (`{}`)\n\n",
            file.spec_label,
            file.file_label,
            file.file_key.as_str()
        ));

        for comment in comments {
            output.push_str(&render_prompt_comment(comment, &file.spec_id));
        }
    }

    if !has_comments {
        output.push_str("No comments in this section.\n\n");
    }
}

fn render_prompt_comment(comment: &CommentResponse, spec_id: &str) -> String {
    let mut output = String::new();
    output.push_str(&format!("#### {}\n\n", comment.id));
    output.push_str(&format!("- Spec: `{spec_id}`\n"));
    output.push_str(&format!("- File: `{}`\n", comment.anchor.file_key));
    output.push_str(&format!(
        "- Anchor: `{}` block `{}` range `{}..{}`\n",
        comment.anchor.block_type,
        comment.anchor.block_index,
        comment.anchor.char_range.start,
        comment.anchor.char_range.end
    ));
    output.push_str(&format!(
        "- Anchor resolution: `{}`\n",
        format_anchor_state(comment.anchor_resolution.as_ref())
    ));

    if let Some(target) = comment
        .anchor_resolution
        .as_ref()
        .and_then(CommentAnchorResolutionResponse::target)
    {
        output.push_str(&format!(
            "- Resolved target: `{}` block `{}` score `{}`\n",
            target.block_type(),
            target.block_index(),
            target.score()
        ));
        output.push_str("- Resolved target snippet:\n\n");
        output.push_str(&format_blockquote(target.text_snippet()));
        output.push('\n');
    }

    output.push_str("- Original anchor snippet:\n\n");
    output.push_str(&format_blockquote(&comment.anchor.text_snippet));
    output.push_str("\n- Comment:\n\n");
    output.push_str(comment.body.trim());
    output.push_str("\n\n");

    output
}

fn format_prompt_target(target: &ExportCommentsTargetRequest) -> String {
    match target {
        ExportCommentsTargetRequest::File { spec_id, file_key } => {
            format!("file / {spec_id} / {file_key}")
        }
        ExportCommentsTargetRequest::Spec { spec_id } => format!("spec / {spec_id}"),
        ExportCommentsTargetRequest::Workspace => "workspace".to_string(),
    }
}

fn is_orphaned_comment(comment: &CommentResponse) -> bool {
    comment
        .anchor_resolution
        .as_ref()
        .is_some_and(|resolution| resolution.status() == "orphaned")
}

fn render_markdown_comment_export(
    title: &str,
    workspace_path: &str,
    generated_at: DateTime<Utc>,
    files: &[ExportedCommentFile],
    comment_count: usize,
) -> String {
    let mut output = String::new();
    output.push_str(&format!("# {title}\n\n"));
    output.push_str(&format!("- Workspace: `{workspace_path}`\n"));
    output.push_str(&format!("- Generated: `{}`\n", generated_at.to_rfc3339()));
    output.push_str(&format!("- Comment count: `{comment_count}`\n\n"));

    if comment_count == 0 {
        output.push_str("No comments were found for this export target.\n");
        return output;
    }

    for file in files.iter().filter(|file| !file.comments.is_empty()) {
        output.push_str(&format!(
            "## {} / {} ({})\n\n",
            file.spec_label,
            file.file_label,
            file.file_key.as_str()
        ));

        for comment in &file.comments {
            output.push_str(&render_markdown_comment(comment, &file.spec_id));
        }
    }

    output
}

fn render_markdown_comment(comment: &CommentResponse, spec_id: &str) -> String {
    let mut output = String::new();
    output.push_str(&format!(
        "### {} - {}\n\n",
        comment.id,
        format_title_case(&comment.status)
    ));
    output.push_str(&format!("- Spec: `{spec_id}`\n"));
    output.push_str(&format!("- File: `{}`\n", comment.anchor.file_key));
    output.push_str(&format!(
        "- Anchor: `{}` block `{}` range `{}..{}`\n",
        comment.anchor.block_type,
        comment.anchor.block_index,
        comment.anchor.char_range.start,
        comment.anchor.char_range.end
    ));
    output.push_str(&format!(
        "- Comment state: `{}`\n",
        format_title_case(&comment.status)
    ));
    output.push_str(&format!(
        "- Anchor state: `{}`\n",
        format_anchor_state(comment.anchor_resolution.as_ref())
    ));
    output.push_str(&format!(
        "- Created: `{}`\n",
        comment.created_at.to_rfc3339()
    ));
    output.push_str(&format!(
        "- Updated: `{}`\n\n",
        comment.updated_at.to_rfc3339()
    ));
    output.push_str("Anchor snippet:\n\n");
    output.push_str(&format_blockquote(&comment.anchor.text_snippet));
    output.push_str("\nComment:\n\n");
    output.push_str(comment.body.trim());
    output.push_str("\n\n");

    output
}

fn format_anchor_state(resolution: Option<&CommentAnchorResolutionResponse>) -> String {
    let Some(resolution) = resolution else {
        return "Unresolved".to_string();
    };
    let mut state = format_title_case(&resolution.status);
    state.push_str(" / ");
    state.push_str(&resolution.reason);

    if let Some(details) = &resolution.details {
        state.push_str(" - ");
        state.push_str(details);
    }

    state
}

fn format_blockquote(value: &str) -> String {
    value
        .lines()
        .map(|line| format!("> {line}\n"))
        .collect::<String>()
}

fn format_title_case(value: &str) -> String {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return String::new();
    };

    first.to_uppercase().chain(chars).collect()
}

fn build_workspace_json_export(
    workspace_path: &str,
    generated_at: DateTime<Utc>,
    files: &[ExportedCommentFile],
    comment_count: usize,
) -> ExportCommentsJsonDocument {
    let mut specs = Vec::<ExportCommentsJsonSpec>::new();

    for file in files {
        if file.comments.is_empty() {
            continue;
        }

        let json_file = ExportCommentsJsonFile {
            file_key: file.file_key.as_str().to_string(),
            file_label: file.file_label.clone(),
            comment_count: file.comments.len(),
            comments: file.comments.clone(),
        };

        match specs.iter_mut().find(|spec| spec.spec_id == file.spec_id) {
            Some(spec) => spec.files.push(json_file),
            None => specs.push(ExportCommentsJsonSpec {
                spec_id: file.spec_id.clone(),
                spec_label: file.spec_label.clone(),
                files: vec![json_file],
            }),
        }
    }

    ExportCommentsJsonDocument {
        version: 1,
        generated_at,
        target: ExportCommentsJsonTarget {
            scope: "workspace".to_string(),
            format: CommentExportFormat::Json.as_str().to_string(),
            spec_id: None,
            file_key: None,
        },
        workspace_path: workspace_path.to_string(),
        comment_count,
        specs,
    }
}

fn write_export_file(path: &str, contents: &str) -> CommandResult<()> {
    if path.trim().is_empty() {
        return Err(CommandError::invalid_request(
            "comment export destination path is required",
        ));
    }

    fs::write(Path::new(path), contents).map_err(|source| {
        CommandError::from(AppUseCaseError::CommentRepository {
            message: format!("failed to write comment export {path}: {source}"),
        })
    })
}

fn read_current_markdown_document(
    use_cases: &crate::app::use_cases::FilesystemAppUseCases,
    workspace: &crate::app::use_cases::LoadWorkspaceResult,
    spec_id: &str,
    file_key: SpecFileKey,
) -> CommandResult<PromptMarkdownDocument> {
    let result = use_cases
        .read_spec_file_cached(workspace, spec_id, file_key)
        .map_err(CommandError::from)?;

    match result {
        ReadSpecFileResult::Found(document) => Ok(PromptMarkdownDocument::from_found(document)),
        ReadSpecFileResult::Missing(missing) => {
            Ok(PromptMarkdownDocument::from_missing(missing.path()))
        }
    }
}

fn read_current_markdown_blocks(
    use_cases: &crate::app::use_cases::FilesystemAppUseCases,
    workspace: &crate::app::use_cases::LoadWorkspaceResult,
    spec_id: &str,
    file_key: SpecFileKey,
) -> CommandResult<Vec<MarkdownBlock>> {
    let result = use_cases
        .read_spec_file_cached(workspace, spec_id, file_key)
        .map_err(CommandError::from)?;

    match result {
        ReadSpecFileResult::Found(document) => Ok(document.blocks().to_vec()),
        ReadSpecFileResult::Missing(_) => Ok(Vec::new()),
    }
}

fn parse_spec_id(value: &str) -> Result<SpecId, AppUseCaseError> {
    SpecId::new(value).map_err(AppUseCaseError::from)
}

fn parse_comment_id(value: &str) -> Result<CommentId, AppUseCaseError> {
    CommentId::new(value).map_err(AppUseCaseError::from)
}

fn parse_comment_body(value: &str) -> Result<CommentBody, AppUseCaseError> {
    CommentBody::new(value).map_err(AppUseCaseError::from)
}

fn parse_file_key(value: &str) -> CommandResult<SpecFileKey> {
    SpecFileKey::from_str(value)
        .map_err(|_| CommandError::invalid_request(format!("unsupported file key: {value}")))
}

fn parse_status_filter(value: Option<&str>) -> CommandResult<CommentStatusFilter> {
    match value.unwrap_or("all") {
        "all" => Ok(CommentStatusFilter::All),
        "open" => Ok(CommentStatusFilter::Open),
        "resolved" => Ok(CommentStatusFilter::Resolved),
        unsupported => Err(CommandError::invalid_request(format!(
            "unsupported comment status filter: {unsupported}"
        ))),
    }
}

fn parse_block_type(value: &str) -> CommandResult<BlockType> {
    match value {
        "paragraph" => Ok(BlockType::Paragraph),
        "heading" => Ok(BlockType::Heading),
        "list_item" => Ok(BlockType::ListItem),
        "code_block" => Ok(BlockType::CodeBlock),
        "block_quote" => Ok(BlockType::BlockQuote),
        "table" => Ok(BlockType::Table),
        "thematic_break" => Ok(BlockType::ThematicBreak),
        "html" => Ok(BlockType::Html),
        "other" => Ok(BlockType::Other),
        unsupported => Err(CommandError::invalid_request(format!(
            "unsupported comment anchor block type: {unsupported}"
        ))),
    }
}

fn block_type_to_response(block_type: BlockType) -> &'static str {
    match block_type {
        BlockType::Paragraph => "paragraph",
        BlockType::Heading => "heading",
        BlockType::ListItem => "list_item",
        BlockType::CodeBlock => "code_block",
        BlockType::BlockQuote => "block_quote",
        BlockType::Table => "table",
        BlockType::ThematicBreak => "thematic_break",
        BlockType::Html => "html",
        BlockType::Other => "other",
    }
}

fn status_to_response(status: CommentStatus) -> &'static str {
    match status {
        CommentStatus::Open => "open",
        CommentStatus::Resolved => "resolved",
    }
}

fn anchor_resolution_status_to_response(status: AnchorResolutionStatus) -> &'static str {
    match status {
        AnchorResolutionStatus::Resolved => "resolved",
        AnchorResolutionStatus::Moved => "moved",
        AnchorResolutionStatus::Fuzzy => "fuzzy",
        AnchorResolutionStatus::Orphaned => "orphaned",
    }
}

fn anchor_resolution_reason_to_response(reason: AnchorResolutionReason) -> &'static str {
    match reason {
        AnchorResolutionReason::ExactMatch => "exact_match",
        AnchorResolutionReason::MovedByHash => "moved_by_hash",
        AnchorResolutionReason::StaleSnippet => "stale_snippet",
        AnchorResolutionReason::FuzzyMatch => "fuzzy_match",
        AnchorResolutionReason::MissingOriginalBlock => "missing_original_block",
        AnchorResolutionReason::AmbiguousFuzzyCandidates => "ambiguous_fuzzy_candidates",
        AnchorResolutionReason::BelowThreshold => "below_threshold",
        AnchorResolutionReason::DeletedText => "deleted_text",
        AnchorResolutionReason::UnsupportedBlockType => "unsupported_block_type",
    }
}

fn create_block_text_snippet(text: &str) -> String {
    const MAX_BLOCK_TEXT_SNIPPET_LENGTH: usize = 160;

    text.chars().take(MAX_BLOCK_TEXT_SNIPPET_LENGTH).collect()
}

fn invalid_comment(error: CommentDomainError) -> CommandError {
    CommandError::from(AppUseCaseError::from(error))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::comment::{CommentBody, CommentId, CommentRepositoryError};

    fn timestamp(second: u32) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(&format!("2026-05-05T10:00:{second:02}Z"))
            .expect("timestamp should parse")
            .with_timezone(&Utc)
    }

    fn anchor(file_key: SpecFileKey, block_type: BlockType) -> CommentAnchor {
        CommentAnchor::new(
            file_key,
            block_type,
            BlockIndex::new(3),
            TextHash::new("sha256_prefix_8chars").expect("hash should be valid"),
            TextSnippet::new("JWT token").expect("snippet should be valid"),
            CharRange::new(12, 24).expect("range should be valid"),
        )
    }

    #[test]
    fn comment_response_keeps_domain_details_in_frontend_safe_shape() {
        let comment = Comment::restore(
            CommentId::new("cmt_1").expect("id should be valid"),
            anchor(SpecFileKey::Impl, BlockType::CodeBlock),
            CommentBody::new("Define refresh token expiry").expect("body should be valid"),
            CommentStatus::Resolved,
            timestamp(1),
            timestamp(2),
        )
        .expect("comment should be valid");

        let response = CommentResponse::from(&comment);

        assert_eq!("cmt_1", response.id());
        assert_eq!("impl", response.anchor().file_key());
        assert_eq!("code_block", response.anchor().block_type());
        assert_eq!(3, response.anchor().block_index());
        assert_eq!("sha256_prefix_8chars", response.anchor().text_hash());
        assert_eq!("JWT token", response.anchor().text_snippet());
        assert_eq!(12, response.anchor().char_range().start());
        assert_eq!(24, response.anchor().char_range().end());
        assert_eq!("Define refresh token expiry", response.body());
        assert_eq!("resolved", response.status());
        assert!(response.resolved());
        assert_eq!(timestamp(1), response.created_at());
        assert_eq!(timestamp(2), response.updated_at());
    }

    #[test]
    fn list_comments_response_wraps_comment_responses() {
        let comment = Comment::new(
            CommentId::new("cmt_1").expect("id should be valid"),
            anchor(SpecFileKey::Tasks, BlockType::Paragraph),
            CommentBody::new("Clarify this task").expect("body should be valid"),
            timestamp(1),
            timestamp(1),
        )
        .expect("comment should be valid");

        let response = ListCommentsResponse {
            comments: vec![CommentResponse::from(&comment)],
        };

        assert_eq!(1, response.comments().len());
        assert_eq!("cmt_1", response.comments()[0].id());
        assert_eq!("tasks", response.comments()[0].anchor().file_key());
        assert_eq!("open", response.comments()[0].status());
        assert!(!response.comments()[0].resolved());
    }

    #[test]
    fn markdown_export_includes_comment_and_anchor_states() {
        let comment = CommentResponse {
            id: "cmt_orphaned".to_string(),
            anchor: CommentAnchorResponse::from(&anchor(SpecFileKey::Tasks, BlockType::Paragraph)),
            body: "Explain what happens when the source paragraph is deleted.".to_string(),
            status: "resolved".to_string(),
            resolved: true,
            anchor_resolution: Some(CommentAnchorResolutionResponse {
                status: "orphaned".to_string(),
                reason: "deleted_text".to_string(),
                details: Some(
                    "original block is still present, but selected text could not be found"
                        .to_string(),
                ),
                target: None,
            }),
            created_at: timestamp(1),
            updated_at: timestamp(2),
        };
        let file = ExportedCommentFile {
            spec_id: "review-flow".to_string(),
            spec_label: "Review Flow".to_string(),
            file_key: SpecFileKey::Tasks,
            file_label: "Tasks".to_string(),
            comments: vec![comment],
        };

        let markdown = render_markdown_comment_export(
            "Current File Comments",
            "/workspace/project",
            timestamp(3),
            &[file],
            1,
        );

        assert!(markdown.contains("# Current File Comments"));
        assert!(markdown.contains("- Comment state: `Resolved`"));
        assert!(markdown.contains("- Anchor state: `Orphaned / deleted_text"));
        assert!(markdown.contains("Explain what happens when the source paragraph is deleted."));
    }

    #[test]
    fn workspace_json_export_groups_comments_by_spec_and_file() {
        let comment = CommentResponse::from(
            &Comment::new(
                CommentId::new("cmt_json").expect("id should be valid"),
                anchor(SpecFileKey::Impl, BlockType::CodeBlock),
                CommentBody::new("Keep this in the workspace export")
                    .expect("body should be valid"),
                timestamp(1),
                timestamp(1),
            )
            .expect("comment should be valid"),
        );
        let file = ExportedCommentFile {
            spec_id: "auth-flow".to_string(),
            spec_label: "Auth Flow".to_string(),
            file_key: SpecFileKey::Impl,
            file_label: "Implementation".to_string(),
            comments: vec![comment],
        };

        let document = build_workspace_json_export("/workspace/project", timestamp(2), &[file], 1);
        let value = serde_json::to_value(document).expect("export document should serialize");

        assert_eq!(1, value["commentCount"]);
        assert_eq!("workspace", value["target"]["scope"]);
        assert_eq!("auth-flow", value["specs"][0]["specId"]);
        assert_eq!("impl", value["specs"][0]["files"][0]["fileKey"]);
        assert_eq!(
            "cmt_json",
            value["specs"][0]["files"][0]["comments"][0]["id"]
        );
    }

    #[test]
    fn llm_prompt_includes_markdown_context_and_separates_orphaned_comments() {
        let anchored_comment = CommentResponse::from(
            &Comment::new(
                CommentId::new("cmt_open").expect("id should be valid"),
                anchor(SpecFileKey::Tasks, BlockType::Paragraph),
                CommentBody::new("Clarify the acceptance criteria").expect("body should be valid"),
                timestamp(1),
                timestamp(1),
            )
            .expect("comment should be valid"),
        );
        let orphaned_comment = CommentResponse {
            id: "cmt_orphaned".to_string(),
            anchor: CommentAnchorResponse::from(&anchor(SpecFileKey::Tasks, BlockType::Paragraph)),
            body: "Recover this deleted note before asking the LLM.".to_string(),
            status: "open".to_string(),
            resolved: false,
            anchor_resolution: Some(CommentAnchorResolutionResponse {
                status: "orphaned".to_string(),
                reason: "deleted_text".to_string(),
                details: None,
                target: None,
            }),
            created_at: timestamp(1),
            updated_at: timestamp(1),
        };
        let file = LlmPromptFile {
            spec_id: "review-flow".to_string(),
            spec_label: "Review Flow".to_string(),
            file_key: SpecFileKey::Tasks,
            file_label: "Tasks".to_string(),
            markdown_path: "/workspace/project/tasks.md".to_string(),
            markdown_contents: Some("# Tasks\n\n- Ship prompt export".to_string()),
            unresolved_comments: vec![anchored_comment],
            orphaned_comments: vec![orphaned_comment],
        };

        let prompt = render_llm_prompt(
            "/workspace/project",
            &ExportCommentsTargetRequest::File {
                spec_id: "review-flow".to_string(),
                file_key: "tasks".to_string(),
            },
            timestamp(2),
            &[file],
            2,
        );

        assert!(prompt.contains("# Spec Review LLM Prompt"));
        assert!(prompt.contains("````markdown\n# Tasks\n\n- Ship prompt export\n````"));
        assert!(prompt.contains("## Unresolved Anchored Comments"));
        assert!(prompt.contains("#### cmt_open"));
        assert!(prompt.contains("## Orphaned Comments"));
        assert!(prompt.contains("#### cmt_orphaned"));
        assert!(prompt.contains("Anchor resolution: `Orphaned / deleted_text`"));
    }

    #[test]
    fn anchor_resolution_status_and_reason_use_frontend_labels() {
        assert_eq!(
            "resolved",
            anchor_resolution_status_to_response(AnchorResolutionStatus::Resolved)
        );
        assert_eq!(
            "moved",
            anchor_resolution_status_to_response(AnchorResolutionStatus::Moved)
        );
        assert_eq!(
            "fuzzy",
            anchor_resolution_status_to_response(AnchorResolutionStatus::Fuzzy)
        );
        assert_eq!(
            "orphaned",
            anchor_resolution_status_to_response(AnchorResolutionStatus::Orphaned)
        );
        assert_eq!(
            "exact_match",
            anchor_resolution_reason_to_response(AnchorResolutionReason::ExactMatch)
        );
        assert_eq!(
            "stale_snippet",
            anchor_resolution_reason_to_response(AnchorResolutionReason::StaleSnippet)
        );
        assert_eq!(
            "ambiguous_fuzzy_candidates",
            anchor_resolution_reason_to_response(AnchorResolutionReason::AmbiguousFuzzyCandidates)
        );
    }

    #[test]
    fn comment_command_error_serializes_known_codes() {
        let cases = [
            (CommentCommandErrorCode::InvalidRequest, "invalidRequest"),
            (
                CommentCommandErrorCode::WorkspaceDetection,
                "workspaceDetection",
            ),
            (CommentCommandErrorCode::ConfigLoad, "configLoad"),
            (CommentCommandErrorCode::MarkdownRead, "markdownRead"),
            (CommentCommandErrorCode::InvalidComment, "invalidComment"),
            (
                CommentCommandErrorCode::CommentRepository,
                "commentRepository",
            ),
            (CommentCommandErrorCode::Unexpected, "unexpected"),
        ];

        for (code, expected_code) in cases {
            let value = serde_json::to_value(CommentCommandError::new(code, "failure"))
                .expect("error should serialize");

            assert_eq!(expected_code, value["code"]);
            assert_eq!("failure", value["message"]);
        }
    }

    #[test]
    fn comment_command_error_maps_command_error_codes() {
        let error = CommentCommandError::from_command_error(CommandError::invalid_request(
            "unsupported file key: notes",
        ));

        assert_eq!(CommentCommandErrorCode::InvalidRequest, error.code());
    }

    #[test]
    fn comment_command_error_maps_timestamp_rollback_to_compatible_invalid_comment_error() {
        let error = CommentCommandError::from(AppUseCaseError::from(
            CommentDomainError::UpdatedAtRollback {
                current: timestamp(6),
                attempted: timestamp(5),
            },
        ));

        let value = serde_json::to_value(error).expect("error should serialize");

        assert_eq!("invalidComment", value["code"]);
        assert_eq!(
            "invalid comment input: comment updated timestamp 2026-05-05 10:00:05 UTC cannot be before current updated timestamp 2026-05-05 10:00:06 UTC",
            value["message"]
        );
    }

    #[test]
    fn comment_command_error_maps_persisted_timestamp_conflict_to_repository_error() {
        let error =
            CommentCommandError::from(AppUseCaseError::from(CommentRepositoryError::stale_update(
                CommentId::new("cmt_1").expect("id should be valid"),
                timestamp(6),
                timestamp(5),
            )));

        let value = serde_json::to_value(error).expect("error should serialize");

        assert_eq!("commentRepository", value["code"]);
        assert_eq!(
            "failed to persist comments: comment update 2026-05-05 10:00:05 UTC is older than persisted timestamp 2026-05-05 10:00:06 UTC for cmt_1",
            value["message"]
        );
    }

    #[test]
    fn add_comment_command_error_maps_invalid_comment_command_error() {
        let error = AddCommentCommandError::from_command_error(CommandError::from(
            AppUseCaseError::InvalidComment {
                message: "anchor text hash is empty".to_string(),
            },
        ));

        assert_eq!(AddCommentCommandErrorCode::InvalidComment, error.code());
        assert_eq!(
            "invalid comment input: anchor text hash is empty",
            error.message()
        );
    }

    #[test]
    fn add_comment_command_error_serializes_known_codes() {
        let cases = [
            (AddCommentCommandErrorCode::InvalidComment, "invalidComment"),
            (
                AddCommentCommandErrorCode::CommentRepository,
                "commentRepository",
            ),
            (
                AddCommentCommandErrorCode::WorkspaceDetection,
                "workspaceDetection",
            ),
            (AddCommentCommandErrorCode::ConfigLoad, "configLoad"),
            (AddCommentCommandErrorCode::Unexpected, "unexpected"),
        ];

        for (code, expected_code) in cases {
            let error = AddCommentCommandError::new(code, "mapped failure");
            let value = serde_json::to_value(error).expect("error should serialize");

            assert_eq!(expected_code, value["code"]);
            assert_eq!("mapped failure", value["message"]);
        }
    }

    #[test]
    fn add_comment_command_error_maps_app_use_case_errors() {
        let cases = [
            (
                AppUseCaseError::InvalidSpec {
                    message: "unsafe spec id".to_string(),
                },
                AddCommentCommandErrorCode::InvalidRequest,
            ),
            (
                AppUseCaseError::InvalidComment {
                    message: "comment body is required".to_string(),
                },
                AddCommentCommandErrorCode::InvalidComment,
            ),
            (
                AppUseCaseError::CommentRepository {
                    message: "comments json is locked".to_string(),
                },
                AddCommentCommandErrorCode::CommentRepository,
            ),
            (
                AppUseCaseError::WorkspaceDetection {
                    message: "missing workspace".to_string(),
                },
                AddCommentCommandErrorCode::WorkspaceDetection,
            ),
            (
                AppUseCaseError::ConfigLoad {
                    message: "invalid config".to_string(),
                },
                AddCommentCommandErrorCode::ConfigLoad,
            ),
            (
                AppUseCaseError::MarkdownRead {
                    message: "unexpected dependency error".to_string(),
                },
                AddCommentCommandErrorCode::Unexpected,
            ),
        ];

        for (app_error, expected_code) in cases {
            let error = AddCommentCommandError::from_app_error(app_error);

            assert_eq!(expected_code, error.code());
        }
    }

    #[test]
    fn comment_command_error_maps_invalid_spec_to_invalid_request() {
        let error = CommentCommandError::from_app_error(AppUseCaseError::InvalidSpec {
            message: "unsafe spec id".to_string(),
        });

        assert_eq!(CommentCommandErrorCode::InvalidRequest, error.code());
        assert_eq!("invalid spec input: unsafe spec id", error.message);
    }

    #[test]
    fn add_comment_anchor_request_converts_to_domain_anchor() {
        let request = CommentAnchorRequest {
            file_key: "impl".to_string(),
            block_type: "heading".to_string(),
            block_index: 2,
            text_hash: "hash".to_string(),
            text_snippet: "Selected text".to_string(),
            char_range: CharRangeDto { start: 4, end: 17 },
        };

        let anchor = request.into_domain().expect("anchor should be valid");

        assert_eq!(SpecFileKey::Impl, anchor.file_key());
        assert_eq!(BlockType::Heading, anchor.block_type());
        assert_eq!(2, anchor.block_index().value());
        assert_eq!("hash", anchor.text_hash().as_str());
        assert_eq!("Selected text", anchor.text_snippet().as_str());
        assert_eq!(4, anchor.char_range().start());
        assert_eq!(17, anchor.char_range().end());
    }

    #[test]
    fn add_comment_anchor_request_rejects_unsupported_block_type() {
        let request = CommentAnchorRequest {
            file_key: "impl".to_string(),
            block_type: "diagram".to_string(),
            block_index: 2,
            text_hash: "hash".to_string(),
            text_snippet: "Selected text".to_string(),
            char_range: CharRangeDto { start: 4, end: 17 },
        };

        let error = request
            .into_domain()
            .expect_err("block type should be rejected");

        assert_eq!("invalidRequest", error.code());
        assert_eq!(
            "unsupported comment anchor block type: diagram",
            error.message()
        );
    }

    #[test]
    fn parse_status_filter_defaults_to_all_and_accepts_known_values() {
        assert_eq!(
            CommentStatusFilter::All,
            parse_status_filter(None).expect("default should parse")
        );
        assert_eq!(
            CommentStatusFilter::Open,
            parse_status_filter(Some("open")).expect("open should parse")
        );
        assert_eq!(
            CommentStatusFilter::Resolved,
            parse_status_filter(Some("resolved")).expect("resolved should parse")
        );
    }

    #[test]
    fn parse_status_filter_rejects_unknown_values() {
        let error = parse_status_filter(Some("closed")).expect_err("status should be rejected");

        assert_eq!("invalidRequest", error.code());
        assert_eq!("unsupported comment status filter: closed", error.message());
    }

    #[test]
    fn presentation_parsers_preserve_comment_ipc_error_codes() {
        let spec_error = parse_spec_id("../secret").expect_err("unsafe spec id should fail");
        let general_error = CommandError::from(spec_error.clone());
        let comment_error = CommentCommandError::from_app_error(spec_error);

        assert_eq!("invalidSpec", general_error.code());
        assert_eq!(
            CommentCommandErrorCode::InvalidRequest,
            comment_error.code()
        );

        let id_error = parse_comment_id("   ").expect_err("missing comment id should fail");
        let value = serde_json::to_value(CommentCommandError::from_app_error(id_error))
            .expect("error should serialize");

        assert_eq!("invalidComment", value["code"]);

        let body_error = parse_comment_body("   ").expect_err("missing comment body should fail");
        let value = serde_json::to_value(AddCommentCommandError::from_app_error(body_error))
            .expect("error should serialize");

        assert_eq!("invalidComment", value["code"]);
    }

    #[test]
    fn comment_command_error_keeps_invalid_spec_compatibility_through_command_error() {
        let error = CommentCommandError::from_command_error(CommandError::from(
            parse_spec_id("../secret").expect_err("unsafe spec id should fail"),
        ));

        assert_eq!(CommentCommandErrorCode::InvalidRequest, error.code());
    }

    #[test]
    fn delete_comment_response_confirms_delete_action() {
        let response = DeleteCommentResponse { deleted: true };

        assert!(response.deleted());
    }
}
