//! Spec domain errors.

use thiserror::Error;

use crate::domain::spec::SpecFileKey;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum SpecDomainError {
    #[error("spec id is required")]
    MissingSpecId,
    #[error("unsupported spec file key: {key}")]
    UnsupportedFileKey { key: String },
    #[error("file name is required for spec file key: {key}")]
    MissingFileName { key: SpecFileKey },
    #[error("spec node id is required")]
    MissingNodeId,
    #[error("spec node label is required")]
    MissingNodeLabel,
    #[error("markdown block text is required")]
    MissingMarkdownBlockText,
    #[error("normalized markdown block text is required")]
    MissingNormalizedMarkdownBlockText,
    #[error("markdown block hash is required")]
    MissingMarkdownBlockHash,
    #[error(
        "markdown block source range end byte offset {end_byte_offset} cannot be before start byte offset {start_byte_offset}"
    )]
    InvalidMarkdownBlockSourceRange {
        start_byte_offset: usize,
        end_byte_offset: usize,
    },
}
