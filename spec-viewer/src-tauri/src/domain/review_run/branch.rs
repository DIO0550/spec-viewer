//! Review run branch name value object.

use std::fmt;

use crate::domain::review_run::{ReviewRunDomainError, UserReviewRunId};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ReviewRunBranchName {
    value: String,
}

impl ReviewRunBranchName {
    pub fn new(value: impl Into<String>) -> Result<Self, ReviewRunDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty()
            || trimmed.starts_with('/')
            || trimmed.ends_with('/')
            || trimmed.contains('\\')
            || trimmed.contains('\0')
            || trimmed.contains("..")
        {
            return Err(ReviewRunDomainError::InvalidBranchName {
                branch_name: value.to_string(),
            });
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn for_run(id: &UserReviewRunId) -> Self {
        Self {
            value: format!("spec-reviewer/{id}"),
        }
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for ReviewRunBranchName {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}
