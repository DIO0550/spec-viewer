mod support;

use std::{
    fs,
    sync::{Arc, Barrier},
    thread,
};

use spec_reviewer_lib::domain::spec::SpecFileKey;
use spec_reviewer_lib::domain::user_review::{
    UserReviewRecordProblemKind, UserReviewRepository, UserReviewRepositoryError,
};
use spec_reviewer_lib::infrastructure::persistence::user_review_repository::ArchiveMutationObserver;

use support::user_review_repository::{
    active_review, archived_review, create, encoded_review, file_target, oversized_encoded_review,
    target, timestamp, user_review_id, TestWorkspace,
};

#[derive(Clone)]
struct ArchiveGate {
    reached: Arc<Barrier>,
    resume: Arc<Barrier>,
}

impl ArchiveGate {
    fn new() -> Self {
        Self {
            reached: Arc::new(Barrier::new(2)),
            resume: Arc::new(Barrier::new(2)),
        }
    }

    fn pause_archive(&self) {
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
struct BlockingArchiveObserver {
    before_publish: Option<ArchiveGate>,
    after_publish: Option<ArchiveGate>,
    after_capture: Option<ArchiveGate>,
}

impl ArchiveMutationObserver for BlockingArchiveObserver {
    fn before_archive_publish(&self) {
        if let Some(gate) = &self.before_publish {
            gate.pause_archive();
        }
    }

    fn after_archive_publish(&self) {
        if let Some(gate) = &self.after_publish {
            gate.pause_archive();
        }
    }

    fn after_active_capture(&self) {
        if let Some(gate) = &self.after_capture {
            gate.pause_archive();
        }
    }
}

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
fn archive_rejects_an_oversized_active_record_without_mutating_it() {
    let workspace = TestWorkspace::new("archive-oversized-active");
    let repository = workspace.repository();
    let active = active_review(36, "Oversized active must remain untouched");
    let contents = oversized_encoded_review(&active);
    let active_path = workspace.active_record_path(active.id());
    workspace.write_bytes(&active_path, &contents);

    let result = repository.archive(active.id(), active.target(), timestamp(41));

    assert_eq!(Err(UserReviewRepositoryError::Unavailable), result);
    assert_eq!(
        contents.len() as u64,
        fs::metadata(active_path)
            .expect("oversized active record should remain")
            .len()
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

#[test]
fn publish_collision_accepts_a_concurrent_valid_archive_transition_as_the_winner() {
    let workspace = TestWorkspace::new("archive-publish-collision");
    let before_publish = ArchiveGate::new();
    let repository =
        workspace.repository_with_archive_observer(Arc::new(BlockingArchiveObserver {
            before_publish: Some(before_publish.clone()),
            ..BlockingArchiveObserver::default()
        }));
    let active = active_review(16, "Archive once");
    let persisted_winner = archived_review(active.clone(), 41);
    create(&repository, active.clone());
    let id = active.id().clone();
    let review_target = active.target().clone();

    let archive = thread::spawn(move || repository.archive(&id, &review_target, timestamp(42)));
    before_publish.run_while_paused(|| {
        workspace.write_review(
            &workspace.archive_record_path(active.id()),
            &persisted_winner,
        );
    });
    let outcome = archive
        .join()
        .expect("archive thread should finish")
        .expect("valid concurrent archive should win");

    assert_eq!(&persisted_winner, outcome.user_review());
    assert!(!workspace.active_record_path(active.id()).exists());
    assert_eq!(
        encoded_review(&persisted_winner),
        fs::read(workspace.archive_record_path(active.id()))
            .expect("winning archive should remain")
    );
}

#[test]
fn archive_restores_a_concurrently_replaced_active_record_instead_of_deleting_it() {
    let workspace = TestWorkspace::new("archive-active-replacement");
    let after_publish = ArchiveGate::new();
    let repository =
        workspace.repository_with_archive_observer(Arc::new(BlockingArchiveObserver {
            after_publish: Some(after_publish.clone()),
            ..BlockingArchiveObserver::default()
        }));
    let original = active_review(17, "Original active");
    let replacement = active_review(17, "Concurrent replacement");
    create(&repository, original.clone());
    let id = original.id().clone();
    let review_target = original.target().clone();

    let archive = thread::spawn(move || repository.archive(&id, &review_target, timestamp(41)));
    after_publish.run_while_paused(|| {
        workspace.replace_review(
            &workspace.active_record_path(replacement.id()),
            &replacement,
        );
    });
    let result = archive.join().expect("archive thread should finish");

    assert_eq!(
        Err(UserReviewRepositoryError::ConflictingCopies {
            id: original.id().clone(),
        }),
        result
    );
    assert_eq!(
        encoded_review(&replacement),
        fs::read(workspace.active_record_path(original.id()))
            .expect("replacement active record should be restored")
    );
    assert!(workspace.capture_paths().is_empty());
}

#[test]
fn archive_preserves_the_capture_tombstone_when_restore_collides() {
    let workspace = TestWorkspace::new("archive-restore-collision");
    let after_publish = ArchiveGate::new();
    let after_capture = ArchiveGate::new();
    let repository =
        workspace.repository_with_archive_observer(Arc::new(BlockingArchiveObserver {
            after_publish: Some(after_publish.clone()),
            after_capture: Some(after_capture.clone()),
            ..BlockingArchiveObserver::default()
        }));
    let original = active_review(18, "Original active");
    let captured_replacement = active_review(18, "Captured replacement");
    let colliding_replacement = active_review(18, "Restore collision");
    create(&repository, original.clone());
    let id = original.id().clone();
    let review_target = original.target().clone();

    let archive = thread::spawn(move || repository.archive(&id, &review_target, timestamp(41)));
    after_publish.run_while_paused(|| {
        workspace.replace_review(
            &workspace.active_record_path(captured_replacement.id()),
            &captured_replacement,
        );
    });
    after_capture.run_while_paused(|| {
        workspace.write_review(
            &workspace.active_record_path(colliding_replacement.id()),
            &colliding_replacement,
        );
    });
    let result = archive.join().expect("archive thread should finish");
    let capture_paths = workspace.capture_paths();

    assert_eq!(
        Err(UserReviewRepositoryError::ConflictingCopies {
            id: original.id().clone(),
        }),
        result
    );
    assert_eq!(
        encoded_review(&colliding_replacement),
        fs::read(workspace.active_record_path(original.id()))
            .expect("colliding active record should remain")
    );
    assert_eq!(1, capture_paths.len());
    assert_eq!(
        encoded_review(&captured_replacement),
        fs::read(&capture_paths[0]).expect("captured replacement should remain recoverable")
    );
}

#[cfg(unix)]
#[test]
fn archive_uses_the_open_active_directory_when_its_parent_path_is_replaced() {
    use std::os::unix::fs::symlink;

    let workspace = TestWorkspace::new("archive-parent-swap");
    let after_publish = ArchiveGate::new();
    let repository =
        workspace.repository_with_archive_observer(Arc::new(BlockingArchiveObserver {
            after_publish: Some(after_publish.clone()),
            ..BlockingArchiveObserver::default()
        }));
    let original = active_review(19, "Held directory record");
    let attacker_record = active_review(19, "Symlink target record");
    create(&repository, original.clone());
    let id = original.id().clone();
    let review_target = original.target().clone();

    let archive = thread::spawn(move || repository.archive(&id, &review_target, timestamp(41)));
    let held_active = workspace.user_review_directory().join("held-active");
    let attacker_active = workspace.user_review_directory().join("attacker-active");
    after_publish.run_while_paused(|| {
        fs::rename(workspace.active_directory(), &held_active)
            .expect("active directory should move");
        fs::create_dir_all(&attacker_active).expect("attacker directory should exist");
        workspace.write_review(
            &attacker_active.join(format!("{}.json", attacker_record.id())),
            &attacker_record,
        );
        symlink(&attacker_active, workspace.active_directory())
            .expect("active path should become a symlink");
    });
    let outcome = archive
        .join()
        .expect("archive thread should finish")
        .expect("held directory archive should succeed");

    assert_eq!(original.id(), outcome.user_review().id());
    assert_eq!(
        encoded_review(&attacker_record),
        fs::read(attacker_active.join(format!("{}.json", attacker_record.id())))
            .expect("symlink target record must not be removed")
    );
    assert!(
        !held_active.join(format!("{}.json", original.id())).exists(),
        "the originally opened active directory should be cleaned"
    );
}
