//! Result types returned by the application use cases.

use crate::{
    domain::{
        spec::{MarkdownBlock, SpecDocumentFormat, SpecFileKey, SpecNode},
        workspace::{WorkspaceConfig, WorkspaceLayout},
    },
    infrastructure::markdown::{MarkdownDocument, MarkdownReadResult, MissingMarkdownFile},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LoadWorkspaceResult {
    layout: WorkspaceLayout,
    config: WorkspaceConfig,
}

impl LoadWorkspaceResult {
    pub fn new(layout: WorkspaceLayout, config: WorkspaceConfig) -> Self {
        Self { layout, config }
    }

    pub fn layout(&self) -> &WorkspaceLayout {
        &self.layout
    }

    pub fn config(&self) -> &WorkspaceConfig {
        &self.config
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListSpecsResult {
    specs: Vec<SpecNode>,
}

impl ListSpecsResult {
    pub fn new(specs: Vec<SpecNode>) -> Self {
        Self { specs }
    }

    pub fn specs(&self) -> &[SpecNode] {
        &self.specs
    }

    pub fn into_specs(self) -> Vec<SpecNode> {
        self.specs
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveSpecResult {
    archived_spec_id: String,
    archive_path: String,
}

impl ArchiveSpecResult {
    pub fn new(archived_spec_id: impl Into<String>, archive_path: impl Into<String>) -> Self {
        Self {
            archived_spec_id: archived_spec_id.into(),
            archive_path: archive_path.into(),
        }
    }

    pub fn archived_spec_id(&self) -> &str {
        &self.archived_spec_id
    }

    pub fn archive_path(&self) -> &str {
        &self.archive_path
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReadSpecFileResult {
    Found(AppMarkdownDocument),
    Missing(AppMissingMarkdownFile),
}

impl ReadSpecFileResult {
    pub fn is_missing(&self) -> bool {
        matches!(self, Self::Missing(_))
    }
}

impl From<MarkdownReadResult> for ReadSpecFileResult {
    fn from(result: MarkdownReadResult) -> Self {
        match result {
            MarkdownReadResult::Found(document) => Self::Found(document.into()),
            MarkdownReadResult::Missing(missing) => Self::Missing(missing.into()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppMarkdownDocument {
    key: SpecFileKey,
    format: SpecDocumentFormat,
    path: String,
    contents: String,
    blocks: Vec<MarkdownBlock>,
}

impl AppMarkdownDocument {
    pub fn new(key: SpecFileKey, path: impl Into<String>, contents: impl Into<String>) -> Self {
        Self::with_format_and_blocks(
            key,
            SpecDocumentFormat::Markdown,
            path,
            contents,
            Vec::new(),
        )
    }

    pub fn with_blocks(
        key: SpecFileKey,
        path: impl Into<String>,
        contents: impl Into<String>,
        blocks: Vec<MarkdownBlock>,
    ) -> Self {
        Self::with_format_and_blocks(key, SpecDocumentFormat::Markdown, path, contents, blocks)
    }

    pub fn with_format_and_blocks(
        key: SpecFileKey,
        format: SpecDocumentFormat,
        path: impl Into<String>,
        contents: impl Into<String>,
        blocks: Vec<MarkdownBlock>,
    ) -> Self {
        Self {
            key,
            format,
            path: path.into(),
            contents: contents.into(),
            blocks,
        }
    }

    pub fn key(&self) -> SpecFileKey {
        self.key
    }

    pub fn format(&self) -> SpecDocumentFormat {
        self.format
    }

    pub fn path(&self) -> &str {
        &self.path
    }

    pub fn contents(&self) -> &str {
        &self.contents
    }

    pub fn blocks(&self) -> &[MarkdownBlock] {
        &self.blocks
    }
}

impl From<MarkdownDocument> for AppMarkdownDocument {
    fn from(document: MarkdownDocument) -> Self {
        Self::with_format_and_blocks(
            document.key(),
            document.format(),
            document.path().to_string(),
            document.contents().to_string(),
            document.blocks().to_vec(),
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppMissingMarkdownFile {
    key: SpecFileKey,
    format: SpecDocumentFormat,
    path: String,
}

impl AppMissingMarkdownFile {
    pub fn new(key: SpecFileKey, path: impl Into<String>) -> Self {
        Self::with_format(key, SpecDocumentFormat::Markdown, path)
    }

    pub fn with_format(
        key: SpecFileKey,
        format: SpecDocumentFormat,
        path: impl Into<String>,
    ) -> Self {
        Self {
            key,
            format,
            path: path.into(),
        }
    }

    pub fn key(&self) -> SpecFileKey {
        self.key
    }

    pub fn format(&self) -> SpecDocumentFormat {
        self.format
    }

    pub fn path(&self) -> &str {
        &self.path
    }
}

impl From<MissingMarkdownFile> for AppMissingMarkdownFile {
    fn from(missing: MissingMarkdownFile) -> Self {
        Self::with_format(missing.key(), missing.format(), missing.path().to_string())
    }
}
