use spec_reviewer_lib::{
    app::services::user_review_id::{
        GenerateUserReviewId, UuidUserReviewIdGenerator, MAX_USER_REVIEW_CREATE_ATTEMPTS,
    },
    domain::user_review::UserReviewId,
};
use uuid::Uuid;

const VALID_USER_REVIEW_ID: &str = "urv_123e4567e89b42d3a456426614174000";

#[test]
fn user_review_id_accepts_the_canonical_v1_filename_stem() {
    let id = UserReviewId::new(VALID_USER_REVIEW_ID).expect("canonical ID should be valid");

    assert_eq!(VALID_USER_REVIEW_ID, id.as_str());
    assert_eq!(VALID_USER_REVIEW_ID, id.to_string());
}

#[test]
fn user_review_id_rejects_noncanonical_values_without_normalizing_them() {
    let invalid_values = [
        "",
        "rv_123e4567e89b42d3a456426614174000",
        "URV_123e4567e89b42d3a456426614174000",
        "urv_123E4567E89B42D3A456426614174000",
        "urv_123e4567-e89b-42d3-a456-426614174000",
        "urv_123e4567e89b42d3a45642661417400/",
        "urv_123e4567e89b42d3a45642661417400\\",
        "urv_123e4567e89b42d3a45642661417400g",
        "urv_123e4567e89b42d3a45642661417400",
        "urv_123e4567e89b42d3a4564266141740000",
        " urv_123e4567e89b42d3a456426614174000",
        "urv_123e4567e89b42d3a456426614174000 ",
    ];

    for value in invalid_values {
        assert!(
            UserReviewId::new(value).is_err(),
            "{value:?} must be rejected"
        );
    }
}

#[test]
fn user_review_id_encodes_an_injected_uuid_v4_deterministically() {
    let uuid = Uuid::parse_str("123e4567-e89b-42d3-a456-426614174000")
        .expect("fixture should be a UUID v4");

    let id = UserReviewId::from_uuid(uuid).expect("UUID v4 should produce an ID");

    assert_eq!(VALID_USER_REVIEW_ID, id.as_str());
}

#[test]
fn user_review_id_rejects_an_injected_uuid_that_is_not_version_four() {
    let uuid = Uuid::parse_str("123e4567-e89b-12d3-a456-426614174000")
        .expect("fixture should be a UUID v1");

    assert!(UserReviewId::from_uuid(uuid).is_err());
}

#[test]
fn application_policy_limits_user_review_creation_to_three_attempts() {
    assert_eq!(3, MAX_USER_REVIEW_CREATE_ATTEMPTS);
}

#[test]
fn default_generator_produces_a_domain_valid_user_review_id() {
    let generator = UuidUserReviewIdGenerator;

    let id = generator
        .generate_user_review_id()
        .expect("UUID v4 generation should produce a valid ID");

    assert_eq!(36, id.as_str().len());
    assert!(UserReviewId::new(id.as_str()).is_ok());
}
