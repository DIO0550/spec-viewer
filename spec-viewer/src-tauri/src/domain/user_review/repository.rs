//! Repository contract for persisted user review aggregates.

use std::fmt;

use chrono::{DateTime, Utc};
use thiserror::Error;

use super::{UserReview, UserReviewDomainError, UserReviewId, UserReviewTarget};

pub trait UserReviewRepository: Send + Sync {
    fn create(
        &self,
        review: UserReview,
    ) -> Result<UserReviewCreateOutcome, UserReviewRepositoryError>;

    fn list(
        &self,
        target: &UserReviewTarget,
    ) -> Result<UserReviewListOutcome, UserReviewRepositoryError>;

    fn archive(
        &self,
        id: &UserReviewId,
        target: &UserReviewTarget,
        archived_at: DateTime<Utc>,
    ) -> Result<UserReviewArchiveOutcome, UserReviewRepositoryError>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserReviewCreateOutcome {
    user_review: UserReview,
}

impl UserReviewCreateOutcome {
    pub fn new(user_review: UserReview) -> Self {
        Self { user_review }
    }

    pub fn user_review(&self) -> &UserReview {
        &self.user_review
    }

    pub fn into_user_review(self) -> UserReview {
        self.user_review
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserReviewListOutcome {
    active: Vec<UserReview>,
    archived: Vec<UserReview>,
    problems: Vec<UserReviewRecordProblem>,
}

impl UserReviewListOutcome {
    pub fn new(
        active: Vec<UserReview>,
        archived: Vec<UserReview>,
        problems: Vec<UserReviewRecordProblem>,
    ) -> Self {
        Self {
            active,
            archived,
            problems,
        }
    }

    pub fn active(&self) -> &[UserReview] {
        &self.active
    }

    pub fn archived(&self) -> &[UserReview] {
        &self.archived
    }

    pub fn problems(&self) -> &[UserReviewRecordProblem] {
        &self.problems
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserReviewArchiveOutcome {
    user_review: UserReview,
    problems: Vec<UserReviewRecordProblem>,
}

impl UserReviewArchiveOutcome {
    pub fn new(user_review: UserReview, problems: Vec<UserReviewRecordProblem>) -> Self {
        Self {
            user_review,
            problems,
        }
    }

    pub fn user_review(&self) -> &UserReview {
        &self.user_review
    }

    pub fn into_user_review(self) -> UserReview {
        self.user_review
    }

    pub fn problems(&self) -> &[UserReviewRecordProblem] {
        &self.problems
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct UserReviewRecordLocator {
    value: String,
}

impl UserReviewRecordLocator {
    pub fn new(value: impl Into<String>) -> Result<Self, UserReviewDomainError> {
        let value = value.into();
        let is_display_safe = !value.trim().is_empty()
            && !value.contains('/')
            && !value.contains('\\')
            && !value.chars().any(char::is_control);

        if !is_display_safe {
            return Err(UserReviewDomainError::InvalidRecordLocator { value });
        }

        Ok(Self { value })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for UserReviewRecordLocator {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum UserReviewRecordProblemKind {
    LegacyRecord,
    UnsupportedRecordVersion,
    MalformedRecord,
    RecoverableDuplicate,
    ConflictingCopies,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserReviewRecordProblem {
    locator: UserReviewRecordLocator,
    kind: UserReviewRecordProblemKind,
}

impl UserReviewRecordProblem {
    pub fn new(locator: UserReviewRecordLocator, kind: UserReviewRecordProblemKind) -> Self {
        Self { locator, kind }
    }

    pub fn locator(&self) -> &UserReviewRecordLocator {
        &self.locator
    }

    pub fn kind(&self) -> UserReviewRecordProblemKind {
        self.kind
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum UserReviewRepositoryError {
    #[error("user review already exists: {id}")]
    AlreadyExists { id: UserReviewId },
    #[error("user review was not found: {id}")]
    NotFound { id: UserReviewId },
    #[error("user review target does not match the repository request: {id}")]
    TargetMismatch { id: UserReviewId },
    #[error("user review has conflicting active and archived copies: {id}")]
    ConflictingCopies { id: UserReviewId },
    #[error("user review lifecycle state is invalid for this operation: {id}")]
    InvalidState { id: UserReviewId },
    #[error("user review is stored as a legacy record and cannot be mutated: {id}")]
    LegacyRecord { id: UserReviewId },
    #[error("user review repository is unavailable")]
    Unavailable,
}
