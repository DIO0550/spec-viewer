mod support;

use std::{fs, time::Duration};

use spec_reviewer_lib::{
    domain::user_review::{UserReviewRecordProblemKind, UserReviewRepository},
    infrastructure::persistence::user_review_document::encode_user_review_document,
};
use uuid::Uuid;

use support::user_review_repository::{
    active_review, active_review_with_source_path, archived_review, create, target, user_review_id,
    TestWorkspace,
};

#[test]
fn malformed_unsupported_and_legacy_records_do_not_block_valid_list_results() {
    let workspace = TestWorkspace::new("list-problems");
    let repository = workspace.repository();
    let valid = active_review(20, "Keep listing this review");
    create(&repository, valid.clone());
    workspace.write_raw(
        &workspace.active_directory().join("broken.json"),
        "{\"schemaVersion\":",
    );
    let unsupported = active_review(21, "Unsupported version");
    let unsupported_json = encode_user_review_document(&unsupported)
        .expect("test review should encode")
        .replacen(
            "spec-reviewer.user-review.v1",
            "spec-reviewer.user-review.v2",
            1,
        );
    workspace.write_raw(
        &workspace.active_record_path(unsupported.id()),
        &unsupported_json,
    );
    let legacy = workspace.active_directory().join("legacy-review-run");
    fs::create_dir_all(&legacy).expect("legacy folder should be created");

    let listed = repository
        .list(&target())
        .expect("record problems should not fail list");
    let kinds = listed
        .problems()
        .iter()
        .map(|problem| problem.kind())
        .collect::<Vec<_>>();

    assert_eq!(vec![valid], listed.active());
    assert!(listed.archived().is_empty());
    assert!(kinds.contains(&UserReviewRecordProblemKind::MalformedRecord));
    assert!(kinds.contains(&UserReviewRecordProblemKind::UnsupportedRecordVersion));
    assert!(kinds.contains(&UserReviewRecordProblemKind::LegacyRecord));
    assert!(legacy.is_dir());
}

#[test]
fn persisted_source_mapping_mismatch_is_isolated_as_a_malformed_record() {
    let workspace = TestWorkspace::new("persisted-source-mismatch");
    let repository = workspace.repository();
    let valid = active_review(22, "Valid review");
    create(&repository, valid.clone());
    let mismatched = active_review_with_source_path(
        23,
        "Mismatched source",
        ".plugin-workspace/.specs/001-auth-flow/requirements.md",
    );
    workspace.write_review(&workspace.active_record_path(mismatched.id()), &mismatched);

    let listed = repository
        .list(&target())
        .expect("malformed record should not fail list");

    assert_eq!(vec![valid], listed.active());
    assert_eq!(1, listed.problems().len());
    assert_eq!(
        UserReviewRecordProblemKind::MalformedRecord,
        listed.problems()[0].kind()
    );
}

#[test]
fn collection_status_and_filename_id_mismatches_are_isolated_as_malformed_records() {
    let workspace = TestWorkspace::new("record-location-mismatches");
    let repository = workspace.repository();
    let archived_in_active = archived_review(active_review(27, "Wrong collection"), 41);
    workspace.write_review(
        &workspace.active_record_path(archived_in_active.id()),
        &archived_in_active,
    );
    let wrong_filename = active_review(28, "Wrong filename");
    workspace.write_review(
        &workspace.active_record_path(&user_review_id(29)),
        &wrong_filename,
    );

    let listed = repository
        .list(&target())
        .expect("record location mismatches should not fail list");

    assert!(listed.active().is_empty());
    assert!(listed.archived().is_empty());
    assert_eq!(2, listed.problems().len());
    assert!(listed
        .problems()
        .iter()
        .all(|problem| problem.kind() == UserReviewRecordProblemKind::MalformedRecord));
}

#[test]
fn temp_cleanup_requires_owned_name_stale_age_and_valid_matching_content() {
    let workspace = TestWorkspace::new("temp-cleanup");
    let repository = workspace.repository();
    let valid = active_review(24, "Visible review");
    create(&repository, valid);
    let temp_review = active_review(25, "Abandoned valid temp");
    let valid_temp = workspace.known_temp_path(
        &workspace.active_directory(),
        temp_review.id(),
        Uuid::new_v4(),
    );
    workspace.write_review(&valid_temp, &temp_review);
    let malformed_id = user_review_id(26);
    let malformed_temp =
        workspace.known_temp_path(&workspace.active_directory(), &malformed_id, Uuid::new_v4());
    workspace.write_raw(&malformed_temp, "{\"schemaVersion\":");
    let unknown_temp = workspace.active_directory().join(".unknown.tmp");
    workspace.write_raw(&unknown_temp, "unowned");
    let mismatched_id_temp = workspace.known_temp_path(
        &workspace.active_directory(),
        &user_review_id(27),
        Uuid::new_v4(),
    );
    workspace.write_review(&mismatched_id_temp, &active_review(28, "Different ID"));
    let archived_temp_review = archived_review(active_review(29, "Wrong status"), 41);
    let mismatched_status_temp = workspace.known_temp_path(
        &workspace.active_directory(),
        archived_temp_review.id(),
        Uuid::new_v4(),
    );
    workspace.write_review(&mismatched_status_temp, &archived_temp_review);

    repository
        .list(&target())
        .expect("fresh temps should be ignored");

    assert!(valid_temp.exists());
    assert!(malformed_temp.exists());
    assert!(unknown_temp.exists());
    assert!(mismatched_id_temp.exists());
    assert!(mismatched_status_temp.exists());

    workspace
        .repository_with_cleanup_age(Duration::ZERO)
        .list(&target())
        .expect("eligible valid temp cleanup should not fail list");

    assert!(!valid_temp.exists());
    assert!(malformed_temp.exists());
    assert!(unknown_temp.exists());
    assert!(mismatched_id_temp.exists());
    assert!(mismatched_status_temp.exists());
}
