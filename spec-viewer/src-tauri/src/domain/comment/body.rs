//! Comment body value object.

use crate::domain::comment::CommentDomainError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentBody {
    value: String,
}

impl CommentBody {
    pub fn new(value: impl Into<String>) -> Result<Self, CommentDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty() {
            return Err(CommentDomainError::MissingCommentBody);
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn comment_body_accepts_and_trims_non_empty_value() {
        let body = CommentBody::new("  Please clarify this.  ").expect("body should be valid");

        assert_eq!("Please clarify this.", body.as_str());
    }

    #[test]
    fn comment_body_rejects_empty_value() {
        let result = CommentBody::new("   ");

        assert_eq!(Err(CommentDomainError::MissingCommentBody), result);
    }
}
