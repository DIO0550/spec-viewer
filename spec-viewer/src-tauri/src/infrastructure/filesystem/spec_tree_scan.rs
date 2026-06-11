//! Recursive scanning of workspace spec trees.

use std::{
    fs, io,
    path::{Path, PathBuf},
};

use thiserror::Error;

use crate::domain::{
    spec::{SpecDocumentFormat, SpecDomainError, SpecFile, SpecFileKey, SpecFileStatus, SpecNode},
    workspace::{WorkspaceConfig, WorkspaceKind, WorkspaceLayout},
};
use crate::infrastructure::persistence::config::{ConfigLoadError, WorkspaceConfigLoader};
use crate::infrastructure::spec_file_resolution::{
    spec_file_path_candidates, SpecFilePathCandidate,
};

use super::conventions::{
    display_path, SpecLayoutConvention, CLAUDE_WORKTREES_DIR, CLAUDE_WORKTREE_SPEC_CONTAINERS,
    PLUGIN_WORKTREE_SPECS_DIR,
};
use super::spec_paths::SpecPathResolver;

#[derive(Debug, Clone, Copy, Default)]
pub struct FilesystemSpecTreeScanner;

impl FilesystemSpecTreeScanner {
    pub fn new() -> Self {
        Self
    }

    pub fn scan(
        &self,
        layout: &WorkspaceLayout,
        config: &WorkspaceConfig,
    ) -> Result<Vec<SpecNode>, SpecTreeScanError> {
        let mut nodes = Vec::new();

        for root in self.spec_scan_roots(layout)? {
            let id = root.parent_id().to_string();
            let children = self.scan_child_directories(&root.path, &id, config)?;

            if let Some(label) = root.label {
                let node =
                    SpecNode::new(id.clone(), label, Vec::new(), children).map_err(|source| {
                        SpecTreeScanError::InvalidNode {
                            id,
                            path: display_path(&root.path),
                            source,
                        }
                    })?;

                nodes.push(node);
                continue;
            }

            nodes.extend(children);
        }

        Ok(nodes)
    }

    fn spec_scan_roots(
        &self,
        layout: &WorkspaceLayout,
    ) -> Result<Vec<SpecScanRoot>, SpecTreeScanError> {
        let mut roots = Vec::new();
        let primary_root = SpecPathResolver::spec_root_path(layout);

        if self.directory_exists_for_scan(&primary_root)? {
            if let Some((id_prefix, label)) =
                SpecLayoutConvention::primary_source_group_for_kind(layout.kind())
            {
                roots.push(SpecScanRoot::source_group(
                    primary_root,
                    id_prefix.to_string(),
                    label.to_string(),
                ));
            } else {
                roots.push(SpecScanRoot::primary(primary_root));
            }
        }

        if layout.kind() == WorkspaceKind::PluginWorkspace {
            roots.extend(
                self.collect_claude_worktree_scan_roots(Path::new(layout.root().as_str()))?,
            );
        }

        Ok(roots)
    }

    fn collect_claude_worktree_scan_roots(
        &self,
        workspace_root: &Path,
    ) -> Result<Vec<SpecScanRoot>, SpecTreeScanError> {
        let worktrees_root = workspace_root.join(CLAUDE_WORKTREES_DIR);
        let entries = match fs::read_dir(&worktrees_root) {
            Ok(entries) => entries,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(source) => {
                return Err(SpecTreeScanError::ReadDirectory {
                    path: display_path(&worktrees_root),
                    source,
                });
            }
        };
        let mut roots = Vec::new();

        for entry in entries {
            let entry = entry.map_err(|source| SpecTreeScanError::ReadDirectory {
                path: display_path(&worktrees_root),
                source,
            })?;
            let file_type = entry
                .file_type()
                .map_err(|source| SpecTreeScanError::InspectPath {
                    path: display_path(&entry.path()),
                    source,
                })?;

            if !file_type.is_dir() {
                continue;
            }

            let worktree_name = entry.file_name().to_string_lossy().into_owned();

            for container in CLAUDE_WORKTREE_SPEC_CONTAINERS {
                let specs_path = entry.path().join(container).join(PLUGIN_WORKTREE_SPECS_DIR);

                if !self.directory_exists_for_scan(&specs_path)? {
                    continue;
                }

                roots.push(SpecScanRoot::worktree(
                    specs_path,
                    format!(
                        ".claude/worktrees/{worktree_name}/{container}/{PLUGIN_WORKTREE_SPECS_DIR}"
                    ),
                    format!("{worktree_name} ({container})"),
                ));
            }
        }

        roots.sort_by(|left, right| left.id_prefix.cmp(&right.id_prefix));

        Ok(roots)
    }

    fn directory_exists_for_scan(&self, path: &Path) -> Result<bool, SpecTreeScanError> {
        match fs::metadata(path) {
            Ok(metadata) => Ok(metadata.is_dir()),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
            Err(source) => Err(SpecTreeScanError::InspectPath {
                path: display_path(path),
                source,
            }),
        }
    }

    fn scan_child_directories(
        &self,
        directory: &Path,
        parent_id: &str,
        config: &WorkspaceConfig,
    ) -> Result<Vec<SpecNode>, SpecTreeScanError> {
        let entries =
            fs::read_dir(directory).map_err(|source| SpecTreeScanError::ReadDirectory {
                path: display_path(directory),
                source,
            })?;
        let mut child_directories = Vec::new();

        for entry in entries {
            let entry = entry.map_err(|source| SpecTreeScanError::ReadDirectory {
                path: display_path(directory),
                source,
            })?;
            let file_name = entry.file_name().to_string_lossy().into_owned();

            if Self::is_hidden_name(&file_name) || Self::is_scan_excluded_name(&file_name, config) {
                continue;
            }

            let file_type = entry
                .file_type()
                .map_err(|source| SpecTreeScanError::InspectPath {
                    path: display_path(&entry.path()),
                    source,
                })?;

            if file_type.is_dir() {
                child_directories.push((file_name, entry.path()));
            }
        }

        child_directories.sort_by(|left, right| left.0.cmp(&right.0));

        child_directories
            .into_iter()
            .map(|(label, path)| self.scan_spec_directory(&path, parent_id, &label, config))
            .collect()
    }

    fn scan_spec_directory(
        &self,
        directory: &Path,
        parent_id: &str,
        label: &str,
        config: &WorkspaceConfig,
    ) -> Result<SpecNode, SpecTreeScanError> {
        let id = SpecNode::child_id(parent_id, label);
        let effective_config = self.config_for_spec_directory(directory, config)?;
        let files = self.scan_spec_files(directory, &effective_config)?;
        let children = self.scan_child_directories(directory, &id, config)?;

        SpecNode::new(id.clone(), label, files, children).map_err(|source| {
            SpecTreeScanError::InvalidNode {
                id,
                path: display_path(directory),
                source,
            }
        })
    }

    fn scan_spec_files(
        &self,
        directory: &Path,
        config: &WorkspaceConfig,
    ) -> Result<Vec<SpecFile>, SpecTreeScanError> {
        config
            .files()
            .iter()
            .map(|mapping| {
                let file_path = directory.join(mapping.file_name());
                let resolved_file = self.resolve_spec_file_for_scan(mapping.key(), &file_path)?;

                SpecFile::with_resolved_format(
                    mapping.key(),
                    mapping.file_name(),
                    resolved_file.status,
                    mapping.source(),
                    resolved_file.format,
                )
                .map_err(|source| SpecTreeScanError::InvalidFile {
                    path: display_path(&file_path),
                    source,
                })
            })
            .collect()
    }

    fn resolve_spec_file_for_scan(
        &self,
        key: SpecFileKey,
        configured_path: &Path,
    ) -> Result<ScannedSpecFile, SpecTreeScanError> {
        let candidates = spec_file_path_candidates(key, configured_path);
        let preferred_format = candidates
            .first()
            .map(SpecFilePathCandidate::format)
            .unwrap_or_else(|| SpecDocumentFormat::from_file_name(&display_path(configured_path)));

        for candidate in &candidates {
            if self.spec_file_status(candidate.path())? == SpecFileStatus::Present {
                return Ok(ScannedSpecFile {
                    status: SpecFileStatus::Present,
                    format: candidate.format(),
                });
            }
        }

        Ok(ScannedSpecFile {
            status: SpecFileStatus::Missing,
            format: preferred_format,
        })
    }

    fn config_for_spec_directory(
        &self,
        directory: &Path,
        config: &WorkspaceConfig,
    ) -> Result<WorkspaceConfig, SpecTreeScanError> {
        let Some(spec_override) = WorkspaceConfigLoader::new()
            .load_spec_override_from_directory(directory)
            .map_err(|source| SpecTreeScanError::ConfigOverrideLoad {
                path: display_path(directory),
                source,
            })?
        else {
            return Ok(config.clone());
        };

        Ok(config.merge_spec_override(&spec_override))
    }

    fn spec_file_status(&self, path: &Path) -> Result<SpecFileStatus, SpecTreeScanError> {
        match fs::metadata(path) {
            Ok(metadata) if metadata.is_file() => Ok(SpecFileStatus::Present),
            Ok(_) => Ok(SpecFileStatus::Missing),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(SpecFileStatus::Missing),
            Err(source) => Err(SpecTreeScanError::InspectPath {
                path: display_path(path),
                source,
            }),
        }
    }

    fn is_scan_excluded_name(file_name: &str, config: &WorkspaceConfig) -> bool {
        config
            .scan_excluded_directory_names()
            .iter()
            .any(|excluded_name| excluded_name == file_name)
    }

    fn is_hidden_name(name: &str) -> bool {
        name.starts_with('.')
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SpecScanRoot {
    path: PathBuf,
    id_prefix: String,
    label: Option<String>,
}

impl SpecScanRoot {
    fn primary(path: PathBuf) -> Self {
        Self {
            path,
            id_prefix: String::new(),
            label: None,
        }
    }

    fn source_group(path: PathBuf, id_prefix: String, label: String) -> Self {
        Self {
            path,
            id_prefix,
            label: Some(label),
        }
    }

    fn worktree(path: PathBuf, id_prefix: String, label: String) -> Self {
        Self::source_group(path, id_prefix, label)
    }

    fn parent_id(&self) -> &str {
        &self.id_prefix
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct ScannedSpecFile {
    status: SpecFileStatus,
    format: SpecDocumentFormat,
}

#[derive(Debug, Error)]
pub enum SpecTreeScanError {
    #[error("failed to read spec directory: {path}")]
    ReadDirectory { path: String, source: io::Error },
    #[error("failed to inspect spec path: {path}")]
    InspectPath { path: String, source: io::Error },
    #[error("scanned spec node is invalid at {path}: {id}")]
    InvalidNode {
        id: String,
        path: String,
        source: SpecDomainError,
    },
    #[error("scanned spec file is invalid: {path}")]
    InvalidFile {
        path: String,
        source: SpecDomainError,
    },
    #[error("failed to load spec config override for {path}")]
    ConfigOverrideLoad {
        path: String,
        source: ConfigLoadError,
    },
}

#[cfg(test)]
mod tests {
    use super::super::conventions::{PLUGIN_WORKSPACE_SPECS_DIR, SPEC_SKILL_FEATURES_DIR};
    use super::super::test_support::TestWorkspace;
    use super::*;
    use crate::domain::workspace::WorkspaceFileMapping;

    #[test]
    fn spec_tree_scanner_returns_ordered_plugin_workspace_tree_with_file_statuses() {
        let workspace = TestWorkspace::new("plugin-tree");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.create_dir(".plugin-workspace/.specs/zeta");
        workspace.create_dir(".plugin-workspace/.specs/auth/code-review");
        workspace.write_file(".plugin-workspace/.specs/auth/tasks.md", "");
        workspace.write_file(
            ".plugin-workspace/.specs/auth/code-review/implementation-plan.md",
            "",
        );
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("spec tree should be scanned");

        assert_eq!(vec![PLUGIN_WORKSPACE_SPECS_DIR], node_ids(&tree));
        let root = &tree[0];
        assert_eq!("ルート", root.label());
        assert_eq!(
            vec![
                ".plugin-workspace/.specs/auth",
                ".plugin-workspace/.specs/zeta"
            ],
            node_ids(root.children())
        );

        let auth = &root.children()[0];
        assert_eq!("auth", auth.label());
        assert_eq!(
            vec![".plugin-workspace/.specs/auth/code-review"],
            node_ids(auth.children())
        );
        assert_eq!(
            Some(SpecFileStatus::Missing),
            auth.file_for_key(SpecFileKey::Exploration)
                .map(|file| file.status())
        );
        assert_eq!(
            Some(SpecFileStatus::Present),
            auth.file_for_key(SpecFileKey::Tasks)
                .map(|file| file.status())
        );

        let code_review = &auth.children()[0];
        assert_eq!(
            Some(SpecFileStatus::Present),
            code_review
                .file_for_key(SpecFileKey::Impl)
                .map(|file| file.status())
        );
    }

    #[test]
    fn spec_tree_scanner_reports_tech_reference_html_when_both_candidates_exist() {
        let workspace = TestWorkspace::new("tech-reference-html-first");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.write_file(
            ".plugin-workspace/.specs/auth/tech-reference.html",
            "<h1>Tech</h1>",
        );
        workspace.write_file(".plugin-workspace/.specs/auth/tech-reference.md", "# Tech");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("spec tree should be scanned");

        let auth = &tree[0].children()[0];
        let tech_reference = auth
            .file_for_key(SpecFileKey::TechReference)
            .expect("tech reference file should be configured");
        assert_eq!(SpecFileStatus::Present, tech_reference.status());
        assert_eq!(SpecDocumentFormat::Html, tech_reference.format());
        assert_eq!("tech-reference.html", tech_reference.file_name());
    }

    #[test]
    fn spec_tree_scanner_reports_missing_tech_reference_as_html() {
        let workspace = TestWorkspace::new("tech-reference-missing");
        workspace.create_dir(".plugin-workspace/.specs/auth");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("spec tree should be scanned");

        let auth = &tree[0].children()[0];
        let tech_reference = auth
            .file_for_key(SpecFileKey::TechReference)
            .expect("tech reference file should be configured");
        assert_eq!(SpecFileStatus::Missing, tech_reference.status());
        assert_eq!(SpecDocumentFormat::Html, tech_reference.format());
    }

    #[test]
    fn spec_tree_scanner_ignores_hidden_directories() {
        let workspace = TestWorkspace::new("hidden");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.create_dir(".plugin-workspace/.specs/.internal");
        workspace.create_dir(".plugin-workspace/.specs/visible");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("spec tree should be scanned");

        assert_eq!(vec![PLUGIN_WORKSPACE_SPECS_DIR], node_ids(&tree));
        assert_eq!(
            vec![".plugin-workspace/.specs/visible"],
            node_ids(tree[0].children())
        );
    }

    #[test]
    fn spec_tree_scanner_excludes_review_directories_by_default() {
        let workspace = TestWorkspace::new("scan-exclusions");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.create_dir(".plugin-workspace/.specs/auth/plan-review");
        workspace.create_dir(".plugin-workspace/.specs/auth/user-review");
        workspace.create_dir(".plugin-workspace/.specs/auth/child");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("spec tree should be scanned");

        let auth = &tree[0].children()[0];
        assert_eq!(
            vec![".plugin-workspace/.specs/auth/child"],
            node_ids(auth.children())
        );
    }

    #[test]
    fn spec_tree_scanner_allows_config_to_restore_review_directories() {
        let workspace = TestWorkspace::new("scan-exclusions-disabled");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.create_dir(".plugin-workspace/.specs/auth/plan-review");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::with_scan_excluded_directory_names(
            WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace)
                .files()
                .to_vec(),
            Vec::new(),
        )
        .expect("empty scan exclusion config should be valid");

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("spec tree should be scanned");

        let auth = &tree[0].children()[0];
        assert_eq!(
            vec![".plugin-workspace/.specs/auth/plan-review"],
            node_ids(auth.children())
        );
    }

    #[test]
    fn spec_tree_scanner_marks_html_fallback_as_present() {
        let workspace = TestWorkspace::new("html-fallback-tree");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.write_file(".plugin-workspace/.specs/auth/tasks.html", "");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("spec tree should be scanned");

        let tasks = tree[0].children()[0]
            .file_for_key(SpecFileKey::Tasks)
            .expect("tasks mapping should exist");

        assert_eq!("tasks.md", tasks.file_name());
        assert_eq!(SpecFileStatus::Present, tasks.status());
        assert_eq!(SpecDocumentFormat::Html, tasks.format());
    }

    #[test]
    fn spec_tree_scanner_scans_spec_skill_features_with_compatibility_files() {
        let workspace = TestWorkspace::new("spec-skill-tree");
        workspace.create_dir(SPEC_SKILL_FEATURES_DIR);
        workspace.create_dir(".spec-skill/features/checkout");
        workspace.write_file(".spec-skill/features/checkout/requirements.md", "");
        let layout = workspace.layout(WorkspaceKind::SpecSkill);
        let config = WorkspaceConfig::default_for(WorkspaceKind::SpecSkill);

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("spec tree should be scanned");

        assert_eq!(vec!["checkout"], node_ids(&tree));
        assert_eq!(
            vec![
                (SpecFileKey::Requirements, SpecFileStatus::Present),
                (SpecFileKey::Design, SpecFileStatus::Missing),
                (SpecFileKey::Tasks, SpecFileStatus::Missing),
            ],
            file_statuses(&tree[0])
        );
    }

    #[test]
    fn spec_tree_scanner_loads_spec_driven_dev_plugin_workspace_files_without_config() {
        let workspace = TestWorkspace::new("spec-driven-dev-files");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.create_dir(".plugin-workspace/.specs/021-issue-262/plan-review");
        workspace.create_dir(".plugin-workspace/.specs/021-issue-262/code-review");
        workspace.write_file(
            ".plugin-workspace/.specs/021-issue-262/hearing-notes.md",
            "",
        );
        workspace.write_file(
            ".plugin-workspace/.specs/021-issue-262/exploration-report.md",
            "",
        );
        workspace.write_file(
            ".plugin-workspace/.specs/021-issue-262/implementation-plan.md",
            "",
        );
        workspace.write_file(".plugin-workspace/.specs/021-issue-262/tasks.md", "");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("spec-driven-dev tree should be scanned");

        let root = &tree[0];
        assert_eq!(PLUGIN_WORKSPACE_SPECS_DIR, root.id());
        assert_eq!("ルート", root.label());
        let issue = &root.children()[0];
        assert_eq!(".plugin-workspace/.specs/021-issue-262", issue.id());
        assert_eq!(
            vec![".plugin-workspace/.specs/021-issue-262/code-review"],
            node_ids(issue.children())
        );
        assert_eq!(
            vec![
                (SpecFileKey::Impl, SpecFileStatus::Present),
                (SpecFileKey::Tasks, SpecFileStatus::Present),
                (SpecFileKey::TechReference, SpecFileStatus::Missing),
                (SpecFileKey::Exploration, SpecFileStatus::Present),
                (SpecFileKey::Hearing, SpecFileStatus::Present),
            ],
            file_statuses(issue)
        );
    }

    #[test]
    fn spec_tree_scanner_includes_claude_plugin_worktree_specs_with_source_label() {
        let workspace = TestWorkspace::new("claude-worktree-tree");
        workspace.create_dir(".claude/worktrees/feature-auth/.plugin-worktree/.specs/auth");
        workspace.write_file(
            ".claude/worktrees/feature-auth/.plugin-worktree/.specs/auth/hearing-notes.md",
            "",
        );
        workspace.write_file(
            ".claude/worktrees/feature-auth/.plugin-worktree/.specs/auth/exploration-report.md",
            "",
        );
        workspace.write_file(
            ".claude/worktrees/feature-auth/.plugin-worktree/.specs/auth/implementation-plan.md",
            "",
        );
        workspace.write_file(
            ".claude/worktrees/feature-auth/.plugin-worktree/.specs/auth/tasks.md",
            "",
        );
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("worktree specs should be scanned");

        let worktree = &tree[0];
        assert_eq!(
            ".claude/worktrees/feature-auth/.plugin-worktree/.specs",
            worktree.id()
        );
        assert_eq!("feature-auth (.plugin-worktree)", worktree.label());
        assert_eq!(
            vec![".claude/worktrees/feature-auth/.plugin-worktree/.specs/auth"],
            node_ids(worktree.children())
        );
        assert_eq!(
            vec![
                (SpecFileKey::Impl, SpecFileStatus::Present),
                (SpecFileKey::Tasks, SpecFileStatus::Present),
                (SpecFileKey::TechReference, SpecFileStatus::Missing),
                (SpecFileKey::Exploration, SpecFileStatus::Present),
                (SpecFileKey::Hearing, SpecFileStatus::Present),
            ],
            file_statuses(&worktree.children()[0])
        );
    }

    #[test]
    fn spec_tree_scanner_includes_claude_plugin_workspace_specs_with_source_label() {
        let workspace = TestWorkspace::new("claude-plugin-workspace-tree");
        workspace
            .create_dir(".claude/worktrees/doccom-be/.plugin-workspace/.specs/019-be-doc-comments");
        workspace.write_file(
            ".claude/worktrees/doccom-be/.plugin-workspace/.specs/019-be-doc-comments/hearing-notes.md",
            "",
        );
        workspace.write_file(
            ".claude/worktrees/doccom-be/.plugin-workspace/.specs/019-be-doc-comments/exploration-report.md",
            "",
        );
        workspace.write_file(
            ".claude/worktrees/doccom-be/.plugin-workspace/.specs/019-be-doc-comments/implementation-plan.md",
            "",
        );
        workspace.write_file(
            ".claude/worktrees/doccom-be/.plugin-workspace/.specs/019-be-doc-comments/tasks.md",
            "",
        );
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("plugin workspace specs should be scanned");

        let worktree = &tree[0];
        assert_eq!(
            ".claude/worktrees/doccom-be/.plugin-workspace/.specs",
            worktree.id()
        );
        assert_eq!("doccom-be (.plugin-workspace)", worktree.label());
        assert_eq!(
            vec![".claude/worktrees/doccom-be/.plugin-workspace/.specs/019-be-doc-comments"],
            node_ids(worktree.children())
        );
        assert_eq!(
            vec![
                (SpecFileKey::Impl, SpecFileStatus::Present),
                (SpecFileKey::Tasks, SpecFileStatus::Present),
                (SpecFileKey::TechReference, SpecFileStatus::Missing),
                (SpecFileKey::Exploration, SpecFileStatus::Present),
                (SpecFileKey::Hearing, SpecFileStatus::Present),
            ],
            file_statuses(&worktree.children()[0])
        );
    }

    #[test]
    fn spec_tree_scanner_uses_configured_file_mappings() {
        let workspace = TestWorkspace::new("configured-files");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.create_dir(".plugin-workspace/.specs/auth");
        workspace.write_file(".plugin-workspace/.specs/auth/interview.md", "");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::new(vec![WorkspaceFileMapping::new(
            SpecFileKey::Hearing,
            "interview.md",
        )
        .expect("mapping should be valid")])
        .expect("config should be valid");

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("spec tree should be scanned");

        let root = &tree[0];
        let auth = &root.children()[0];
        assert_eq!(
            vec![(SpecFileKey::Hearing, SpecFileStatus::Present)],
            file_statuses(auth)
        );
    }

    #[test]
    fn spec_tree_scanner_applies_spec_config_override_to_that_spec_only() {
        let workspace = TestWorkspace::new("spec-override");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.create_dir(".plugin-workspace/.specs/auth");
        workspace.create_dir(".plugin-workspace/.specs/checkout");
        workspace.write_file(
            ".plugin-workspace/.specs/auth/.spec-reviewer/config.json",
            r#"{
                "files": {
                    "tasks": "auth-tasks.md"
                }
            }"#,
        );
        workspace.write_file(".plugin-workspace/.specs/auth/auth-tasks.md", "");
        workspace.write_file(".plugin-workspace/.specs/checkout/tasks.md", "");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("spec tree should be scanned");

        let root = &tree[0];
        let auth = &root.children()[0];
        let checkout = &root.children()[1];

        assert_eq!(".plugin-workspace/.specs/auth", auth.id());
        assert_eq!(
            Some(("auth-tasks.md", SpecFileStatus::Present)),
            auth.file_for_key(SpecFileKey::Tasks)
                .map(|file| (file.file_name(), file.status()))
        );
        assert_eq!(
            Some(("tasks.md", SpecFileStatus::Present)),
            checkout
                .file_for_key(SpecFileKey::Tasks)
                .map(|file| (file.file_name(), file.status()))
        );
    }

    #[test]
    fn spec_tree_scanner_returns_error_for_invalid_spec_config_override() {
        let workspace = TestWorkspace::new("invalid-spec-override");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.create_dir(".plugin-workspace/.specs/auth");
        workspace.write_file(
            ".plugin-workspace/.specs/auth/.spec-reviewer/config.json",
            r#"{
                "files": {
                    "tasks": "../tasks.md"
                }
            }"#,
        );
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let result = FilesystemSpecTreeScanner::new().scan(&layout, &config);

        assert!(matches!(
            result,
            Err(SpecTreeScanError::ConfigOverrideLoad { path, .. }) if path.ends_with("auth")
        ));
    }

    fn node_ids(nodes: &[SpecNode]) -> Vec<&str> {
        nodes.iter().map(SpecNode::id).collect()
    }

    fn file_statuses(node: &SpecNode) -> Vec<(SpecFileKey, SpecFileStatus)> {
        node.files()
            .iter()
            .map(|file| (file.key(), file.status()))
            .collect()
    }
}
