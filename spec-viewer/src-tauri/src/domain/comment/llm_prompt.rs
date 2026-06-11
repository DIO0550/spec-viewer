//! LLM prompt rendering for unresolved review comments.

use chrono::{DateTime, Utc};

use crate::domain::spec::SpecFileKey;

use super::{CommentExportTarget, ExportedComment};

/// Markdown context and comments collected for one prompt file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LlmPromptFile {
    spec_id: String,
    spec_label: String,
    file_key: SpecFileKey,
    file_label: String,
    markdown_path: String,
    markdown_contents: Option<String>,
    unresolved_comments: Vec<ExportedComment>,
    orphaned_comments: Vec<ExportedComment>,
}

impl LlmPromptFile {
    /// Builds a prompt file, separating orphaned comments from anchored ones.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        spec_id: impl Into<String>,
        spec_label: impl Into<String>,
        file_key: SpecFileKey,
        file_label: impl Into<String>,
        markdown_path: impl Into<String>,
        markdown_contents: Option<String>,
        comments: Vec<ExportedComment>,
    ) -> Self {
        let mut unresolved_comments = Vec::new();
        let mut orphaned_comments = Vec::new();

        for comment in comments {
            if comment.is_orphaned() {
                orphaned_comments.push(comment);
                continue;
            }

            unresolved_comments.push(comment);
        }

        Self {
            spec_id: spec_id.into(),
            spec_label: spec_label.into(),
            file_key,
            file_label: file_label.into(),
            markdown_path: markdown_path.into(),
            markdown_contents,
            unresolved_comments,
            orphaned_comments,
        }
    }

    /// Counts the unresolved and orphaned comments across all prompt files.
    pub fn count_comments(files: &[Self]) -> usize {
        files
            .iter()
            .map(|file| file.unresolved_comments.len() + file.orphaned_comments.len())
            .sum()
    }
}

/// Rendered LLM prompt with comment statistics.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LlmPrompt {
    prompt: String,
    comment_count: usize,
    context_file_count: usize,
}

impl LlmPrompt {
    /// Renders the full prompt for the given target and context files.
    pub fn render(
        workspace_path: &str,
        target: &CommentExportTarget,
        generated_at: DateTime<Utc>,
        files: &[LlmPromptFile],
    ) -> Self {
        let comment_count = LlmPromptFile::count_comments(files);
        let mut output = String::new();
        output.push_str("# Spec Review LLM Prompt\n\n");
        output.push_str("You are helping review a Markdown specification. Use the Markdown context and unresolved comments below to propose concrete edits, answer open questions, and call out risks. Treat orphaned comments separately because their original anchor no longer resolves cleanly.\n\n");
        output.push_str("## Export Metadata\n\n");
        output.push_str(&format!("- Workspace: `{workspace_path}`\n"));
        output.push_str(&format!("- Scope: `{}`\n", target.describe()));
        output.push_str(&format!("- Generated: `{}`\n", generated_at.to_rfc3339()));
        output.push_str(&format!("- Context files: `{}`\n", files.len()));
        output.push_str(&format!("- Unresolved comments: `{comment_count}`\n\n"));
        Self::render_context(&mut output, files);
        Self::render_comment_section(
            &mut output,
            "Unresolved Anchored Comments",
            files,
            PromptCommentKind::Anchored,
        );
        Self::render_comment_section(
            &mut output,
            "Orphaned Comments",
            files,
            PromptCommentKind::Orphaned,
        );

        Self {
            prompt: output,
            comment_count,
            context_file_count: files.len(),
        }
    }

    pub fn prompt(&self) -> &str {
        &self.prompt
    }

    pub fn comment_count(&self) -> usize {
        self.comment_count
    }

    pub fn context_file_count(&self) -> usize {
        self.context_file_count
    }

    fn render_context(output: &mut String, files: &[LlmPromptFile]) {
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

    fn render_comment_section(
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
                output.push_str(&comment.render_prompt(&file.spec_id));
            }
        }

        if !has_comments {
            output.push_str("No comments in this section.\n\n");
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PromptCommentKind {
    Anchored,
    Orphaned,
}

#[cfg(test)]
mod tests {
    use super::super::exported_comment::{ExportedAnchorResolution, ExportedCommentAnchor};
    use super::*;
    use crate::domain::comment::{
        BlockIndex, BlockType, CharRange, Comment, CommentAnchor, CommentBody, CommentId, TextHash,
        TextSnippet,
    };

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
    fn llm_prompt_includes_markdown_context_and_separates_orphaned_comments() {
        let anchored_comment = ExportedComment::from_comment(
            &Comment::new(
                CommentId::new("cmt_open").expect("id should be valid"),
                anchor(SpecFileKey::Tasks, BlockType::Paragraph),
                CommentBody::new("Clarify the acceptance criteria").expect("body should be valid"),
                timestamp(1),
                timestamp(1),
            )
            .expect("comment should be valid"),
        );
        let orphaned_comment = ExportedComment {
            id: "cmt_orphaned".to_string(),
            anchor: ExportedCommentAnchor::from_anchor(&anchor(
                SpecFileKey::Tasks,
                BlockType::Paragraph,
            )),
            body: "Recover this deleted note before asking the LLM.".to_string(),
            status: "open".to_string(),
            resolved: false,
            anchor_resolution: Some(ExportedAnchorResolution {
                status: "orphaned".to_string(),
                reason: "deleted_text".to_string(),
                details: None,
                target: None,
            }),
            created_at: timestamp(1),
            updated_at: timestamp(1),
        };
        let file = LlmPromptFile::new(
            "review-flow",
            "Review Flow",
            SpecFileKey::Tasks,
            "Tasks",
            "/workspace/project/tasks.md",
            Some("# Tasks\n\n- Ship prompt export".to_string()),
            vec![anchored_comment, orphaned_comment],
        );

        let rendered = LlmPrompt::render(
            "/workspace/project",
            &CommentExportTarget::File {
                spec_id: "review-flow".to_string(),
                file_key: SpecFileKey::Tasks,
            },
            timestamp(2),
            &[file],
        );
        let prompt = rendered.prompt();

        assert_eq!(2, rendered.comment_count());
        assert!(prompt.contains("# Spec Review LLM Prompt"));
        assert!(prompt.contains("````markdown\n# Tasks\n\n- Ship prompt export\n````"));
        assert!(prompt.contains("## Unresolved Anchored Comments"));
        assert!(prompt.contains("#### cmt_open"));
        assert!(prompt.contains("## Orphaned Comments"));
        assert!(prompt.contains("#### cmt_orphaned"));
        assert!(prompt.contains("Anchor resolution: `Orphaned / deleted_text`"));
    }
}
