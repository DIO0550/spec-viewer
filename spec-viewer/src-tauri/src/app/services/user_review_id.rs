//! Application policy for issuing user review identifiers.

use uuid::Uuid;

use crate::domain::user_review::{UserReviewDomainError, UserReviewId};

pub const MAX_USER_REVIEW_CREATE_ATTEMPTS: usize = 3;

pub trait GenerateUserReviewId {
    fn generate_user_review_id(&self) -> Result<UserReviewId, UserReviewDomainError>;
}

#[derive(Debug, Clone, Copy, Default)]
pub struct UuidUserReviewIdGenerator;

impl GenerateUserReviewId for UuidUserReviewIdGenerator {
    fn generate_user_review_id(&self) -> Result<UserReviewId, UserReviewDomainError> {
        UserReviewId::from_uuid(Uuid::new_v4())
    }
}
