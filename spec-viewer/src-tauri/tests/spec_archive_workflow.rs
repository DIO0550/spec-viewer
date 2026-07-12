use std::{
    env, fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use spec_reviewer_lib::{
    app::use_cases::{AppUseCaseError, FilesystemAppUseCases},
    domain::spec::SpecId,
};

struct TestWorkspace {
    root: PathBuf,
}

impl TestWorkspace {
    fn new(name: &str) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be valid")
            .as_nanos();
        let root = env::temp_dir().join(format!(
            "spec-reviewer-archive-policy-{name}-{}-{timestamp}",
            std::process::id()
        ));
        fs::create_dir_all(&root).expect("test root should be created");

        Self { root }
    }

    fn create_dir(&self, relative_path: &str) {
        fs::create_dir_all(self.root.join(relative_path)).expect("directory should be created");
    }

    fn write_file(&self, relative_path: &str) {
        let path = self.root.join(relative_path);
        fs::create_dir_all(path.parent().expect("file should have parent"))
            .expect("parent should be created");
        fs::write(path, "# Test\n").expect("file should be written");
    }

    fn path(&self, relative_path: &str) -> PathBuf {
        self.root.join(relative_path)
    }

    fn root(&self) -> &Path {
        &self.root
    }
}

impl Drop for TestWorkspace {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn spec_id(value: &str) -> SpecId {
    SpecId::new(value).expect("spec id should be valid")
}

fn loaded_workspace(
    test_workspace: &TestWorkspace,
) -> (
    FilesystemAppUseCases,
    spec_reviewer_lib::app::use_cases::LoadWorkspaceResult,
) {
    let use_cases = FilesystemAppUseCases::default();
    let workspace = use_cases
        .load_workspace(test_workspace.root().to_string_lossy())
        .expect("workspace should load");

    (use_cases, workspace)
}

#[test]
fn archive_workflow_moves_scanned_spec_to_hidden_archive() {
    let test_workspace = TestWorkspace::new("normal");
    test_workspace.write_file(".plugin-workspace/.specs/auth/tasks.md");
    let (use_cases, workspace) = loaded_workspace(&test_workspace);

    let result = use_cases
        .archive_spec(&workspace, &spec_id(".plugin-workspace/.specs/auth"))
        .expect("scanned spec should archive");

    assert_eq!(
        test_workspace.path(".plugin-workspace/.specs/.archive/auth"),
        PathBuf::from(result.archive_path())
    );
    assert!(!test_workspace
        .path(".plugin-workspace/.specs/auth")
        .exists());
    assert!(test_workspace
        .path(".plugin-workspace/.specs/.archive/auth/tasks.md")
        .exists());
}

#[test]
fn archive_workflow_keeps_collision_suffix_compatibility() {
    let test_workspace = TestWorkspace::new("suffix");
    test_workspace.write_file(".plugin-workspace/.specs/auth/tasks.md");
    test_workspace.create_dir(".plugin-workspace/.specs/.archive/auth");
    let (use_cases, workspace) = loaded_workspace(&test_workspace);

    let result = use_cases
        .archive_spec(&workspace, &spec_id(".plugin-workspace/.specs/auth"))
        .expect("scanned spec should archive");

    assert_eq!(
        test_workspace.path(".plugin-workspace/.specs/.archive/auth-1"),
        PathBuf::from(result.archive_path())
    );
    assert!(test_workspace
        .path(".plugin-workspace/.specs/.archive/auth")
        .exists());
    assert!(test_workspace
        .path(".plugin-workspace/.specs/.archive/auth-1/tasks.md")
        .exists());
}

#[test]
fn archive_workflow_does_not_move_unapproved_directories_or_unknown_id() {
    let test_workspace = TestWorkspace::new("rejected");
    test_workspace.write_file(".plugin-workspace/.specs/auth/tasks.md");
    test_workspace.create_dir(".plugin-workspace/.specs/.hidden");
    test_workspace.create_dir("misc");
    let (use_cases, workspace) = loaded_workspace(&test_workspace);
    let rejected = [
        ".plugin-workspace/.specs",
        ".plugin-workspace",
        ".plugin-workspace/.specs/.hidden",
        "misc",
        "missing",
    ];

    for requested in rejected {
        let result = use_cases.archive_spec(&workspace, &spec_id(requested));

        assert!(
            matches!(result, Err(AppUseCaseError::SpecArchive { .. })),
            "{requested} should be rejected"
        );
    }

    assert!(test_workspace.path(".plugin-workspace/.specs").exists());
    assert!(test_workspace
        .path(".plugin-workspace/.specs/.hidden")
        .exists());
    assert!(test_workspace.path("misc").exists());
    assert!(!test_workspace
        .path(".plugin-workspace/.specs/.archive")
        .exists());
}
