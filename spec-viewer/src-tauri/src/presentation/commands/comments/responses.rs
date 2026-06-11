//! Comment command response DTOs and domain-to-DTO conversions.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::{
    app::use_cases::{
        CommentAnchorResolution, CommentAnchorResolutionTarget, ExportCommentsResult,
    },
    domain::{
        comment::{Comment, CommentAnchor, LlmPrompt},
        spec::MarkdownBlockSourceRange,
    },
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCommentsResponse {
    pub(super) comments: Vec<CommentResponse>,
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

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CharRangeDto {
    start: usize,
    end: usize,
}

impl CharRangeDto {
    #[cfg(test)]
    pub(super) fn new(start: usize, end: usize) -> Self {
        Self { start, end }
    }

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
    pub(super) deleted: bool,
}

impl DeleteCommentResponse {
    pub fn deleted(&self) -> bool {
        self.deleted
    }
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
            status: comment.status().as_str().to_string(),
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
            block_type: anchor.block_type().as_str().to_string(),
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
            status: resolution.status().as_str().to_string(),
            reason: resolution.reason().as_str().to_string(),
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

impl From<ExportCommentsResult> for ExportCommentsResponse {
    fn from(result: ExportCommentsResult) -> Self {
        Self {
            destination_path: result.destination_path().to_string(),
            format: result.format().as_str().to_string(),
            comment_count: result.comment_count(),
        }
    }
}

impl From<LlmPrompt> for GenerateLlmPromptResponse {
    fn from(prompt: LlmPrompt) -> Self {
        Self {
            comment_count: prompt.comment_count(),
            context_file_count: prompt.context_file_count(),
            prompt: prompt.prompt().to_string(),
        }
    }
}

fn create_block_text_snippet(text: &str) -> String {
    const MAX_BLOCK_TEXT_SNIPPET_LENGTH: usize = 160;

    text.chars().take(MAX_BLOCK_TEXT_SNIPPET_LENGTH).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::comment::{
        BlockIndex, BlockType, CharRange, CommentBody, CommentId, CommentStatus, TextHash,
        TextSnippet,
    };
    use crate::domain::spec::SpecFileKey;

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
    fn delete_comment_response_confirms_delete_action() {
        let response = DeleteCommentResponse { deleted: true };

        assert!(response.deleted());
    }
}
