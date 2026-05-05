//! Filesystem adapters.

use std::{
    fs, io,
    path::{Path, PathBuf},
};

use thiserror::Error;

use crate::domain::workspace::{
    WorkspaceDomainError, WorkspaceKind, WorkspaceLayout, WorkspaceRoot,
};

const PLUGIN_WORKSPACE_SPECS_DIR: &str = ".plugin-workspace/.specs";
const SPEC_SKILL_FEATURES_DIR: &str = ".spec-skill/features";

#[derive(Debug, Clone, Copy, Default)]
pub struct FilesystemWorkspaceDetector {
    path_checker: FilesystemPathChecker,
}

impl FilesystemWorkspaceDetector {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn detect(
        &self,
        selected_directory: impl AsRef<Path>,
    ) -> Result<WorkspaceLayout, WorkspaceDetectionError> {
        let selected_directory = selected_directory.as_ref();
        let root = WorkspaceRoot::new(selected_directory.to_string_lossy()).map_err(|source| {
            WorkspaceDetectionError::InvalidRoot {
                root: display_path(selected_directory),
                source,
            }
        })?;

        if self
            .path_checker
            .directory_exists(selected_directory.join(PLUGIN_WORKSPACE_SPECS_DIR))?
        {
            return Ok(WorkspaceLayout::new(root, WorkspaceKind::PluginWorkspace));
        }

        if self
            .path_checker
            .directory_exists(selected_directory.join(SPEC_SKILL_FEATURES_DIR))?
        {
            return Ok(WorkspaceLayout::new(root, WorkspaceKind::SpecSkill));
        }

        Err(WorkspaceDetectionError::UnsupportedWorkspace {
            root: display_path(selected_directory),
        })
    }
}

#[derive(Debug, Clone, Copy, Default)]
struct FilesystemPathChecker;

impl FilesystemPathChecker {
    fn directory_exists(&self, path: PathBuf) -> Result<bool, WorkspaceDetectionError> {
        match fs::metadata(&path) {
            Ok(metadata) => Ok(metadata.is_dir()),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
            Err(source) => Err(WorkspaceDetectionError::InspectPath {
                path: display_path(&path),
                source,
            }),
        }
    }
}

#[derive(Debug, Error)]
pub enum WorkspaceDetectionError {
    #[error("workspace root is invalid: {root}")]
    InvalidRoot {
        root: String,
        source: WorkspaceDomainError,
    },
    #[error("unsupported workspace layout at: {root}")]
    UnsupportedWorkspace { root: String },
    #[error("failed to inspect workspace path: {path}")]
    InspectPath { path: String, source: io::Error },
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;

    struct TestWorkspace {
        root: PathBuf,
    }

    impl TestWorkspace {
        fn new(name: &str) -> Self {
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

        fn root(&self) -> &Path {
            &self.root
        }

        fn create_dir(&self, path: &str) {
            fs::create_dir_all(self.root.join(path)).expect("workspace marker should be created");
        }
    }

    impl Drop for TestWorkspace {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn detects_plugin_workspace_layout() {
        let workspace = TestWorkspace::new("plugin-workspace");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);

        let layout = FilesystemWorkspaceDetector::new()
            .detect(workspace.root())
            .expect("plugin workspace should be detected");

        assert_eq!(workspace.root().to_string_lossy(), layout.root().as_str());
        assert_eq!(WorkspaceKind::PluginWorkspace, layout.kind());
    }

    #[test]
    fn detects_spec_skill_workspace_layout() {
        let workspace = TestWorkspace::new("spec-skill");
        workspace.create_dir(SPEC_SKILL_FEATURES_DIR);

        let layout = FilesystemWorkspaceDetector::new()
            .detect(workspace.root())
            .expect("spec-skill workspace should be detected");

        assert_eq!(workspace.root().to_string_lossy(), layout.root().as_str());
        assert_eq!(WorkspaceKind::SpecSkill, layout.kind());
    }

    #[test]
    fn prefers_plugin_workspace_layout_when_both_markers_exist() {
        let workspace = TestWorkspace::new("both");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.create_dir(SPEC_SKILL_FEATURES_DIR);

        let layout = FilesystemWorkspaceDetector::new()
            .detect(workspace.root())
            .expect("workspace should be detected");

        assert_eq!(WorkspaceKind::PluginWorkspace, layout.kind());
    }

    #[test]
    fn rejects_unsupported_workspace_layout() {
        let workspace = TestWorkspace::new("unsupported");

        let result = FilesystemWorkspaceDetector::new().detect(workspace.root());

        assert!(matches!(
            result,
            Err(WorkspaceDetectionError::UnsupportedWorkspace { root })
                if root == workspace.root().to_string_lossy()
        ));
    }
}
