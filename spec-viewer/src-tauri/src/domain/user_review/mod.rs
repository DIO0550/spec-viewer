//! User review domain concepts.

use std::fmt;

use thiserror::Error;
use uuid::{Uuid, Variant, Version};

const USER_REVIEW_ID_PREFIX: &str = "urv_";
const USER_REVIEW_ID_HEX_LENGTH: usize = 32;
const USER_REVIEW_ID_LENGTH: usize = USER_REVIEW_ID_PREFIX.len() + USER_REVIEW_ID_HEX_LENGTH;

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct UserReviewId {
    value: String,
}

impl UserReviewId {
    pub fn new(value: impl Into<String>) -> Result<Self, UserReviewDomainError> {
        let value = value.into();

        if !is_canonical_user_review_id(&value) {
            return Err(UserReviewDomainError::InvalidUserReviewId { value });
        }

        Ok(Self { value })
    }

    pub fn from_uuid(uuid: Uuid) -> Result<Self, UserReviewDomainError> {
        if uuid.get_version() != Some(Version::Random) || uuid.get_variant() != Variant::RFC4122 {
            return Err(UserReviewDomainError::InvalidUserReviewUuid { uuid });
        }

        Self::new(format!("{USER_REVIEW_ID_PREFIX}{}", uuid.simple()))
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for UserReviewId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

fn is_canonical_user_review_id(value: &str) -> bool {
    let bytes = value.as_bytes();

    bytes.len() == USER_REVIEW_ID_LENGTH
        && bytes.starts_with(USER_REVIEW_ID_PREFIX.as_bytes())
        && bytes[USER_REVIEW_ID_PREFIX.len()..]
            .iter()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(byte))
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum UserReviewDomainError {
    #[error("user review ID must match ^urv_[0-9a-f]{{32}}$: {value}")]
    InvalidUserReviewId { value: String },
    #[error("user review ID generation requires an RFC UUID v4: {uuid}")]
    InvalidUserReviewUuid { uuid: Uuid },
}
