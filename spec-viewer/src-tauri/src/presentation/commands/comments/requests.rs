//! Comment command request DTOs and request-to-domain conversions.

use std::str::FromStr;

use serde::Deserialize;

use crate::{
    app::use_cases::AppUseCaseError,
    domain::{
        comment::{
            BlockIndex, BlockType, CharRange, CommentAnchor, CommentDomainError,
            CommentExportTarget, CommentStatusFilter, TextHash, TextSnippet,
        },
        spec::SpecFileKey,
    },
};

use super::super::{CommandError, CommandResult};
use super::responses::CharRangeDto;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCommentsRequest {
    pub(super) workspace_path: String,
    pub(super) spec_id: String,
    pub(super) file_key: String,
    pub(super) status_filter: Option<String>,
    pub(super) correlation_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddCommentRequest {
    pub(super) workspace_path: String,
    pub(super) spec_id: String,
    pub(super) anchor: CommentAnchorRequest,
    pub(super) body: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCommentRequest {
    pub(super) workspace_path: String,
    pub(super) spec_id: String,
    pub(super) file_key: String,
    pub(super) comment_id: String,
    pub(super) body: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCommentRequest {
    pub(super) workspace_path: String,
    pub(super) spec_id: String,
    pub(super) file_key: String,
    pub(super) comment_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentStatusRequest {
    pub(super) workspace_path: String,
    pub(super) spec_id: String,
    pub(super) file_key: String,
    pub(super) comment_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportCommentsRequest {
    pub(super) workspace_path: String,
    pub(super) target: ExportCommentsTargetRequest,
    pub(super) destination_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateLlmPromptRequest {
    pub(super) workspace_path: String,
    pub(super) target: ExportCommentsTargetRequest,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(tag = "scope", rename_all = "camelCase")]
pub enum ExportCommentsTargetRequest {
    File { spec_id: String, file_key: String },
    Spec { spec_id: String },
    Workspace,
}

impl ExportCommentsTargetRequest {
    pub(super) fn into_domain(self) -> CommandResult<CommentExportTarget> {
        match self {
            Self::File { spec_id, file_key } => Ok(CommentExportTarget::File {
                spec_id,
                file_key: parse_file_key(&file_key)?,
            }),
            Self::Spec { spec_id } => Ok(CommentExportTarget::Spec { spec_id }),
            Self::Workspace => Ok(CommentExportTarget::Workspace),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentAnchorRequest {
    pub(super) file_key: String,
    pub(super) block_type: String,
    pub(super) block_index: usize,
    pub(super) text_hash: String,
    pub(super) text_snippet: String,
    pub(super) char_range: CharRangeDto,
}

impl CommentAnchorRequest {
    pub(super) fn into_domain(self) -> CommandResult<CommentAnchor> {
        let file_key = parse_file_key(&self.file_key)?;
        let block_type = parse_block_type(&self.block_type)?;
        let char_range = CharRange::new(self.char_range.start(), self.char_range.end())
            .map_err(invalid_comment)?;

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

pub(super) fn parse_file_key(value: &str) -> CommandResult<SpecFileKey> {
    SpecFileKey::from_str(value)
        .map_err(|_| CommandError::invalid_request(format!("unsupported file key: {value}")))
}

pub(super) fn parse_status_filter(value: Option<&str>) -> CommandResult<CommentStatusFilter> {
    match value.unwrap_or("all") {
        "all" => Ok(CommentStatusFilter::All),
        "open" => Ok(CommentStatusFilter::Open),
        "resolved" => Ok(CommentStatusFilter::Resolved),
        unsupported => Err(CommandError::invalid_request(format!(
            "unsupported comment status filter: {unsupported}"
        ))),
    }
}

pub(super) fn parse_block_type(value: &str) -> CommandResult<BlockType> {
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

fn invalid_comment(error: CommentDomainError) -> CommandError {
    CommandError::from(AppUseCaseError::from(error))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_comment_anchor_request_converts_to_domain_anchor() {
        let request = CommentAnchorRequest {
            file_key: "impl".to_string(),
            block_type: "heading".to_string(),
            block_index: 2,
            text_hash: "hash".to_string(),
            text_snippet: "Selected text".to_string(),
            char_range: CharRangeDto::new(4, 17),
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
            char_range: CharRangeDto::new(4, 17),
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
}
