//! Comment export bundles rendered for files, specs, and whole workspaces.

use chrono::{DateTime, Utc};
use serde::Serialize;
use thiserror::Error;

use crate::domain::spec::SpecFileKey;

use super::ExportedComment;

/// Scope of a comment export or LLM prompt request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommentExportTarget {
    File {
        spec_id: String,
        file_key: SpecFileKey,
    },
    Spec {
        spec_id: String,
    },
    Workspace,
}

impl CommentExportTarget {
    /// Describes the export scope for prompt metadata.
    pub fn describe(&self) -> String {
        match self {
            Self::File { spec_id, file_key } => format!("file / {spec_id} / {file_key}"),
            Self::Spec { spec_id } => format!("spec / {spec_id}"),
            Self::Workspace => "workspace".to_string(),
        }
    }
}

/// Output format of a rendered comment export.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommentExportFormat {
    Markdown,
    Json,
}

impl CommentExportFormat {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Markdown => "markdown",
            Self::Json => "json",
        }
    }
}

/// Comments exported for a single logical spec file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentExportFile {
    spec_id: String,
    spec_label: String,
    file_key: SpecFileKey,
    file_label: String,
    comments: Vec<ExportedComment>,
}

impl CommentExportFile {
    pub fn new(
        spec_id: impl Into<String>,
        spec_label: impl Into<String>,
        file_key: SpecFileKey,
        file_label: impl Into<String>,
        comments: Vec<ExportedComment>,
    ) -> Self {
        Self {
            spec_id: spec_id.into(),
            spec_label: spec_label.into(),
            file_key,
            file_label: file_label.into(),
            comments,
        }
    }

    pub fn comments(&self) -> &[ExportedComment] {
        &self.comments
    }

    /// Counts the comments across all export files.
    pub fn count_comments(files: &[Self]) -> usize {
        files.iter().map(|file| file.comments.len()).sum()
    }
}

/// Rendered comment export with its destination format.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentExport {
    format: CommentExportFormat,
    contents: String,
    comment_count: usize,
}

impl CommentExport {
    /// Renders a Markdown export for the given files.
    pub fn markdown(
        title: &str,
        workspace_path: &str,
        generated_at: DateTime<Utc>,
        files: &[CommentExportFile],
    ) -> Self {
        let comment_count = CommentExportFile::count_comments(files);
        let contents =
            Self::render_markdown(title, workspace_path, generated_at, files, comment_count);

        Self {
            format: CommentExportFormat::Markdown,
            contents,
            comment_count,
        }
    }

    /// Renders the workspace-wide JSON export for the given files.
    pub fn workspace_json(
        workspace_path: &str,
        generated_at: DateTime<Utc>,
        files: &[CommentExportFile],
    ) -> Result<Self, CommentExportRenderError> {
        let comment_count = CommentExportFile::count_comments(files);
        let document = ExportCommentsJsonDocument::from_files(
            workspace_path,
            generated_at,
            files,
            comment_count,
        );
        let contents = serde_json::to_string_pretty(&document)?;

        Ok(Self {
            format: CommentExportFormat::Json,
            contents,
            comment_count,
        })
    }

    pub fn format(&self) -> CommentExportFormat {
        self.format
    }

    pub fn contents(&self) -> &str {
        &self.contents
    }

    pub fn comment_count(&self) -> usize {
        self.comment_count
    }

    fn render_markdown(
        title: &str,
        workspace_path: &str,
        generated_at: DateTime<Utc>,
        files: &[CommentExportFile],
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
                output.push_str(&comment.render_markdown(&file.spec_id));
            }
        }

        output
    }
}

/// Error raised while rendering a comment export document.
#[derive(Debug, Error)]
pub enum CommentExportRenderError {
    #[error("failed to serialize comment export: {source}")]
    Serialize {
        #[from]
        source: serde_json::Error,
    },
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

impl ExportCommentsJsonDocument {
    fn from_files(
        workspace_path: &str,
        generated_at: DateTime<Utc>,
        files: &[CommentExportFile],
        comment_count: usize,
    ) -> Self {
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

        Self {
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
    comments: Vec<ExportedComment>,
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
    fn markdown_export_includes_comment_and_anchor_states() {
        let comment = ExportedComment {
            id: "cmt_orphaned".to_string(),
            anchor: ExportedCommentAnchor::from_anchor(&anchor(
                SpecFileKey::Tasks,
                BlockType::Paragraph,
            )),
            body: "Explain what happens when the source paragraph is deleted.".to_string(),
            status: "resolved".to_string(),
            resolved: true,
            anchor_resolution: Some(ExportedAnchorResolution {
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
        let file = CommentExportFile::new(
            "review-flow",
            "Review Flow",
            SpecFileKey::Tasks,
            "Tasks",
            vec![comment],
        );

        let export = CommentExport::markdown(
            "Current File Comments",
            "/workspace/project",
            timestamp(3),
            &[file],
        );
        let markdown = export.contents();

        assert_eq!(1, export.comment_count());
        assert!(markdown.contains("# Current File Comments"));
        assert!(markdown.contains("- Comment state: `Resolved`"));
        assert!(markdown.contains("- Anchor state: `Orphaned / deleted_text"));
        assert!(markdown.contains("Explain what happens when the source paragraph is deleted."));
    }

    #[test]
    fn workspace_json_export_groups_comments_by_spec_and_file() {
        let comment = ExportedComment::from_comment(
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
        let file = CommentExportFile::new(
            "auth-flow",
            "Auth Flow",
            SpecFileKey::Impl,
            "Implementation",
            vec![comment],
        );

        let export = CommentExport::workspace_json("/workspace/project", timestamp(2), &[file])
            .expect("export document should serialize");
        let value: serde_json::Value =
            serde_json::from_str(export.contents()).expect("export contents should parse");

        assert_eq!(1, value["commentCount"]);
        assert_eq!("workspace", value["target"]["scope"]);
        assert_eq!("auth-flow", value["specs"][0]["specId"]);
        assert_eq!("impl", value["specs"][0]["files"][0]["fileKey"]);
        assert_eq!(
            "cmt_json",
            value["specs"][0]["files"][0]["comments"][0]["id"]
        );
    }
}
