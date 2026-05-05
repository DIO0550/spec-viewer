//! Comment command DTOs and handlers.

use std::str::FromStr;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app::use_cases::AppUseCaseError,
    domain::{
        comment::{
            BlockIndex, BlockType, CharRange, Comment, CommentAnchor, CommentDomainError,
            CommentStatus, CommentStatusFilter, TextHash, TextSnippet,
        },
        spec::SpecFileKey,
    },
};

use super::{CommandError, CommandResult, CommandState};

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCommentsRequest {
    workspace_path: String,
    spec_id: String,
    file_key: String,
    status_filter: Option<String>,
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

impl DeleteCommentResponse {
    pub fn deleted(&self) -> bool {
        self.deleted
    }
}

#[tauri::command]
pub fn list_comments(
    state: State<'_, CommandState>,
    request: ListCommentsRequest,
) -> CommandResult<ListCommentsResponse> {
    let file_key = parse_file_key(&request.file_key)?;
    let status_filter = parse_status_filter(request.status_filter.as_deref())?;
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let comments = state
        .use_cases()
        .comment_use_cases(&workspace)
        .list_comments(&request.spec_id, file_key, status_filter)?;

    Ok(ListCommentsResponse::from(comments))
}

#[tauri::command]
pub fn add_comment(
    state: State<'_, CommandState>,
    request: AddCommentRequest,
) -> CommandResult<CommentResponse> {
    let anchor = request.anchor.into_domain()?;
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let comment = state
        .use_cases()
        .comment_use_cases(&workspace)
        .add_comment(&request.spec_id, anchor, request.body)?;

    Ok(CommentResponse::from(&comment))
}

#[tauri::command]
pub fn update_comment(
    state: State<'_, CommandState>,
    request: UpdateCommentRequest,
) -> CommandResult<CommentResponse> {
    let file_key = parse_file_key(&request.file_key)?;
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let comment = state
        .use_cases()
        .comment_use_cases(&workspace)
        .update_comment(
            &request.spec_id,
            file_key,
            &request.comment_id,
            request.body,
        )?;

    Ok(CommentResponse::from(&comment))
}

#[tauri::command]
pub fn delete_comment(
    state: State<'_, CommandState>,
    request: DeleteCommentRequest,
) -> CommandResult<DeleteCommentResponse> {
    let file_key = parse_file_key(&request.file_key)?;
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;

    state
        .use_cases()
        .comment_use_cases(&workspace)
        .delete_comment(&request.spec_id, file_key, &request.comment_id)?;

    Ok(DeleteCommentResponse { deleted: true })
}

#[tauri::command]
pub fn resolve_comment(
    state: State<'_, CommandState>,
    request: CommentStatusRequest,
) -> CommandResult<CommentResponse> {
    update_comment_status(state, request, CommentStatusAction::Resolve)
}

#[tauri::command]
pub fn reopen_comment(
    state: State<'_, CommandState>,
    request: CommentStatusRequest,
) -> CommandResult<CommentResponse> {
    update_comment_status(state, request, CommentStatusAction::Reopen)
}

#[tauri::command]
pub fn toggle_comment_resolved(
    state: State<'_, CommandState>,
    request: CommentStatusRequest,
) -> CommandResult<CommentResponse> {
    update_comment_status(state, request, CommentStatusAction::Toggle)
}

impl From<Vec<Comment>> for ListCommentsResponse {
    fn from(comments: Vec<Comment>) -> Self {
        Self {
            comments: comments.iter().map(CommentResponse::from).collect(),
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
            created_at: comment.created_at(),
            updated_at: comment.updated_at(),
        }
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

fn update_comment_status(
    state: State<'_, CommandState>,
    request: CommentStatusRequest,
    action: CommentStatusAction,
) -> CommandResult<CommentResponse> {
    let file_key = parse_file_key(&request.file_key)?;
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let comment_use_cases = state.use_cases().comment_use_cases(&workspace);
    let comment = match action {
        CommentStatusAction::Resolve => {
            comment_use_cases.resolve_comment(&request.spec_id, file_key, &request.comment_id)?
        }
        CommentStatusAction::Reopen => {
            comment_use_cases.reopen_comment(&request.spec_id, file_key, &request.comment_id)?
        }
        CommentStatusAction::Toggle => comment_use_cases.toggle_comment_resolved(
            &request.spec_id,
            file_key,
            &request.comment_id,
        )?,
    };

    Ok(CommentResponse::from(&comment))
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

fn invalid_comment(error: CommentDomainError) -> CommandError {
    CommandError::from(AppUseCaseError::from(error))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::comment::{CommentBody, CommentId};

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

        let response = ListCommentsResponse::from(vec![comment]);

        assert_eq!(1, response.comments().len());
        assert_eq!("cmt_1", response.comments()[0].id());
        assert_eq!("tasks", response.comments()[0].anchor().file_key());
        assert_eq!("open", response.comments()[0].status());
        assert!(!response.comments()[0].resolved());
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
    fn delete_comment_response_confirms_delete_action() {
        let response = DeleteCommentResponse { deleted: true };

        assert!(response.deleted());
    }
}
