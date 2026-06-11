//! Review run identifier value object.

use std::fmt;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::domain::review_run::{ReviewRunDomainError, UserReviewRunTarget};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserReviewRunId {
    value: String,
}

impl UserReviewRunId {
    pub fn new(value: impl Into<String>) -> Result<Self, ReviewRunDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty() {
            return Err(ReviewRunDomainError::MissingReviewRunId);
        }

        if !Self::is_safe_identifier(trimmed) {
            return Err(ReviewRunDomainError::InvalidReviewRunId {
                id: value.to_string(),
            });
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    /// Generates a new run id from the review target and creation timestamp.
    pub fn generate(
        target: &UserReviewRunTarget,
        created_at: DateTime<Utc>,
    ) -> Result<Self, ReviewRunDomainError> {
        let target_suffix = match target {
            UserReviewRunTarget::File { file_key, .. } => format!("file-{}", file_key.as_str()),
            UserReviewRunTarget::Spec { .. } => "spec".to_string(),
        };
        let unique_suffix = Uuid::new_v4()
            .simple()
            .to_string()
            .chars()
            .take(8)
            .collect::<String>();
        let value = format!(
            "{}-{}-{}",
            created_at.format("%Y-%m-%dT%H%M%SZ"),
            target_suffix,
            unique_suffix
        );

        Self::new(value)
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }

    fn is_safe_identifier(value: &str) -> bool {
        value.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
        })
    }
}

impl fmt::Display for UserReviewRunId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn review_run_id_accepts_safe_human_readable_values() {
        let id = UserReviewRunId::new("  2026-05-06T120000Z-file-requirements  ")
            .expect("id should be valid");

        assert_eq!("2026-05-06T120000Z-file-requirements", id.as_str());
    }

    #[test]
    fn review_run_id_rejects_empty_and_path_like_values() {
        for value in [" ", "../escape", "nested/run", "bad\\run", "bad\0run"] {
            let result = UserReviewRunId::new(value);

            assert!(result.is_err());
        }
    }
}
