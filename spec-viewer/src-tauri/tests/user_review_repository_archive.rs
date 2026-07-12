mod support;

use std::fs;

use spec_reviewer_lib::domain::spec::SpecFileKey;
use spec_reviewer_lib::domain::user_review::{
    UserReviewRecordProblemKind, UserReviewRepository, UserReviewRepositoryError,
};

use support::user_review_repository::{
    active_review, archived_review, create, file_target, target, timestamp, user_review_id,
    TestWorkspace,
};

#[test]
fn archive_durably_publishes_before_removing_active_and_is_idempotent() {
    let workspace = TestWorkspace::new("archive");
    let repository = workspace.repository();
    let active = active_review(10, "Archive this instruction");
    create(&repository, active.clone());

    let first = repository
        .archive(active.id(), active.target(), timestamp(41))
        .expect("active review should archive");
    let archived_bytes = fs::read(workspace.archive_record_path(active.id()))
        .expect("archive record should be published");
    let second = repository
        .archive(active.id(), active.target(), timestamp(42))
        .expect("archive-only record should be idempotent");

    assert!(!workspace.active_record_path(active.id()).exists());
    assert!(!archived_bytes.is_empty());
    assert_eq!(first.user_review(), second.user_review());
    assert!(first.problems().is_empty());
    assert!(second.problems().is_empty());
}

#[test]
fn matching_partial_duplicate_lists_archived_once_and_archive_retry_cleans_active() {
    let workspace = TestWorkspace::new("recoverable-duplicate");
    let repository = workspace.repository();
    let active = active_review(11, "Recover this archive");
    let archived = archived_review(active.clone(), 41);
    create(&repository, active.clone());
    workspace.write_review(&workspace.archive_record_path(active.id()), &archived);

    let listed = repository
        .list(&target())
        .expect("recoverable duplicate should list");
    let recovered = repository
        .archive(active.id(), active.target(), timestamp(42))
        .expect("archive retry should clean active");

    assert!(listed.active().is_empty());
    assert_eq!(vec![archived.clone()], listed.archived());
    assert_eq!(1, listed.problems().len());
    assert_eq!(
        UserReviewRecordProblemKind::RecoverableDuplicate,
        listed.problems()[0].kind()
    );
    assert_eq!(&archived, recovered.user_review());
    assert!(!workspace.active_record_path(active.id()).exists());
    assert!(workspace.archive_record_path(active.id()).exists());
}

#[test]
fn conflicting_copies_are_reported_without_mutating_either_record() {
    let workspace = TestWorkspace::new("conflicting-copies");
    let repository = workspace.repository();
    let active = active_review(12, "Original active content");
    let conflicting = archived_review(active_review(12, "Different archived content"), 41);
    create(&repository, active.clone());
    workspace.write_review(&workspace.archive_record_path(active.id()), &conflicting);
    let active_before =
        fs::read(workspace.active_record_path(active.id())).expect("active should exist");
    let archive_before =
        fs::read(workspace.archive_record_path(active.id())).expect("archive should exist");

    let result = repository.archive(active.id(), active.target(), timestamp(42));

    assert_eq!(
        Err(UserReviewRepositoryError::ConflictingCopies {
            id: active.id().clone(),
        }),
        result
    );
    assert_eq!(
        active_before,
        fs::read(workspace.active_record_path(active.id())).expect("active should remain")
    );
    assert_eq!(
        archive_before,
        fs::read(workspace.archive_record_path(active.id())).expect("archive should remain")
    );

    let listed = repository
        .list(&target())
        .expect("conflict should be a list problem");
    assert!(listed.active().is_empty());
    assert!(listed.archived().is_empty());
    assert_eq!(
        UserReviewRecordProblemKind::ConflictingCopies,
        listed.problems()[0].kind()
    );
}

#[test]
fn archive_returns_not_found_for_an_unknown_id() {
    let workspace = TestWorkspace::new("archive-not-found");
    let repository = workspace.repository();
    let id = user_review_id(13);

    let result = repository.archive(&id, &target(), timestamp(41));

    assert_eq!(Err(UserReviewRepositoryError::NotFound { id }), result);
}

#[test]
fn archive_rejects_a_target_mismatch_without_mutating_the_active_record() {
    let workspace = TestWorkspace::new("archive-target-mismatch");
    let repository = workspace.repository();
    let active = active_review(14, "Keep this active");
    create(&repository, active.clone());
    let before =
        fs::read(workspace.active_record_path(active.id())).expect("active record should exist");
    let mismatched_target = file_target(SpecFileKey::Requirements);

    let result = repository.archive(active.id(), &mismatched_target, timestamp(41));

    assert_eq!(
        Err(UserReviewRepositoryError::TargetMismatch {
            id: active.id().clone(),
        }),
        result
    );
    assert_eq!(
        before,
        fs::read(workspace.active_record_path(active.id())).expect("active record should remain")
    );
    assert!(!workspace.archive_record_path(active.id()).exists());
}

#[test]
fn archive_refuses_a_legacy_bundle_without_removing_it() {
    let workspace = TestWorkspace::new("archive-legacy");
    let repository = workspace.repository();
    let id = user_review_id(15);
    let legacy_directory = workspace.active_directory().join(id.as_str());
    fs::create_dir_all(&legacy_directory).expect("legacy directory should be created");
    fs::write(legacy_directory.join("manifest.json"), "legacy")
        .expect("legacy marker should be written");

    let result = repository.archive(&id, &target(), timestamp(41));

    assert_eq!(Err(UserReviewRepositoryError::LegacyRecord { id }), result);
    assert!(legacy_directory.join("manifest.json").exists());
}
