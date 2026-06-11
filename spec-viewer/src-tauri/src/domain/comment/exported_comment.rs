//! Serializable comment documents shared by comment exports and LLM prompts.

use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::domain::spec::MarkdownBlockSourceRange;

use super::{Comment, CommentAnchor, CommentAnchorResolution, CommentAnchorResolutionTarget};

/// Frontend-shaped comment document embedded in exports and prompts.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportedComment {
    pub(crate) id: String,
    pub(crate) anchor: ExportedCommentAnchor,
    pub(crate) body: String,
    pub(crate) status: String,
    pub(crate) resolved: bool,
    pub(crate) anchor_resolution: Option<ExportedAnchorResolution>,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

impl ExportedComment {
    pub fn from_comment(comment: &Comment) -> Self {
        Self {
            id: comment.id().as_str().to_string(),
            anchor: ExportedCommentAnchor::from_anchor(comment.anchor()),
            body: comment.body().as_str().to_string(),
            status: comment.status().as_str().to_string(),
            resolved: comment.is_resolved(),
            anchor_resolution: None,
            created_at: comment.created_at(),
            updated_at: comment.updated_at(),
        }
    }

    pub fn from_resolution(resolution: &CommentAnchorResolution) -> Self {
        let mut exported = Self::from_comment(resolution.comment());
        exported.anchor_resolution = Some(ExportedAnchorResolution::from_resolution(resolution));

        exported
    }

    /// Reports whether the comment anchor no longer resolves cleanly.
    pub fn is_orphaned(&self) -> bool {
        self.anchor_resolution
            .as_ref()
            .is_some_and(|resolution| resolution.status == "orphaned")
    }

    /// Renders the Markdown export section for this comment.
    pub fn render_markdown(&self, spec_id: &str) -> String {
        let mut output = String::new();
        output.push_str(&format!(
            "### {} - {}\n\n",
            self.id,
            Self::title_case(&self.status)
        ));
        output.push_str(&format!("- Spec: `{spec_id}`\n"));
        output.push_str(&format!("- File: `{}`\n", self.anchor.file_key));
        output.push_str(&format!(
            "- Anchor: `{}` block `{}` range `{}..{}`\n",
            self.anchor.block_type,
            self.anchor.block_index,
            self.anchor.char_range.start,
            self.anchor.char_range.end
        ));
        output.push_str(&format!(
            "- Comment state: `{}`\n",
            Self::title_case(&self.status)
        ));
        output.push_str(&format!(
            "- Anchor state: `{}`\n",
            self.anchor_state_label()
        ));
        output.push_str(&format!("- Created: `{}`\n", self.created_at.to_rfc3339()));
        output.push_str(&format!(
            "- Updated: `{}`\n\n",
            self.updated_at.to_rfc3339()
        ));
        output.push_str("Anchor snippet:\n\n");
        output.push_str(&Self::blockquote(&self.anchor.text_snippet));
        output.push_str("\nComment:\n\n");
        output.push_str(self.body.trim());
        output.push_str("\n\n");

        output
    }

    /// Renders the LLM prompt section for this comment.
    pub fn render_prompt(&self, spec_id: &str) -> String {
        let mut output = String::new();
        output.push_str(&format!("#### {}\n\n", self.id));
        output.push_str(&format!("- Spec: `{spec_id}`\n"));
        output.push_str(&format!("- File: `{}`\n", self.anchor.file_key));
        output.push_str(&format!(
            "- Anchor: `{}` block `{}` range `{}..{}`\n",
            self.anchor.block_type,
            self.anchor.block_index,
            self.anchor.char_range.start,
            self.anchor.char_range.end
        ));
        output.push_str(&format!(
            "- Anchor resolution: `{}`\n",
            self.anchor_state_label()
        ));

        if let Some(target) = self
            .anchor_resolution
            .as_ref()
            .and_then(|resolution| resolution.target.as_ref())
        {
            output.push_str(&format!(
                "- Resolved target: `{}` block `{}` score `{}`\n",
                target.block_type, target.block_index, target.score
            ));
            output.push_str("- Resolved target snippet:\n\n");
            output.push_str(&Self::blockquote(&target.text_snippet));
            output.push('\n');
        }

        output.push_str("- Original anchor snippet:\n\n");
        output.push_str(&Self::blockquote(&self.anchor.text_snippet));
        output.push_str("\n- Comment:\n\n");
        output.push_str(self.body.trim());
        output.push_str("\n\n");

        output
    }

    fn anchor_state_label(&self) -> String {
        let Some(resolution) = self.anchor_resolution.as_ref() else {
            return "Unresolved".to_string();
        };
        let mut state = Self::title_case(&resolution.status);
        state.push_str(" / ");
        state.push_str(&resolution.reason);

        if let Some(details) = &resolution.details {
            state.push_str(" - ");
            state.push_str(details);
        }

        state
    }

    fn blockquote(value: &str) -> String {
        value
            .lines()
            .map(|line| format!("> {line}\n"))
            .collect::<String>()
    }

    fn title_case(value: &str) -> String {
        let mut chars = value.chars();
        let Some(first) = chars.next() else {
            return String::new();
        };

        first.to_uppercase().chain(chars).collect()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExportedCommentAnchor {
    pub(crate) file_key: String,
    pub(crate) block_type: String,
    pub(crate) block_index: usize,
    pub(crate) text_hash: String,
    pub(crate) text_snippet: String,
    pub(crate) char_range: ExportedCharRange,
}

impl ExportedCommentAnchor {
    pub(crate) fn from_anchor(anchor: &CommentAnchor) -> Self {
        let char_range = anchor.char_range();

        Self {
            file_key: anchor.file_key().as_str().to_string(),
            block_type: anchor.block_type().as_str().to_string(),
            block_index: anchor.block_index().value(),
            text_hash: anchor.text_hash().as_str().to_string(),
            text_snippet: anchor.text_snippet().as_str().to_string(),
            char_range: ExportedCharRange {
                start: char_range.start(),
                end: char_range.end(),
            },
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExportedCharRange {
    pub(crate) start: usize,
    pub(crate) end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExportedAnchorResolution {
    pub(crate) status: String,
    pub(crate) reason: String,
    pub(crate) details: Option<String>,
    pub(crate) target: Option<ExportedAnchorResolutionTarget>,
}

impl ExportedAnchorResolution {
    pub(crate) fn from_resolution(resolution: &CommentAnchorResolution) -> Self {
        Self {
            status: resolution.status().as_str().to_string(),
            reason: resolution.reason().as_str().to_string(),
            details: resolution.details().map(str::to_string),
            target: resolution
                .target()
                .map(ExportedAnchorResolutionTarget::from_target),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExportedAnchorResolutionTarget {
    pub(crate) block_type: String,
    pub(crate) block_index: usize,
    pub(crate) text_hash: String,
    pub(crate) text_snippet: String,
    pub(crate) source_range: Option<ExportedSourceRange>,
    pub(crate) score: u8,
}

impl ExportedAnchorResolutionTarget {
    pub(crate) fn from_target(target: &CommentAnchorResolutionTarget) -> Self {
        const MAX_BLOCK_TEXT_SNIPPET_LENGTH: usize = 160;

        let block = target.block();

        Self {
            block_type: block.block_type().as_str().to_string(),
            block_index: block.index().value(),
            text_hash: block.text_hash().as_str().to_string(),
            text_snippet: block
                .text()
                .normalized()
                .chars()
                .take(MAX_BLOCK_TEXT_SNIPPET_LENGTH)
                .collect(),
            source_range: block.source_range().map(ExportedSourceRange::from),
            score: target.score(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExportedSourceRange {
    pub(crate) start_byte_offset: usize,
    pub(crate) end_byte_offset: usize,
}

impl From<MarkdownBlockSourceRange> for ExportedSourceRange {
    fn from(range: MarkdownBlockSourceRange) -> Self {
        Self {
            start_byte_offset: range.start_byte_offset(),
            end_byte_offset: range.end_byte_offset(),
        }
    }
}
