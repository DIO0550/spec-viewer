//! Comment identifier value object.

use std::fmt;

use crate::domain::comment::CommentDomainError;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CommentId {
    value: String,
}

impl CommentId {
    pub fn new(value: impl Into<String>) -> Result<Self, CommentDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty() {
            return Err(CommentDomainError::MissingCommentId);
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for CommentId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn comment_id_accepts_and_trims_non_empty_value() {
        let id = CommentId::new("  comment-1  ").expect("id should be valid");

        assert_eq!("comment-1", id.as_str());
        assert_eq!("comment-1", id.to_string());
    }

    #[test]
    fn comment_id_rejects_empty_value() {
        let result = CommentId::new("   ");

        assert_eq!(Err(CommentDomainError::MissingCommentId), result);
    }
}
