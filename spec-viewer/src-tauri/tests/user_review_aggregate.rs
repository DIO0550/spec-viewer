use chrono::{DateTime, Utc};
use spec_reviewer_lib::domain::{
    comment::{CommentBody, CommentId, CommentStatus, TextSnippet},
    spec::{MarkdownBlockHash, MarkdownBlockType, SpecFileKey, SpecId},
    user_review::{
        LineRange, PositiveLineNumber, UserReview, UserReviewAnchor, UserReviewArchiveTransition,
        UserReviewComment, UserReviewContent, UserReviewDomainError, UserReviewId,
        UserReviewIdViolation, UserReviewSource, UserReviewStatus, UserReviewTarget,
    },
    workspace::{RelativePathViolation, WorkspaceDomainError, WorkspaceRelativePath},
};

const REVIEW_ID: &str = "urv_123e4567e89b42d3a456426614174000";
const OTHER_REVIEW_ID: &str = "urv_223e4567e89b42d3a456426614174000";
const SPEC_ID: &str = "001-checkout-flow";

fn timestamp(second: u32) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(&format!("2026-05-06T12:40:{second:02}Z"))
        .expect("timestamp fixture should parse")
        .with_timezone(&Utc)
}

fn review_id(value: &str) -> UserReviewId {
    UserReviewId::new(value).expect("review ID fixture should be valid")
}

fn spec_id(value: &str) -> SpecId {
    SpecId::new(value).expect("spec ID fixture should be valid")
}

fn file_target(file_key: SpecFileKey) -> UserReviewTarget {
    UserReviewTarget::file(spec_id(SPEC_ID), file_key)
}

fn comment(
    id: &str,
    source_spec_id: &str,
    file_key: SpecFileKey,
    file_path: &str,
    line_start: u32,
    line_end: u32,
    text_hash: &str,
) -> UserReviewComment {
    let source = UserReviewSource::new(
        spec_id(source_spec_id),
        file_key,
        WorkspaceRelativePath::new(file_path).expect("source path fixture should be valid"),
    );
    let line_range = LineRange::new(
        PositiveLineNumber::new(line_start).expect("start line fixture should be valid"),
        PositiveLineNumber::new(line_end).expect("end line fixture should be valid"),
    )
    .expect("line range fixture should be valid");
    let anchor = UserReviewAnchor::new(
        source,
        MarkdownBlockType::Paragraph,
        line_range,
        TextSnippet::new("Target text").expect("snippet fixture should be valid"),
        MarkdownBlockHash::new(text_hash).expect("hash fixture should be valid"),
    );

    UserReviewComment::new(
        CommentId::new(id).expect("comment ID fixture should be valid"),
        CommentStatus::Open,
        anchor,
        CommentBody::new("Please clarify this section.")
            .expect("comment body fixture should be valid"),
        timestamp(1),
        timestamp(2),
    )
    .expect("comment fixture should be valid")
}

fn tasks_comment(id: &str, line_start: u32, line_end: u32) -> UserReviewComment {
    comment(
        id,
        SPEC_ID,
        SpecFileKey::Tasks,
        ".plugin-workspace/.specs/001-checkout-flow/tasks.md",
        line_start,
        line_end,
        "sha256:d4b1ea57",
    )
}

fn review_content(target: UserReviewTarget, comments: Vec<UserReviewComment>) -> UserReviewContent {
    UserReviewContent::new(target, comments).expect("review content fixture should be valid")
}

fn active_review() -> UserReview {
    UserReview::new(
        review_id(REVIEW_ID),
        review_content(
            file_target(SpecFileKey::Tasks),
            vec![tasks_comment("comment-1", 42, 48)],
        ),
        timestamp(3),
    )
}

#[test]
fn new_user_review_is_active_and_keeps_immutable_comment_snapshots() {
    let created_at = timestamp(3);
    let review = UserReview::new(
        review_id(REVIEW_ID),
        review_content(
            file_target(SpecFileKey::Tasks),
            vec![tasks_comment("comment-1", 42, 48)],
        ),
        created_at,
    );

    assert_eq!(REVIEW_ID, review.id().as_str());
    assert_eq!(UserReviewStatus::Active, review.status());
    assert_eq!(&file_target(SpecFileKey::Tasks), review.target());
    assert_eq!(1, review.comments().len());
    let comment = &review.comments()[0];
    assert_eq!("comment-1", comment.id().as_str());
    assert_eq!(CommentStatus::Open, comment.status());
    assert_eq!(SPEC_ID, comment.anchor().source().spec_id().as_str());
    assert_eq!(SpecFileKey::Tasks, comment.anchor().source().file_key());
    assert_eq!(
        ".plugin-workspace/.specs/001-checkout-flow/tasks.md",
        comment.anchor().source().file_path().as_str()
    );
    assert_eq!(MarkdownBlockType::Paragraph, comment.anchor().block_type());
    assert_eq!(42, comment.anchor().line_range().start().value());
    assert_eq!(48, comment.anchor().line_range().end().value());
    assert_eq!("Target text", comment.anchor().text_snippet().as_str());
    assert_eq!("sha256:d4b1ea57", comment.anchor().text_hash().as_str());
    assert_eq!("Please clarify this section.", comment.body().as_str());
    assert_eq!(timestamp(1), comment.created_at());
    assert_eq!(timestamp(2), comment.updated_at());
    assert_eq!(created_at, review.created_at());
    assert_eq!(created_at, review.updated_at());
    assert_eq!(None, review.archived_at());
}

#[test]
fn user_review_content_requires_at_least_one_comment() {
    let result = UserReviewContent::new(file_target(SpecFileKey::Tasks), Vec::new());

    assert_eq!(Err(UserReviewDomainError::MissingComments), result);
}

#[test]
fn user_review_content_rejects_duplicate_comment_ids() {
    let result = UserReviewContent::new(
        file_target(SpecFileKey::Tasks),
        vec![
            tasks_comment("comment-1", 42, 48),
            tasks_comment("comment-1", 52, 55),
        ],
    );

    assert_eq!(
        Err(UserReviewDomainError::DuplicateCommentId {
            id: CommentId::new("comment-1").expect("comment ID fixture should be valid"),
        }),
        result
    );
}

#[test]
fn user_review_content_rejects_duplicate_full_source_identities() {
    let result = UserReviewContent::new(
        file_target(SpecFileKey::Tasks),
        vec![
            tasks_comment("comment-1", 42, 48),
            tasks_comment("comment-2", 42, 48),
        ],
    );

    assert_eq!(
        Err(UserReviewDomainError::DuplicateCommentSource {
            first_id: CommentId::new("comment-1").expect("comment ID fixture should be valid"),
            duplicate_id: CommentId::new("comment-2").expect("comment ID fixture should be valid"),
        }),
        result
    );
}

#[test]
fn user_review_content_allows_distinct_anchors_in_the_same_source_file() {
    let content = UserReviewContent::new(
        file_target(SpecFileKey::Tasks),
        vec![
            tasks_comment("comment-1", 42, 48),
            tasks_comment("comment-2", 52, 55),
        ],
    )
    .expect("different anchors in one file should be valid");

    assert_eq!(2, content.comments().len());
}

#[test]
fn user_review_content_allows_the_same_range_with_a_different_hash() {
    let content = UserReviewContent::new(
        file_target(SpecFileKey::Tasks),
        vec![
            tasks_comment("comment-1", 42, 48),
            comment(
                "comment-2",
                SPEC_ID,
                SpecFileKey::Tasks,
                ".plugin-workspace/.specs/001-checkout-flow/tasks.md",
                42,
                48,
                "sha256:14a7fbc2",
            ),
        ],
    )
    .expect("different hashes identify different anchors");

    assert_eq!(2, content.comments().len());
}

#[test]
fn file_target_requires_every_comment_source_to_match_spec_and_file() {
    let wrong_spec = UserReviewContent::new(
        file_target(SpecFileKey::Tasks),
        vec![comment(
            "comment-1",
            "002-payment-flow",
            SpecFileKey::Tasks,
            ".plugin-workspace/.specs/002-payment-flow/tasks.md",
            42,
            48,
            "sha256:d4b1ea57",
        )],
    );
    let wrong_file = UserReviewContent::new(
        file_target(SpecFileKey::Tasks),
        vec![comment(
            "comment-1",
            SPEC_ID,
            SpecFileKey::Impl,
            ".plugin-workspace/.specs/001-checkout-flow/implementation-plan.md",
            42,
            48,
            "sha256:d4b1ea57",
        )],
    );

    assert_eq!(
        Err(UserReviewDomainError::CommentSourceSpecMismatch {
            comment_id: CommentId::new("comment-1").expect("comment ID fixture should be valid"),
            target_spec_id: spec_id(SPEC_ID),
            source_spec_id: spec_id("002-payment-flow"),
        }),
        wrong_spec
    );
    assert_eq!(
        Err(UserReviewDomainError::CommentSourceFileMismatch {
            comment_id: CommentId::new("comment-1").expect("comment ID fixture should be valid"),
            target_file_key: SpecFileKey::Tasks,
            source_file_key: SpecFileKey::Impl,
        }),
        wrong_file
    );
}

#[test]
fn spec_target_allows_multiple_files_but_rejects_another_spec() {
    let target = UserReviewTarget::spec(spec_id(SPEC_ID));
    let valid = UserReviewContent::new(
        target.clone(),
        vec![
            tasks_comment("comment-1", 42, 48),
            comment(
                "comment-2",
                SPEC_ID,
                SpecFileKey::Impl,
                ".plugin-workspace/.specs/001-checkout-flow/implementation-plan.md",
                12,
                14,
                "sha256:14a7fbc2",
            ),
        ],
    );
    let invalid = UserReviewContent::new(
        target,
        vec![comment(
            "comment-1",
            "002-payment-flow",
            SpecFileKey::Tasks,
            ".plugin-workspace/.specs/002-payment-flow/tasks.md",
            42,
            48,
            "sha256:d4b1ea57",
        )],
    );

    assert!(valid.is_ok());
    assert!(matches!(
        invalid,
        Err(UserReviewDomainError::CommentSourceSpecMismatch { .. })
    ));
}

#[test]
fn user_review_comment_requires_positive_ordered_lines_and_monotonic_time() {
    assert_eq!(
        Err(UserReviewDomainError::InvalidLineNumber { value: 0 }),
        PositiveLineNumber::new(0)
    );

    let anchor = UserReviewAnchor::new(
        UserReviewSource::new(
            spec_id(SPEC_ID),
            SpecFileKey::Tasks,
            WorkspaceRelativePath::new(".plugin-workspace/.specs/001-checkout-flow/tasks.md")
                .expect("source path fixture should be valid"),
        ),
        MarkdownBlockType::Heading,
        LineRange::new(
            PositiveLineNumber::new(42).expect("start line fixture should be valid"),
            PositiveLineNumber::new(48).expect("end line fixture should be valid"),
        )
        .expect("line range fixture should be valid"),
        TextSnippet::new("Target text").expect("snippet fixture should be valid"),
        MarkdownBlockHash::new("sha256:d4b1ea57").expect("hash fixture should be valid"),
    );
    let reversed_start = PositiveLineNumber::new(48).expect("line fixture should be valid");
    let reversed_end = PositiveLineNumber::new(42).expect("line fixture should be valid");

    assert_eq!(
        Err(UserReviewDomainError::InvalidLineRange {
            start: reversed_start,
            end: reversed_end,
        }),
        LineRange::new(reversed_start, reversed_end)
    );

    let single_line = LineRange::new(
        PositiveLineNumber::new(42).expect("line fixture should be valid"),
        PositiveLineNumber::new(42).expect("line fixture should be valid"),
    )
    .expect("single-line range should be valid");
    assert_eq!(single_line.start(), single_line.end());

    let result = UserReviewComment::new(
        CommentId::new("comment-1").expect("comment ID fixture should be valid"),
        CommentStatus::Resolved,
        anchor,
        CommentBody::new("Please clarify this section.")
            .expect("comment body fixture should be valid"),
        timestamp(2),
        timestamp(1),
    );

    assert_eq!(
        Err(UserReviewDomainError::CommentUpdatedBeforeCreated {
            id: CommentId::new("comment-1").expect("comment ID fixture should be valid"),
            created_at: timestamp(2),
            updated_at: timestamp(1),
        }),
        result
    );
}

#[test]
fn workspace_relative_path_returns_the_first_typed_violation() {
    let cases = [
        ("", RelativePathViolation::EmptySegment),
        ("/absolute/tasks.md", RelativePathViolation::EmptySegment),
        ("spec//tasks.md", RelativePathViolation::EmptySegment),
        ("spec/tasks.md/", RelativePathViolation::EmptySegment),
        (
            "spec/./tasks.md",
            RelativePathViolation::CurrentDirectorySegment,
        ),
        (
            "spec/../tasks.md",
            RelativePathViolation::ParentDirectorySegment,
        ),
        (
            "spec\\tasks.md",
            RelativePathViolation::ForbiddenCharacter { character: '\\' },
        ),
        (
            "spec/tasks\0.md",
            RelativePathViolation::ForbiddenCharacter { character: '\0' },
        ),
        (
            "C:/absolute/tasks.md",
            RelativePathViolation::ForbiddenCharacter { character: ':' },
        ),
    ];

    for (path, violation) in cases {
        assert_eq!(
            Err(WorkspaceDomainError::InvalidRelativePath {
                value: path.to_string(),
                violation,
            }),
            WorkspaceRelativePath::try_from(path.to_string()),
            "{path:?} must be rejected"
        );
    }
}

#[test]
fn user_review_id_try_from_returns_typed_violations() {
    let cases = [
        (
            "rvw_123e4567e89b42d3a456426614174000",
            UserReviewIdViolation::InvalidPrefix,
        ),
        (
            "urv_123e4567e89b42d3a45642661417400",
            UserReviewIdViolation::InvalidLength {
                expected: 32,
                actual: 31,
            },
        ),
        (
            "urv_123e456Ge89b42d3a456426614174000",
            UserReviewIdViolation::InvalidHexCharacter {
                index: 7,
                character: 'G',
            },
        ),
    ];

    for (value, violation) in cases {
        assert_eq!(
            Err(UserReviewDomainError::InvalidUserReviewId {
                value: value.to_string(),
                violation,
            }),
            UserReviewId::try_from(value.to_string())
        );
    }

    let id =
        UserReviewId::try_from(REVIEW_ID.to_string()).expect("canonical review ID should convert");
    assert_eq!(REVIEW_ID, id.as_str());
}

#[test]
fn restore_rejects_invalid_status_and_timestamp_combinations() {
    let content = review_content(
        file_target(SpecFileKey::Tasks),
        vec![tasks_comment("comment-1", 42, 48)],
    );

    let active_with_archive_time = UserReview::restore(
        review_id(REVIEW_ID),
        content.clone(),
        UserReviewStatus::Active,
        timestamp(3),
        timestamp(3),
        Some(timestamp(4)),
    );
    let active_with_changed_time = UserReview::restore(
        review_id(REVIEW_ID),
        content.clone(),
        UserReviewStatus::Active,
        timestamp(3),
        timestamp(4),
        None,
    );
    let archived_without_time = UserReview::restore(
        review_id(REVIEW_ID),
        content.clone(),
        UserReviewStatus::Archived,
        timestamp(3),
        timestamp(4),
        None,
    );
    let archived_with_different_updated_time = UserReview::restore(
        review_id(REVIEW_ID),
        content.clone(),
        UserReviewStatus::Archived,
        timestamp(3),
        timestamp(4),
        Some(timestamp(5)),
    );
    let rolled_back = UserReview::restore(
        review_id(REVIEW_ID),
        content,
        UserReviewStatus::Archived,
        timestamp(4),
        timestamp(3),
        Some(timestamp(3)),
    );

    assert_eq!(
        Err(UserReviewDomainError::ActiveReviewHasArchivedAt {
            archived_at: timestamp(4),
        }),
        active_with_archive_time
    );
    assert_eq!(
        Err(UserReviewDomainError::ActiveTimestampsDiffer {
            created_at: timestamp(3),
            updated_at: timestamp(4),
        }),
        active_with_changed_time
    );
    assert_eq!(
        Err(UserReviewDomainError::ArchivedReviewMissingArchivedAt),
        archived_without_time
    );
    assert_eq!(
        Err(UserReviewDomainError::ArchivedTimestampsDiffer {
            updated_at: timestamp(4),
            archived_at: timestamp(5),
        }),
        archived_with_different_updated_time
    );
    assert_eq!(
        Err(UserReviewDomainError::ReviewUpdatedBeforeCreated {
            created_at: timestamp(4),
            updated_at: timestamp(3),
        }),
        rolled_back
    );
}

#[test]
fn restore_accepts_the_canonical_archived_lifecycle() {
    let review = UserReview::restore(
        review_id(REVIEW_ID),
        review_content(
            file_target(SpecFileKey::Tasks),
            vec![tasks_comment("comment-1", 42, 48)],
        ),
        UserReviewStatus::Archived,
        timestamp(3),
        timestamp(4),
        Some(timestamp(4)),
    )
    .expect("canonical archived lifecycle should restore");

    assert_eq!(UserReviewStatus::Archived, review.status());
    assert_eq!(timestamp(3), review.created_at());
    assert_eq!(timestamp(4), review.updated_at());
    assert_eq!(Some(timestamp(4)), review.archived_at());
}

#[test]
fn archive_transitions_active_review_and_updates_both_archive_timestamps() {
    let mut review = active_review();
    let requested_id = review_id(REVIEW_ID);
    let requested_target = file_target(SpecFileKey::Tasks);

    let transition = review
        .archive(&requested_id, &requested_target, timestamp(4))
        .expect("matching active review should archive");

    assert_eq!(UserReviewArchiveTransition::Archived, transition);
    assert_eq!(UserReviewStatus::Archived, review.status());
    assert_eq!(timestamp(4), review.updated_at());
    assert_eq!(Some(timestamp(4)), review.archived_at());
}

#[test]
fn archive_allows_a_timestamp_equal_to_the_current_updated_at() {
    let mut review = active_review();

    let transition = review
        .archive(
            &review_id(REVIEW_ID),
            &file_target(SpecFileKey::Tasks),
            timestamp(3),
        )
        .expect("equal archive timestamp should be valid");

    assert_eq!(UserReviewArchiveTransition::Archived, transition);
    assert_eq!(Some(timestamp(3)), review.archived_at());
}

#[test]
fn archive_rejects_timestamp_rollback_without_mutating_the_review() {
    let mut review = active_review();
    let original = review.clone();

    let result = review.archive(
        &review_id(REVIEW_ID),
        &file_target(SpecFileKey::Tasks),
        timestamp(2),
    );

    assert_eq!(
        Err(UserReviewDomainError::ArchiveTimestampRollback {
            current_updated_at: timestamp(3),
            attempted_archived_at: timestamp(2),
        }),
        result
    );
    assert_eq!(original, review);
}

#[test]
fn rearchive_is_idempotent_for_matching_identity_and_target() {
    let mut review = active_review();
    let requested_id = review_id(REVIEW_ID);
    let requested_target = file_target(SpecFileKey::Tasks);
    review
        .archive(&requested_id, &requested_target, timestamp(4))
        .expect("first archive should succeed");
    let archived = review.clone();

    let transition = review
        .archive(&requested_id, &requested_target, timestamp(5))
        .expect("matching archived review should be idempotent");

    assert_eq!(UserReviewArchiveTransition::AlreadyArchived, transition);
    assert_eq!(archived, review);
}

#[test]
fn rearchive_ignores_an_older_timestamp_for_a_matching_review() {
    let mut review = active_review();
    let requested_id = review_id(REVIEW_ID);
    let requested_target = file_target(SpecFileKey::Tasks);
    review
        .archive(&requested_id, &requested_target, timestamp(4))
        .expect("first archive should succeed");
    let archived = review.clone();

    let transition = review
        .archive(&requested_id, &requested_target, timestamp(2))
        .expect("matching rearchive should ignore the supplied timestamp");

    assert_eq!(UserReviewArchiveTransition::AlreadyArchived, transition);
    assert_eq!(archived, review);
}

#[test]
fn rearchive_rejects_identity_or_target_contradictions_without_mutation() {
    let mut review = active_review();
    review
        .archive(
            &review_id(REVIEW_ID),
            &file_target(SpecFileKey::Tasks),
            timestamp(4),
        )
        .expect("first archive should succeed");
    let original = review.clone();

    let wrong_id_result = review.archive(
        &review_id(OTHER_REVIEW_ID),
        &file_target(SpecFileKey::Tasks),
        timestamp(5),
    );
    let wrong_target_result = review.archive(
        &review_id(REVIEW_ID),
        &file_target(SpecFileKey::Impl),
        timestamp(5),
    );

    assert_eq!(
        Err(UserReviewDomainError::ArchiveIdentityMismatch {
            aggregate_id: review_id(REVIEW_ID),
            requested_id: review_id(OTHER_REVIEW_ID),
        }),
        wrong_id_result
    );
    assert_eq!(
        Err(UserReviewDomainError::ArchiveTargetMismatch {
            aggregate_target: file_target(SpecFileKey::Tasks),
            requested_target: file_target(SpecFileKey::Impl),
        }),
        wrong_target_result
    );
    assert_eq!(original, review);
}

#[test]
fn archive_prefers_identity_error_when_identity_and_target_both_differ() {
    let mut review = active_review();
    let original = review.clone();

    let result = review.archive(
        &review_id(OTHER_REVIEW_ID),
        &file_target(SpecFileKey::Impl),
        timestamp(4),
    );

    assert_eq!(
        Err(UserReviewDomainError::ArchiveIdentityMismatch {
            aggregate_id: review_id(REVIEW_ID),
            requested_id: review_id(OTHER_REVIEW_ID),
        }),
        result
    );
    assert_eq!(original, review);
}
