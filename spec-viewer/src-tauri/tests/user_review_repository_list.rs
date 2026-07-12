mod support;

use std::{
    fs,
    sync::{Arc, Barrier},
    thread,
    time::Duration,
};

use spec_reviewer_lib::{
    domain::user_review::{UserReviewRecordProblemKind, UserReviewRepository},
    infrastructure::persistence::{
        user_review_document::encode_user_review_document,
        user_review_repository::ArchiveMutationObserver,
    },
};
use uuid::Uuid;

use support::user_review_repository::{
    active_review, active_review_with_source_path, archived_review, create, encoded_review, target,
    user_review_id, TestWorkspace,
};

const CLEANUP_AGE: Duration = Duration::from_secs(60 * 60);
const STALE_AGE: Duration = Duration::from_secs(2 * 60 * 60);

#[derive(Clone)]
struct CleanupGate {
    reached: Arc<Barrier>,
    resume: Arc<Barrier>,
}

impl CleanupGate {
    fn new() -> Self {
        Self {
            reached: Arc::new(Barrier::new(2)),
            resume: Arc::new(Barrier::new(2)),
        }
    }

    fn pause_cleanup(&self) {
        self.reached.wait();
        self.resume.wait();
    }

    fn run_while_paused(&self, action: impl FnOnce()) {
        self.reached.wait();
        action();
        self.resume.wait();
    }
}

#[derive(Default)]
struct BlockingCleanupObserver {
    after_validation: Option<CleanupGate>,
    after_capture: Option<CleanupGate>,
}

impl ArchiveMutationObserver for BlockingCleanupObserver {
    fn after_temp_cleanup_validation(&self) {
        if let Some(gate) = &self.after_validation {
            gate.pause_cleanup();
        }
    }

    fn after_temp_cleanup_capture(&self) {
        if let Some(gate) = &self.after_capture {
            gate.pause_cleanup();
        }
    }
}

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

#[test]
fn temp_cleanup_restores_a_fresh_replacement_after_initial_validation() {
    let workspace = TestWorkspace::new("temp-cleanup-fresh-replacement");
    let after_validation = CleanupGate::new();
    let repository = workspace.repository_with_cleanup_observer(
        CLEANUP_AGE,
        Arc::new(BlockingCleanupObserver {
            after_validation: Some(after_validation.clone()),
            ..BlockingCleanupObserver::default()
        }),
    );
    let stale = active_review(30, "Initially stale temp");
    let fresh = active_review(30, "Fresh concurrent replacement");
    let temp_path =
        workspace.known_temp_path(&workspace.active_directory(), stale.id(), Uuid::new_v4());
    workspace.write_review(&temp_path, &stale);
    workspace.set_file_age(&temp_path, STALE_AGE);

    let cleanup = thread::spawn(move || repository.list(&target()));
    after_validation.run_while_paused(|| {
        workspace.replace_review(&temp_path, &fresh);
    });
    cleanup
        .join()
        .expect("cleanup thread should finish")
        .expect("cleanup should remain best effort");

    assert_eq!(
        encoded_review(&fresh),
        fs::read(&temp_path).expect("fresh replacement should be restored")
    );
    assert!(workspace.cleanup_capture_paths().is_empty());
}

#[test]
fn temp_cleanup_restores_a_malformed_replacement_after_initial_validation() {
    let workspace = TestWorkspace::new("temp-cleanup-malformed-replacement");
    let after_validation = CleanupGate::new();
    let repository = workspace.repository_with_cleanup_observer(
        CLEANUP_AGE,
        Arc::new(BlockingCleanupObserver {
            after_validation: Some(after_validation.clone()),
            ..BlockingCleanupObserver::default()
        }),
    );
    let stale = active_review(31, "Initially valid temp");
    let temp_path =
        workspace.known_temp_path(&workspace.active_directory(), stale.id(), Uuid::new_v4());
    workspace.write_review(&temp_path, &stale);
    workspace.set_file_age(&temp_path, STALE_AGE);
    let malformed = "{\"schemaVersion\":";

    let cleanup = thread::spawn(move || repository.list(&target()));
    after_validation.run_while_paused(|| {
        workspace.replace_raw(&temp_path, malformed);
        workspace.set_file_age(&temp_path, STALE_AGE);
    });
    cleanup
        .join()
        .expect("cleanup thread should finish")
        .expect("cleanup should remain best effort");

    assert_eq!(
        malformed.as_bytes(),
        fs::read(&temp_path).expect("malformed replacement should be restored")
    );
    assert!(workspace.cleanup_capture_paths().is_empty());
}

#[test]
fn temp_cleanup_retains_canonical_and_capture_when_restore_collides() {
    let workspace = TestWorkspace::new("temp-cleanup-restore-collision");
    let after_capture = CleanupGate::new();
    let repository = workspace.repository_with_cleanup_observer(
        CLEANUP_AGE,
        Arc::new(BlockingCleanupObserver {
            after_capture: Some(after_capture.clone()),
            ..BlockingCleanupObserver::default()
        }),
    );
    let stale = active_review(32, "Initially valid temp");
    let temp_path =
        workspace.known_temp_path(&workspace.active_directory(), stale.id(), Uuid::new_v4());
    workspace.write_review(&temp_path, &stale);
    workspace.set_file_age(&temp_path, STALE_AGE);
    let malformed_capture = "{\"schemaVersion\":";
    let canonical_collision = "canonical concurrent temp";

    let cleanup = thread::spawn(move || repository.list(&target()));
    after_capture.run_while_paused(|| {
        let capture_paths = workspace.cleanup_capture_paths();
        if let Some(capture_path) = capture_paths.first() {
            workspace.replace_raw(capture_path, malformed_capture);
            workspace.set_file_age(capture_path, STALE_AGE);
        }
        workspace.write_raw(&temp_path, canonical_collision);
    });
    cleanup
        .join()
        .expect("cleanup thread should finish")
        .expect("cleanup should remain best effort");
    let capture_paths = workspace.cleanup_capture_paths();

    assert_eq!(
        canonical_collision.as_bytes(),
        fs::read(&temp_path).expect("canonical colliding temp should remain")
    );
    assert_eq!(1, capture_paths.len());
    assert_eq!(
        malformed_capture.as_bytes(),
        fs::read(&capture_paths[0]).expect("capture tombstone should remain")
    );
}
