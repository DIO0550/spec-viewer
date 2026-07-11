use spec_reviewer_lib::{
    domain::{
        comment::CommentStatus,
        spec::{MarkdownBlockType, SpecFileKey},
        user_review::{UserReviewStatus, UserReviewTarget},
    },
    infrastructure::persistence::user_review_document::{
        decode_user_review_document, decode_user_review_record, encode_user_review_document,
        UserReviewRecordInput, UserReviewRecordProblem,
    },
};

const CANONICAL_V1: &str = include_str!("fixtures/user-reviews/canonical-v1.json");

fn assert_malformed(payload: &str) {
    assert!(matches!(
        decode_user_review_document(payload),
        Err(UserReviewRecordProblem::MalformedRecord { .. })
    ));
}

#[test]
fn canonical_v1_fixture_round_trips_without_changing_wire_values() {
    let review = decode_user_review_document(CANONICAL_V1)
        .expect("canonical v1 fixture should decode into the aggregate");

    assert_eq!("urv_018f4c2e6f0a4b18a9d41f72c3e5b607", review.id().as_str());
    assert_eq!(UserReviewStatus::Active, review.status());
    assert_eq!(
        &UserReviewTarget::file(
            spec_reviewer_lib::domain::spec::SpecId::new("001-auth-flow")
                .expect("fixture spec id should be valid"),
            SpecFileKey::Tasks,
        ),
        review.target()
    );
    assert_eq!(1, review.comments().len());
    assert_eq!(CommentStatus::Open, review.comments()[0].status());
    assert_eq!(
        MarkdownBlockType::Paragraph,
        review.comments()[0].block_type()
    );
    assert_eq!(42, review.comments()[0].line_start().value());
    assert_eq!(48, review.comments()[0].line_end().value());
    assert_eq!("sha256:d4b1ea57", review.comments()[0].text_hash().as_str());

    let encoded =
        encode_user_review_document(&review).expect("valid aggregate should encode as v1 JSON");

    assert_eq!(CANONICAL_V1, encoded);
    assert!(encoded.ends_with('\n'));
}

#[test]
fn unknown_root_field_is_malformed() {
    assert_malformed(&CANONICAL_V1.replacen(
        "{\n  \"schemaVersion\"",
        "{\n  \"unexpected\": true,\n  \"schemaVersion\"",
        1,
    ));
}

#[test]
fn unknown_target_field_is_malformed() {
    assert_malformed(&CANONICAL_V1.replacen(
        "\"target\": {\n    \"scope\"",
        "\"target\": {\n    \"unexpected\": true,\n    \"scope\"",
        1,
    ));
}

#[test]
fn unknown_comment_field_is_malformed() {
    assert_malformed(&CANONICAL_V1.replacen(
        "\"comments\": [\n    {\n      \"id\"",
        "\"comments\": [\n    {\n      \"unexpected\": true,\n      \"id\"",
        1,
    ));
}

#[test]
fn unknown_source_field_is_malformed() {
    assert_malformed(&CANONICAL_V1.replacen(
        "\"source\": {\n        \"specId\"",
        "\"source\": {\n        \"unexpected\": true,\n        \"specId\"",
        1,
    ));
}

#[test]
fn duplicate_json_key_is_malformed_before_schema_or_domain_conversion() {
    assert_malformed(&CANONICAL_V1.replacen(
        "\"schemaVersion\": \"spec-reviewer.user-review.v1\"",
        "\"schemaVersion\": \"spec-reviewer.user-review.v1\",\n  \"schemaVersion\": \"spec-reviewer.user-review.v2\"",
        1,
    ));
}

#[test]
fn unsupported_schema_version_is_distinct_from_malformed_json() {
    let payload = CANONICAL_V1.replacen(
        "spec-reviewer.user-review.v1",
        "spec-reviewer.user-review.v2",
        1,
    );

    assert_eq!(
        Err(UserReviewRecordProblem::UnsupportedRecordVersion {
            version: "spec-reviewer.user-review.v2".to_string(),
        }),
        decode_user_review_document(&payload)
    );
}

#[test]
fn malformed_json_is_reported_without_panicking() {
    assert_malformed("{\"schemaVersion\":");
}

#[test]
fn active_document_with_archived_timestamp_is_malformed() {
    assert_malformed(&CANONICAL_V1.replacen(
        "\"archivedAt\": null",
        "\"archivedAt\": \"2026-05-06T12:41:00.000Z\"",
        1,
    ));
}

#[test]
fn archived_document_without_archived_timestamp_is_malformed() {
    assert_malformed(&CANONICAL_V1.replacen(
        "\"status\": \"active\"",
        "\"status\": \"archived\"",
        1,
    ));
}

#[test]
fn target_and_comment_source_mismatch_is_malformed() {
    assert_malformed(&CANONICAL_V1.replacen(
        "\"specId\": \"001-auth-flow\",\n        \"fileKey\"",
        "\"specId\": \"002-billing-flow\",\n        \"fileKey\"",
        1,
    ));
}

#[test]
fn noncanonical_timestamp_precision_is_malformed() {
    assert_malformed(&CANONICAL_V1.replacen("2026-05-06T12:40:00.000Z", "2026-05-06T12:40:00Z", 1));
}

#[test]
fn noncanonical_fingerprint_is_malformed() {
    assert_malformed(&CANONICAL_V1.replacen("sha256:d4b1ea57", "sha256:D4B1EA57", 1));
}

#[test]
fn unsupported_block_token_is_malformed() {
    assert_malformed(&CANONICAL_V1.replacen("\"paragraph\"", "\"Paragraph\"", 1));
}

#[test]
fn legacy_folder_and_report_inputs_are_classified_without_json_decoding() {
    assert_eq!(
        Err(UserReviewRecordProblem::LegacyRecord),
        decode_user_review_record(UserReviewRecordInput::LegacyFolderBundle)
    );
    assert_eq!(
        Err(UserReviewRecordProblem::LegacyRecord),
        decode_user_review_record(UserReviewRecordInput::LegacyReport)
    );
}
