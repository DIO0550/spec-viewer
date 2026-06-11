//! Workspace layout detection on the local filesystem.

use std::{
    fs, io,
    path::{Path, PathBuf},
};

use thiserror::Error;

use crate::domain::workspace::{
    WorkspaceDomainError, WorkspaceKind, WorkspaceLayout, WorkspaceRoot,
};

use super::conventions::{
    display_path, SpecLayoutConvention, CLAUDE_WORKTREES_DIR, CLAUDE_WORKTREE_SPEC_CONTAINERS,
    PLUGIN_WORKSPACE_SPECS_DIR, PLUGIN_WORKTREE_SPECS_DIR, SPEC_SKILL_FEATURES_DIR,
};

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
        let mut current_directory = Some(selected_directory);

        while let Some(directory) = current_directory {
            if self
                .path_checker
                .directory_exists(directory.join(PLUGIN_WORKSPACE_SPECS_DIR))?
            {
                return Self::create_workspace_layout(directory, WorkspaceKind::PluginWorkspace);
            }

            if SpecLayoutConvention::is_plugin_worktree_directory(directory)
                && self
                    .path_checker
                    .directory_exists(directory.join(PLUGIN_WORKTREE_SPECS_DIR))?
            {
                return Self::create_workspace_layout(directory, WorkspaceKind::PluginWorktree);
            }

            if let Some(workspace_root) = self.detect_claude_worktree_collection_root(directory)? {
                return Self::create_workspace_layout(
                    &workspace_root,
                    WorkspaceKind::PluginWorkspace,
                );
            }

            if self
                .path_checker
                .directory_exists(directory.join(SPEC_SKILL_FEATURES_DIR))?
            {
                return Self::create_workspace_layout(directory, WorkspaceKind::SpecSkill);
            }

            current_directory = directory.parent();
        }

        Err(WorkspaceDetectionError::UnsupportedWorkspace {
            root: display_path(selected_directory),
        })
    }

    fn detect_claude_worktree_collection_root(
        &self,
        directory: &Path,
    ) -> Result<Option<PathBuf>, WorkspaceDetectionError> {
        for workspace_root in Self::possible_claude_worktree_collection_roots(directory) {
            if self
                .path_checker
                .directory_exists(workspace_root.join(CLAUDE_WORKTREES_DIR))?
                && self.has_claude_worktree_specs(&workspace_root)?
            {
                return Ok(Some(workspace_root));
            }
        }

        Ok(None)
    }

    fn possible_claude_worktree_collection_roots(directory: &Path) -> Vec<PathBuf> {
        let mut roots = vec![directory.to_path_buf()];
        let file_name = directory.file_name().and_then(|name| name.to_str());

        if file_name == Some(".claude") {
            if let Some(parent) = directory.parent() {
                roots.push(parent.to_path_buf());
            }
        }

        if file_name == Some("worktrees") {
            if let Some(claude_directory) = directory.parent() {
                if claude_directory.file_name().and_then(|name| name.to_str()) == Some(".claude") {
                    if let Some(parent) = claude_directory.parent() {
                        roots.push(parent.to_path_buf());
                    }
                }
            }
        }

        roots
    }

    fn has_claude_worktree_specs(
        &self,
        workspace_root: &Path,
    ) -> Result<bool, WorkspaceDetectionError> {
        let worktrees_root = workspace_root.join(CLAUDE_WORKTREES_DIR);
        let entries = match fs::read_dir(&worktrees_root) {
            Ok(entries) => entries,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(false),
            Err(source) => {
                return Err(WorkspaceDetectionError::InspectPath {
                    path: display_path(&worktrees_root),
                    source,
                });
            }
        };

        for entry in entries {
            let entry = entry.map_err(|source| WorkspaceDetectionError::InspectPath {
                path: display_path(&worktrees_root),
                source,
            })?;
            for container in CLAUDE_WORKTREE_SPEC_CONTAINERS {
                let specs_path = entry.path().join(container).join(PLUGIN_WORKTREE_SPECS_DIR);

                match fs::metadata(&specs_path) {
                    Ok(metadata) if metadata.is_dir() => return Ok(true),
                    Ok(_) => {}
                    Err(error) if error.kind() == io::ErrorKind::NotFound => {}
                    Err(source) => {
                        return Err(WorkspaceDetectionError::InspectPath {
                            path: display_path(&specs_path),
                            source,
                        });
                    }
                }
            }
        }

        Ok(false)
    }

    fn create_workspace_layout(
        root_path: &Path,
        kind: WorkspaceKind,
    ) -> Result<WorkspaceLayout, WorkspaceDetectionError> {
        let root = WorkspaceRoot::new(root_path.to_string_lossy()).map_err(|source| {
            WorkspaceDetectionError::InvalidRoot {
                root: display_path(root_path),
                source,
            }
        })?;

        Ok(WorkspaceLayout::new(root, kind))
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

#[cfg(test)]
mod tests {
    use super::super::test_support::TestWorkspace;
    use super::*;

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
    fn detects_plugin_workspace_layout_from_selected_spec_directory() {
        let workspace = TestWorkspace::new("plugin-workspace-spec-directory");
        workspace.create_dir(".plugin-workspace/.specs/021-issue-262");
        let selected_directory = workspace
            .root()
            .join(".plugin-workspace/.specs/021-issue-262");

        let layout = FilesystemWorkspaceDetector::new()
            .detect(selected_directory)
            .expect("plugin workspace should be detected from a spec directory");

        assert_eq!(workspace.root().to_string_lossy(), layout.root().as_str());
        assert_eq!(WorkspaceKind::PluginWorkspace, layout.kind());
    }

    #[test]
    fn detects_direct_plugin_worktree_layout() {
        let workspace = TestWorkspace::new("direct-plugin-worktree");
        workspace.create_dir(".claude/worktrees/feature-auth/.plugin-worktree/.specs/auth");
        let selected_directory = workspace
            .root()
            .join(".claude/worktrees/feature-auth/.plugin-worktree");

        let layout = FilesystemWorkspaceDetector::new()
            .detect(&selected_directory)
            .expect("direct plugin worktree should be detected");

        assert_eq!(selected_directory.to_string_lossy(), layout.root().as_str());
        assert_eq!(WorkspaceKind::PluginWorktree, layout.kind());
    }

    #[test]
    fn detects_repository_with_claude_plugin_worktree_specs() {
        let workspace = TestWorkspace::new("claude-worktree-repository");
        workspace.create_dir(".claude/worktrees/feature-auth/.plugin-worktree/.specs/auth");

        let layout = FilesystemWorkspaceDetector::new()
            .detect(workspace.root())
            .expect("repository with Claude plugin worktrees should be detected");

        assert_eq!(workspace.root().to_string_lossy(), layout.root().as_str());
        assert_eq!(WorkspaceKind::PluginWorkspace, layout.kind());
    }

    #[test]
    fn detects_repository_with_claude_plugin_workspace_specs() {
        let workspace = TestWorkspace::new("claude-plugin-workspace-repository");
        workspace
            .create_dir(".claude/worktrees/doccom-be/.plugin-workspace/.specs/019-be-doc-comments");

        let layout = FilesystemWorkspaceDetector::new()
            .detect(workspace.root())
            .expect("repository with Claude plugin workspace specs should be detected");

        assert_eq!(workspace.root().to_string_lossy(), layout.root().as_str());
        assert_eq!(WorkspaceKind::PluginWorkspace, layout.kind());
    }

    #[test]
    fn detects_claude_plugin_workspace_layout_from_selected_plugin_workspace_directory() {
        let workspace = TestWorkspace::new("selected-claude-plugin-workspace");
        workspace
            .create_dir(".claude/worktrees/doccom-be/.plugin-workspace/.specs/019-be-doc-comments");
        let worktree_root = workspace.root().join(".claude/worktrees/doccom-be");
        let selected_directory = worktree_root.join(".plugin-workspace");

        let layout = FilesystemWorkspaceDetector::new()
            .detect(selected_directory)
            .expect("plugin workspace directory should resolve to its worktree root");

        assert_eq!(worktree_root.to_string_lossy(), layout.root().as_str());
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
