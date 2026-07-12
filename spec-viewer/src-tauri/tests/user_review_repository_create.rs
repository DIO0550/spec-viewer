mod support;

use std::fs;

use spec_reviewer_lib::domain::user_review::{UserReviewRepository, UserReviewRepositoryError};

use support::user_review_repository::{
    active_review, archived_review, create, oversized_encoded_review, target, TestWorkspace,
};

#[test]
fn create_publishes_one_canonical_active_document_and_lists_it() {
    let workspace = TestWorkspace::new("create");
    let repository = workspace.repository();
    let review = active_review(1, "Split this into separate tasks");

    let created = create(&repository, review.clone());
    let persisted =
        fs::read_to_string(workspace.active_record_path(review.id())).expect("record should exist");
    let listed = repository
        .list(&target())
        .expect("created review should list");

    assert_eq!(review, created);
    assert!(persisted.ends_with('\n'));
    assert_eq!(vec![review], listed.active());
    assert!(listed.archived().is_empty());
    assert!(listed.problems().is_empty());
    assert_eq!(
        1,
        fs::read_dir(workspace.active_directory())
            .expect("active directory should exist")
            .count()
    );
}

#[test]
fn create_collision_never_overwrites_the_existing_record() {
    let workspace = TestWorkspace::new("create-collision");
    let repository = workspace.repository();
    let original = active_review(2, "Keep the original instruction");
    let conflicting = active_review(2, "Do not overwrite this record");
    create(&repository, original.clone());
    let before = fs::read(workspace.active_record_path(original.id()))
        .expect("original record should exist");

    let result = repository.create(conflicting);
    let after = fs::read(workspace.active_record_path(original.id()))
        .expect("original record should remain");

    assert_eq!(
        Err(UserReviewRepositoryError::AlreadyExists {
            id: original.id().clone(),
        }),
        result
    );
    assert_eq!(before, after);
}

#[test]
fn create_collision_preserves_an_oversized_existing_record() {
    let workspace = TestWorkspace::new("create-oversized-collision");
    let repository = workspace.repository();
    let attempted = active_review(8, "Do not replace oversized storage");
    let contents = oversized_encoded_review(&attempted);
    let active_path = workspace.active_record_path(attempted.id());
    workspace.write_bytes(&active_path, &contents);

    let result = repository.create(attempted.clone());

    assert_eq!(
        Err(UserReviewRepositoryError::AlreadyExists {
            id: attempted.id().clone(),
        }),
        result
    );
    assert_eq!(
        contents.len() as u64,
        fs::metadata(active_path)
            .expect("oversized existing record should remain")
            .len()
    );
    assert!(!workspace.archive_record_path(attempted.id()).exists());
}

#[test]
fn create_rejects_a_source_path_that_disagrees_with_workspace_mapping() {
    let workspace = TestWorkspace::new("source-mapping");
    let repository = workspace.repository();
    let review = support::user_review_repository::active_review_with_source_path(
        3,
        "Invalid source mapping",
        ".plugin-workspace/.specs/001-auth-flow/requirements.md",
    );

    let result = repository.create(review.clone());

    assert_eq!(
        Err(UserReviewRepositoryError::InvalidState {
            id: review.id().clone(),
        }),
        result
    );
    assert!(!workspace.active_record_path(review.id()).exists());
}

#[test]
fn create_rejects_an_archived_aggregate_without_publishing_a_record() {
    let workspace = TestWorkspace::new("create-archived");
    let repository = workspace.repository();
    let review = archived_review(active_review(4, "Already archived"), 41);

    let result = repository.create(review.clone());

    assert_eq!(
        Err(UserReviewRepositoryError::InvalidState {
            id: review.id().clone(),
        }),
        result
    );
    assert!(!workspace.active_record_path(review.id()).exists());
    assert!(!workspace.archive_record_path(review.id()).exists());
}

#[cfg(unix)]
#[test]
fn create_rejects_a_user_review_directory_symlink_escape_without_writing_outside() {
    use std::os::unix::fs::symlink;

    use uuid::Uuid;

    let workspace = TestWorkspace::new("create-symlink-escape");
    let repository = workspace.repository();
    let review = active_review(5, "Do not write through the symlink");
    let outside = std::env::temp_dir().join(format!(
        "spec-reviewer-user-review-outside-{}",
        Uuid::new_v4().simple()
    ));
    fs::create_dir_all(&outside).expect("outside directory should exist");
    symlink(&outside, workspace.user_review_directory())
        .expect("user-review path should be a symlink");

    let result = repository.create(review.clone());
    let outside_is_empty = fs::read_dir(&outside)
        .expect("outside directory should remain readable")
        .next()
        .is_none();
    fs::remove_dir_all(&outside).expect("outside directory should be cleaned");

    assert_eq!(Err(UserReviewRepositoryError::Unavailable), result);
    assert!(outside_is_empty);
    assert!(!workspace.active_record_path(review.id()).exists());
}

#[cfg(unix)]
#[test]
fn create_treats_permission_denied_as_unavailable_instead_of_absent() {
    use std::os::unix::fs::PermissionsExt;

    let workspace = TestWorkspace::new("create-permission-denied");
    let repository = workspace.repository();
    let existing = active_review(6, "Create the protected collection");
    let attempted = active_review(7, "Must not treat an I/O error as absence");
    create(&repository, existing);
    let active_directory = workspace.active_directory();
    let mut denied_permissions = fs::metadata(&active_directory)
        .expect("active directory should exist")
        .permissions();
    denied_permissions.set_mode(0o000);
    fs::set_permissions(&active_directory, denied_permissions)
        .expect("active directory should become inaccessible");

    let result = repository.create(attempted.clone());

    let mut restored_permissions = fs::metadata(&active_directory)
        .expect("active directory metadata should remain available")
        .permissions();
    restored_permissions.set_mode(0o700);
    fs::set_permissions(&active_directory, restored_permissions)
        .expect("active directory permissions should be restored");

    assert_eq!(Err(UserReviewRepositoryError::Unavailable), result);
    assert!(!workspace.active_record_path(attempted.id()).exists());
}
