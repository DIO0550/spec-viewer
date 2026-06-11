//! Comment domain errors.

use thiserror::Error;

use crate::domain::comment::CommentId;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum CommentDomainError {
    #[error("comment id is required")]
    MissingCommentId,
    #[error("comment body is required")]
    MissingCommentBody,
    #[error("anchor text hash is required")]
    MissingTextHash,
    #[error("anchor text snippet is required")]
    MissingTextSnippet,
    #[error("anchor char range end {end} cannot be before start {start}")]
    InvalidCharRange { start: usize, end: usize },
    #[error("comment updated timestamp cannot be before created timestamp")]
    UpdatedBeforeCreated,
    #[error("duplicate comment id in thread: {id}")]
    DuplicateCommentId { id: CommentId },
}
