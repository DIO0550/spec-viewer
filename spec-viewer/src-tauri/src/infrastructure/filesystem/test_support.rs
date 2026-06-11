//! Shared test fixtures for the filesystem adapters.

use std::{
    env, fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use crate::domain::workspace::{WorkspaceKind, WorkspaceLayout, WorkspaceRoot};

pub(crate) struct TestWorkspace {
    root: PathBuf,
}

impl TestWorkspace {
    pub(crate) fn new(name: &str) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let root = env::temp_dir().join(format!(
            "spec-reviewer-workspace-detection-{name}-{}-{timestamp}",
            std::process::id()
        ));
        fs::create_dir_all(&root).expect("test workspace root should be created");

        Self { root }
    }

    pub(crate) fn root(&self) -> &Path {
        &self.root
    }

    pub(crate) fn create_dir(&self, path: &str) {
        fs::create_dir_all(self.root.join(path)).expect("workspace marker should be created");
    }

    pub(crate) fn write_file(&self, path: &str, contents: &str) {
        let path = self.root.join(path);
        let parent = path.parent().expect("test file should have parent");
        fs::create_dir_all(parent).expect("test file parent should be created");
        fs::write(path, contents).expect("test file should be written");
    }

    pub(crate) fn layout(&self, kind: WorkspaceKind) -> WorkspaceLayout {
        let root = WorkspaceRoot::new(self.root.to_string_lossy())
            .expect("test workspace root should be valid");

        WorkspaceLayout::new(root, kind)
    }
}

impl Drop for TestWorkspace {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}
