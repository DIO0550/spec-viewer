//! Resolve configured Spec files to repository-relative diff targets.

use std::{
    fs,
    path::{Component, Path, PathBuf},
};

use thiserror::Error;

use crate::{
    app::use_cases::spec_diff::{
        ResolveSpecDiffTargets, ResolvedSpecDiffTargets, SpecDiffTarget,
        SpecDiffTargetInvariantError,
    },
    domain::{
        repository::RepositoryRelativePath,
        spec::{SpecId, SpecNode, SpecNodeKind},
        workspace::{WorkspaceKind, WorktreeId},
    },
    infrastructure::{
        filesystem::{spec_directory_path, FilesystemSpecTreeScanner, FilesystemWorkspaceDetector},
        persistence::config::WorkspaceConfigLoader,
        spec_file_resolution::spec_file_path_candidates,
    },
};

#[derive(Debug, Error)]
pub enum SpecDiffTargetResolutionError {
    #[error("workspace detection failed")]
    WorkspaceDetection,
    #[error("workspace config load failed")]
    ConfigLoad,
    #[error("Spec tree scan failed")]
    SpecTreeScan,
    #[error("configured Spec path maps to multiple identities: {path:?}")]
    AmbiguousSpecPath { path: RepositoryRelativePath },
    #[error("Spec path escapes repository root")]
    RepositoryBoundaryEscape,
    #[error("Spec path encoding is unsupported")]
    UnsupportedPathEncoding,
    #[error("I/O error while resolving Spec targets")]
    Io,
}
impl SpecDiffTargetResolutionError {
    fn from_invariant(error: SpecDiffTargetInvariantError) -> Self {
        match error {
            SpecDiffTargetInvariantError::AmbiguousCandidatePath { path } => {
                Self::AmbiguousSpecPath { path }
            }
            SpecDiffTargetInvariantError::MissingCandidatePath { .. }
            | SpecDiffTargetInvariantError::DuplicateIdentity { .. } => Self::SpecTreeScan,
        }
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct FilesystemSpecDiffTargetResolver;

impl FilesystemSpecDiffTargetResolver {
    pub fn new() -> Self {
        Self
    }

    fn collect_targets(
        &self,
        nodes: &[SpecNode],
        primary_source_group: &str,
        layout: &crate::domain::workspace::WorkspaceLayout,
        repository_root: &Path,
        targets: &mut Vec<SpecDiffTarget>,
    ) -> Result<(), SpecDiffTargetResolutionError> {
        for node in nodes {
            if node.kind() == SpecNodeKind::Spec && node.source_group_id() == primary_source_group {
                let directory = spec_directory_path(layout, node.id())
                    .map_err(|_| SpecDiffTargetResolutionError::RepositoryBoundaryEscape)?;
                for file in node.files() {
                    let configured_path = directory.join(file.file_name());
                    let candidate_paths = spec_file_path_candidates(file.key(), &configured_path)
                        .into_iter()
                        .map(|candidate| {
                            Self::repository_relative_path(repository_root, candidate.path())
                        })
                        .collect::<Result<Vec<_>, _>>()?;
                    let target = SpecDiffTarget::new(
                        SpecId::new(node.id())
                            .map_err(|_| SpecDiffTargetResolutionError::SpecTreeScan)?,
                        file.key(),
                        candidate_paths,
                    )
                    .map_err(SpecDiffTargetResolutionError::from_invariant)?;
                    targets.push(target);
                }
            }
            self.collect_targets(
                node.children(),
                primary_source_group,
                layout,
                repository_root,
                targets,
            )?;
        }
        Ok(())
    }

    fn repository_relative_path(
        repository_root: &Path,
        candidate: &Path,
    ) -> Result<RepositoryRelativePath, SpecDiffTargetResolutionError> {
        let candidate = Self::absolute_lexical_path(candidate)?;
        let relative = candidate
            .strip_prefix(repository_root)
            .map_err(|_| SpecDiffTargetResolutionError::RepositoryBoundaryEscape)?;
        let mut parts = Vec::new();
        for component in relative.components() {
            let Component::Normal(value) = component else {
                return Err(SpecDiffTargetResolutionError::RepositoryBoundaryEscape);
            };
            parts.push(
                value
                    .to_str()
                    .ok_or(SpecDiffTargetResolutionError::UnsupportedPathEncoding)?,
            );
        }
        RepositoryRelativePath::parse(parts.join("/"))
            .map_err(|_| SpecDiffTargetResolutionError::RepositoryBoundaryEscape)
    }

    fn absolute_lexical_path(path: &Path) -> Result<PathBuf, SpecDiffTargetResolutionError> {
        if !path.is_absolute() {
            return Err(SpecDiffTargetResolutionError::RepositoryBoundaryEscape);
        }
        let mut normalized = PathBuf::new();
        for component in path.components() {
            match component {
                Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
                Component::RootDir => normalized.push(component.as_os_str()),
                Component::Normal(value) => normalized.push(value),
                Component::CurDir => {}
                Component::ParentDir => {
                    if !normalized.pop() {
                        return Err(SpecDiffTargetResolutionError::RepositoryBoundaryEscape);
                    }
                }
            }
        }
        Ok(normalized)
    }

    fn path_text(path: &Path) -> Result<String, SpecDiffTargetResolutionError> {
        path.to_str()
            .map(str::to_string)
            .ok_or(SpecDiffTargetResolutionError::UnsupportedPathEncoding)
    }
}

impl ResolveSpecDiffTargets for FilesystemSpecDiffTargetResolver {
    type Error = SpecDiffTargetResolutionError;

    fn resolve(&self, workspace_path: &str) -> Result<ResolvedSpecDiffTargets, Self::Error> {
        let layout = FilesystemWorkspaceDetector::new()
            .detect(workspace_path)
            .map_err(|_| SpecDiffTargetResolutionError::WorkspaceDetection)?;
        let config = WorkspaceConfigLoader::new()
            .load(&layout)
            .map_err(|_| SpecDiffTargetResolutionError::ConfigLoad)?;
        let nodes = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .map_err(|_| SpecDiffTargetResolutionError::SpecTreeScan)?;
        let root = fs::canonicalize(layout.root().as_str())
            .map_err(|_| SpecDiffTargetResolutionError::Io)?;
        let primary_source_group = match layout.kind() {
            WorkspaceKind::PluginWorkspace => ".plugin-workspace/.specs",
            WorkspaceKind::PluginWorktree => ".specs",
        };
        let mut targets = Vec::new();
        self.collect_targets(&nodes, primary_source_group, &layout, &root, &mut targets)?;
        let worktree = WorktreeId::new(Self::path_text(&root)?)
            .map_err(|_| SpecDiffTargetResolutionError::Io)?;

        ResolvedSpecDiffTargets::new(worktree, targets)
            .map_err(SpecDiffTargetResolutionError::from_invariant)
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn real_workspace_resolves_changed_spec_and_loads_head_diff() {
        use std::{
            process::Command,
            time::{SystemTime, UNIX_EPOCH},
        };

        use crate::{
            app::use_cases::spec_diff::SpecDiffUseCases,
            domain::repository::{ContentAvailability, StructuredDiff},
            infrastructure::git::GitRepositoryAdapter,
        };

        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "spec-viewer-spec-diff-e2e-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(root.join(".plugin-workspace/.specs/001-feature")).unwrap();
        fs::write(
            root.join(".plugin-workspace/.specs/001-feature/tasks.md"),
            "head\n",
        )
        .unwrap();
        let git = |args: &[&str]| {
            let status = Command::new("git")
                .arg("-C")
                .arg(&root)
                .args(args)
                .status()
                .unwrap();
            assert!(status.success(), "git {args:?}");
        };
        git(&["init", "-b", "main"]);
        git(&["config", "user.name", "Spec Viewer"]);
        git(&["config", "user.email", "fixture.invalid"]);
        git(&["add", "."]);
        git(&["commit", "-m", "head"]);
        fs::write(
            root.join(".plugin-workspace/.specs/001-feature/tasks.md"),
            "working\n",
        )
        .unwrap();

        let use_cases = SpecDiffUseCases::new(
            FilesystemSpecDiffTargetResolver::new(),
            GitRepositoryAdapter::default(),
        );
        let listed = use_cases
            .list_changed_spec_files(root.to_str().unwrap())
            .unwrap();
        assert_eq!(listed.files.len(), 1);
        let changed = &listed.files[0];
        assert_eq!(changed.file_key, SpecFileKey::Tasks);
        let path = changed.new_path.as_ref().unwrap().as_str().to_string();
        let detail = use_cases
            .get_spec_file_diff(
                root.to_str().unwrap(),
                listed.current_snapshot_id.as_str(),
                changed.spec_id.as_str(),
                changed.file_key.as_str(),
                &path,
            )
            .unwrap();
        assert_eq!(
            detail.review.old_content,
            ContentAvailability::Available("head\n".into())
        );
        assert_eq!(
            detail.review.new_content,
            ContentAvailability::Available("working\n".into())
        );
        assert!(matches!(
            detail.review.structured_diff,
            StructuredDiff::Available(_)
        ));

        fs::remove_dir_all(root).unwrap();
    }

    use super::*;
    use crate::domain::spec::SpecFileKey;

    #[test]
    fn repository_path_is_slash_separated_and_relative() {
        let root = Path::new("/repo");
        let path = FilesystemSpecDiffTargetResolver::repository_relative_path(
            root,
            Path::new("/repo/specs/001/tasks.md"),
        )
        .unwrap();
        assert_eq!(path.as_str(), "specs/001/tasks.md");
    }

    #[test]
    fn repository_path_rejects_boundary_escape() {
        assert!(matches!(
            FilesystemSpecDiffTargetResolver::repository_relative_path(
                Path::new("/repo"),
                Path::new("/outside/tasks.md")
            ),
            Err(SpecDiffTargetResolutionError::RepositoryBoundaryEscape)
        ));
    }

    #[test]
    fn ambiguous_aggregate_path_maps_to_resolution_error() {
        let path = RepositoryRelativePath::parse("specs/shared.md").unwrap();

        assert!(matches!(
            SpecDiffTargetResolutionError::from_invariant(
                SpecDiffTargetInvariantError::AmbiguousCandidatePath { path }
            ),
            SpecDiffTargetResolutionError::AmbiguousSpecPath { .. }
        ));
    }
}
