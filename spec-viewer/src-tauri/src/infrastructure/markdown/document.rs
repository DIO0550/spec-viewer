//! Markdown read results and document types.

use crate::domain::spec::{MarkdownBlock, SpecDocumentFormat, SpecFileKey};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MarkdownReadResult {
    Found(MarkdownDocument),
    Missing(MissingMarkdownFile),
}

impl MarkdownReadResult {
    pub fn is_missing(&self) -> bool {
        matches!(self, Self::Missing(_))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MarkdownDocument {
    key: SpecFileKey,
    format: SpecDocumentFormat,
    path: String,
    contents: String,
    blocks: Vec<MarkdownBlock>,
}

impl MarkdownDocument {
    pub fn new(
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MissingMarkdownFile {
    key: SpecFileKey,
    format: SpecDocumentFormat,
    path: String,
}

impl MissingMarkdownFile {
    pub(crate) fn new(
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
