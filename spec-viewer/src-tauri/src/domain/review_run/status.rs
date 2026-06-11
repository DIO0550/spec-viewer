//! Review run status and its transitions.

use std::{fmt, str::FromStr};

use crate::domain::review_run::ReviewRunDomainError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum UserReviewRunStatus {
    Active,
    InProgress,
    Completed,
    Archived,
}

impl UserReviewRunStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::InProgress => "inProgress",
            Self::Completed => "completed",
            Self::Archived => "archived",
        }
    }

    pub fn can_transition_to(self, next: Self) -> bool {
        match (self, next) {
            (current, next) if current == next => true,
            (Self::Active, Self::InProgress | Self::Completed | Self::Archived) => true,
            (Self::InProgress, Self::Active | Self::Completed | Self::Archived) => true,
            (Self::Completed, Self::Archived) => true,
            (Self::Archived, _) => false,
            _ => false,
        }
    }
}

impl fmt::Display for UserReviewRunStatus {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

impl FromStr for UserReviewRunStatus {
    type Err = ReviewRunDomainError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "active" => Ok(Self::Active),
            "inProgress" => Ok(Self::InProgress),
            "completed" => Ok(Self::Completed),
            "archived" => Ok(Self::Archived),
            _ => Err(ReviewRunDomainError::UnsupportedStatus {
                status: value.to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_parses_manifest_values() {
        assert_eq!(
            Ok(UserReviewRunStatus::Active),
            UserReviewRunStatus::from_str("active")
        );
        assert_eq!(
            Ok(UserReviewRunStatus::InProgress),
            UserReviewRunStatus::from_str("inProgress")
        );
        assert_eq!(
            Err(ReviewRunDomainError::UnsupportedStatus {
                status: "ready".to_string()
            }),
            UserReviewRunStatus::from_str("ready")
        );
    }
}
