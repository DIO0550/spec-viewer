//! Spec document and tree domain concepts.

mod errors;
mod file;
mod id;
mod markdown_block;
mod node;
mod safe_path;

pub use errors::SpecDomainError;
pub use file::{SpecDocumentFormat, SpecFile, SpecFileKey, SpecFileStatus};
pub use id::SpecId;
pub use markdown_block::{
    MarkdownBlock, MarkdownBlockHash, MarkdownBlockIndex, MarkdownBlockSourceRange,
    MarkdownBlockText, MarkdownBlockType,
};
pub use node::SpecNode;
pub use safe_path::{SafeSpecPath, SafeSpecPathError};
