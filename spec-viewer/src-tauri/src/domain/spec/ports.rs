use thiserror::Error;

use crate::domain::workspace::{WorkspaceConfig, WorkspaceLayout};

use super::{MarkdownBlock, SpecDocumentFormat, SpecFileKey, SpecId, SpecTreeFacts};

pub trait ScanSpecTree {
    fn scan_spec_tree(
        &self,
        layout: &WorkspaceLayout,
        config: &WorkspaceConfig,
    ) -> Result<SpecTreeFacts, SpecTreeScanPortError>;
}

pub trait ReadSpecFile {
    fn read_spec_file(
        &self,
        layout: &WorkspaceLayout,
        config: &WorkspaceConfig,
        spec_id: &SpecId,
        key: SpecFileKey,
    ) -> Result<ReadSpecFileResult, SpecFileReadPortError>;
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum SpecTreeScanPortError {
    #[error("{message}")]
    ConfigLoad { message: String },
    #[error("{message}")]
    Scan { message: String },
}

impl SpecTreeScanPortError {
    pub fn config_load(message: impl Into<String>) -> Self {
        Self::ConfigLoad {
            message: message.into(),
        }
    }

    pub fn scan(message: impl Into<String>) -> Self {
        Self::Scan {
            message: message.into(),
        }
    }

    pub fn message(&self) -> &str {
        match self {
            Self::ConfigLoad { message } | Self::Scan { message } => message,
        }
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
#[error("{message}")]
pub struct SpecFileReadPortError {
    message: String,
}

impl SpecFileReadPortError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }

    pub fn message(&self) -> &str {
        &self.message
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReadSpecFileResult {
    Found(SpecDocument),
    Missing(MissingSpecDocument),
}

impl ReadSpecFileResult {
    pub fn is_missing(&self) -> bool {
        matches!(self, Self::Missing(_))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecDocument {
    identity: crate::domain::spec::SpecArtifactIdentity,
    format: SpecDocumentFormat,
    path: String,
    contents: String,
    blocks: Vec<MarkdownBlock>,
}

impl SpecDocument {
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
        Self::with_artifact(
            crate::domain::spec::SpecArtifactIdentity::Standard(key),
            format,
            path,
            contents,
            blocks,
        )
    }

    pub fn with_artifact(
        identity: crate::domain::spec::SpecArtifactIdentity,
        format: SpecDocumentFormat,
        path: impl Into<String>,
        contents: impl Into<String>,
        blocks: Vec<MarkdownBlock>,
    ) -> Self {
        Self {
            identity,
            format,
            path: path.into(),
            contents: contents.into(),
            blocks,
        }
    }

    pub fn identity(&self) -> &crate::domain::spec::SpecArtifactIdentity {
        &self.identity
    }

    pub fn file_key(&self) -> Option<SpecFileKey> {
        self.identity.standard_key()
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
pub struct MissingSpecDocument {
    key: SpecFileKey,
    format: SpecDocumentFormat,
    path: String,
}

impl MissingSpecDocument {
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
