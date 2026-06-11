//! Archival of spec directories into hidden archive folders.

use std::{
    fs, io,
    path::{Path, PathBuf},
};

use thiserror::Error;

use crate::domain::{
    spec::{SafeSpecPath, SafeSpecPathError},
    workspace::WorkspaceLayout,
};

use super::conventions::{display_path, SpecLayoutConvention, SPEC_ARCHIVE_DIRECTORY};

/// Moves spec directories into their source root's archive directory.
#[derive(Debug, Clone, Copy, Default)]
pub struct SpecArchiver;

impl SpecArchiver {
    pub fn archive_spec_directory(
        layout: &WorkspaceLayout,
        spec_id: &str,
    ) -> Result<PathBuf, SpecArchiveError> {
        let relative_spec_path = SafeSpecPath::parse(spec_id)
            .map_err(SpecArchiveError::from)?
            .into_path_buf();
        let archive_paths = Self::archive_spec_paths(layout, &relative_spec_path)?;

        if archive_paths.relative_spec_path.as_os_str().is_empty() {
            return Err(SpecArchiveError::SourceGroupRoot {
                spec_id: spec_id.to_string(),
            });
        }

        let metadata =
            fs::metadata(&archive_paths.source_path).map_err(|source| match source.kind() {
                io::ErrorKind::NotFound => SpecArchiveError::MissingSpecDirectory {
                    path: display_path(&archive_paths.source_path),
                },
                _ => SpecArchiveError::InspectSpecDirectory {
                    path: display_path(&archive_paths.source_path),
                    source,
                },
            })?;

        if !metadata.is_dir() {
            return Err(SpecArchiveError::NotSpecDirectory {
                path: display_path(&archive_paths.source_path),
            });
        }

        let archive_root = archive_paths.source_root.join(SPEC_ARCHIVE_DIRECTORY);
        let destination_path =
            Self::unique_archive_destination(&archive_root, &archive_paths.relative_spec_path);
        let parent = destination_path.parent().ok_or_else(|| {
            SpecArchiveError::InvalidArchiveDestination {
                path: display_path(&destination_path),
            }
        })?;

        fs::create_dir_all(parent).map_err(|source| SpecArchiveError::CreateArchiveDirectory {
            path: display_path(parent),
            source,
        })?;
        fs::rename(&archive_paths.source_path, &destination_path).map_err(|source| {
            SpecArchiveError::MoveSpecDirectory {
                source_path: display_path(&archive_paths.source_path),
                archive_path: display_path(&destination_path),
                source,
            }
        })?;

        Ok(destination_path)
    }

    fn archive_spec_paths(
        layout: &WorkspaceLayout,
        relative_spec_path: &Path,
    ) -> Result<ArchiveSpecPaths, SpecArchiveError> {
        let workspace_root = PathBuf::from(layout.root().as_str());

        if let Some(source_root_relative) =
            SpecLayoutConvention::claude_plugin_worktree_source_root(relative_spec_path)
        {
            let relative_path = relative_spec_path
                .strip_prefix(&source_root_relative)
                .map_err(|_| SpecArchiveError::InvalidArchiveSource {
                    spec_id: display_path(relative_spec_path),
                })?
                .to_path_buf();

            return Ok(ArchiveSpecPaths {
                source_path: workspace_root.join(relative_spec_path),
                source_root: workspace_root.join(source_root_relative),
                relative_spec_path: relative_path,
            });
        }

        let source_root_relative = Path::new(SpecLayoutConvention::spec_root_directory_for_kind(
            layout.kind(),
        ));
        let source_root = workspace_root.join(source_root_relative);
        let relative_path = relative_spec_path
            .strip_prefix(source_root_relative)
            .unwrap_or(relative_spec_path)
            .to_path_buf();

        Ok(ArchiveSpecPaths {
            source_path: source_root.join(&relative_path),
            source_root,
            relative_spec_path: relative_path,
        })
    }

    fn unique_archive_destination(archive_root: &Path, relative_spec_path: &Path) -> PathBuf {
        let destination = archive_root.join(relative_spec_path);

        if !destination.exists() {
            return destination;
        }

        let Some(parent) = destination.parent() else {
            return destination;
        };
        let Some(file_name) = destination.file_name().and_then(|name| name.to_str()) else {
            return destination;
        };

        for index in 1.. {
            let candidate = parent.join(format!("{file_name}-{index}"));

            if !candidate.exists() {
                return candidate;
            }
        }

        destination
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ArchiveSpecPaths {
    source_path: PathBuf,
    source_root: PathBuf,
    relative_spec_path: PathBuf,
}

#[derive(Debug, Error)]
pub enum SpecArchiveError {
    #[error("spec id cannot be archived because it is a source group root: {spec_id}")]
    SourceGroupRoot { spec_id: String },
    #[error("spec id cannot be archived because it is invalid: {source}")]
    InvalidSpecId { source: SafeSpecPathError },
    #[error("spec archive source is invalid: {spec_id}")]
    InvalidArchiveSource { spec_id: String },
    #[error("spec directory does not exist: {path}")]
    MissingSpecDirectory { path: String },
    #[error("failed to inspect spec directory: {path}")]
    InspectSpecDirectory { path: String, source: io::Error },
    #[error("spec path is not a directory: {path}")]
    NotSpecDirectory { path: String },
    #[error("spec archive destination is invalid: {path}")]
    InvalidArchiveDestination { path: String },
    #[error("failed to create spec archive directory: {path}")]
    CreateArchiveDirectory { path: String, source: io::Error },
    #[error("failed to move spec directory from {source_path} to {archive_path}")]
    MoveSpecDirectory {
        source_path: String,
        archive_path: String,
        source: io::Error,
    },
}

impl From<SafeSpecPathError> for SpecArchiveError {
    fn from(source: SafeSpecPathError) -> Self {
        Self::InvalidSpecId { source }
    }
}

#[cfg(test)]
mod tests {
    use super::super::conventions::PLUGIN_WORKSPACE_SPECS_DIR;
    use super::super::test_support::TestWorkspace;
    use super::*;
    use crate::domain::workspace::WorkspaceKind;

    #[test]
    fn archive_spec_directory_moves_plugin_workspace_spec_to_hidden_archive() {
        let workspace = TestWorkspace::new("archive-plugin-workspace-spec");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.write_file(".plugin-workspace/.specs/auth/tasks.md", "# Tasks");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let archive_path =
            SpecArchiver::archive_spec_directory(&layout, ".plugin-workspace/.specs/auth")
                .expect("spec should be archived");

        assert_eq!(
            workspace
                .root()
                .join(".plugin-workspace/.specs/.archive/auth"),
            archive_path
        );
        assert!(!workspace
            .root()
            .join(".plugin-workspace/.specs/auth")
            .exists());
        assert!(workspace
            .root()
            .join(".plugin-workspace/.specs/.archive/auth/tasks.md")
            .exists());
    }

    #[test]
    fn archive_spec_directory_uses_suffix_when_archive_destination_exists() {
        let workspace = TestWorkspace::new("archive-plugin-workspace-spec-conflict");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.write_file(".plugin-workspace/.specs/auth/tasks.md", "# New");
        workspace.write_file(".plugin-workspace/.specs/.archive/auth/tasks.md", "# Old");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let archive_path =
            SpecArchiver::archive_spec_directory(&layout, ".plugin-workspace/.specs/auth")
                .expect("spec should be archived with suffix");

        assert_eq!(
            workspace
                .root()
                .join(".plugin-workspace/.specs/.archive/auth-1"),
            archive_path
        );
        assert!(workspace
            .root()
            .join(".plugin-workspace/.specs/.archive/auth-1/tasks.md")
            .exists());
    }

    #[test]
    fn archive_spec_directory_rejects_source_group_root() {
        let workspace = TestWorkspace::new("archive-source-group-root");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let result = SpecArchiver::archive_spec_directory(&layout, ".plugin-workspace/.specs");

        assert!(matches!(
            result,
            Err(SpecArchiveError::SourceGroupRoot { .. })
        ));
    }
}
