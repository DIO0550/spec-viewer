//! Filesystem adapters.

use std::{
    fs, io,
    path::{Component, Path, PathBuf},
};

use thiserror::Error;

use crate::domain::{
    spec::{SpecDomainError, SpecFile, SpecFileStatus, SpecNode},
    workspace::{
        WorkspaceConfig, WorkspaceDomainError, WorkspaceKind, WorkspaceLayout, WorkspaceRoot,
    },
};
use crate::infrastructure::persistence::config::{ConfigLoadError, WorkspaceConfigLoader};

const PLUGIN_WORKSPACE_SPECS_DIR: &str = ".plugin-workspace/.specs";
const PLUGIN_WORKSPACE_DIRECTORY: &str = ".plugin-workspace";
const PLUGIN_WORKTREE_DIRECTORY: &str = ".plugin-worktree";
const PLUGIN_WORKTREE_SPECS_DIR: &str = ".specs";
const CLAUDE_WORKTREES_DIR: &str = ".claude/worktrees";
const SPEC_SKILL_FEATURES_DIR: &str = ".spec-skill/features";
const CLAUDE_WORKTREE_SPEC_CONTAINERS: [&str; 2] =
    [PLUGIN_WORKTREE_DIRECTORY, PLUGIN_WORKSPACE_DIRECTORY];

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
                return create_workspace_layout(directory, WorkspaceKind::PluginWorkspace);
            }

            if is_plugin_worktree_directory(directory)
                && self
                    .path_checker
                    .directory_exists(directory.join(PLUGIN_WORKTREE_SPECS_DIR))?
            {
                return create_workspace_layout(directory, WorkspaceKind::PluginWorktree);
            }

            if let Some(workspace_root) = self.detect_claude_worktree_collection_root(directory)? {
                return create_workspace_layout(&workspace_root, WorkspaceKind::PluginWorkspace);
            }

            if self
                .path_checker
                .directory_exists(directory.join(SPEC_SKILL_FEATURES_DIR))?
            {
                return create_workspace_layout(directory, WorkspaceKind::SpecSkill);
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
        for workspace_root in possible_claude_worktree_collection_roots(directory) {
            if self
                .path_checker
                .directory_exists(workspace_root.join(CLAUDE_WORKTREES_DIR))?
                && has_claude_worktree_specs(&workspace_root)?
            {
                return Ok(Some(workspace_root));
            }
        }

        Ok(None)
    }
}

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

        for root in spec_scan_roots(layout)? {
            let id = root.parent_id().to_string();
            let children = scan_child_directories(&root.path, &id, config)?;

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

    fn worktree(path: PathBuf, id_prefix: String, label: String) -> Self {
        Self {
            path,
            id_prefix,
            label: Some(label),
        }
    }

    fn parent_id(&self) -> &str {
        &self.id_prefix
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

pub fn spec_root_path(layout: &WorkspaceLayout) -> PathBuf {
    PathBuf::from(layout.root().as_str()).join(spec_root_directory_for_kind(layout.kind()))
}

pub fn safe_relative_spec_path(spec_id: &str) -> Result<PathBuf, SafeSpecPathError> {
    let trimmed = spec_id.trim();

    if trimmed.is_empty() || trimmed.contains('\\') || trimmed.contains('\0') {
        return Err(SafeSpecPathError::InvalidSpecId {
            spec_id: spec_id.to_string(),
        });
    }

    let mut path = PathBuf::new();
    let mut component_count = 0;

    for component in Path::new(trimmed).components() {
        let Component::Normal(name) = component else {
            return Err(SafeSpecPathError::InvalidSpecId {
                spec_id: spec_id.to_string(),
            });
        };

        path.push(name);
        component_count += 1;
    }

    if component_count == 0 {
        return Err(SafeSpecPathError::InvalidSpecId {
            spec_id: spec_id.to_string(),
        });
    }

    Ok(path)
}

pub fn spec_directory_path(
    layout: &WorkspaceLayout,
    spec_id: &str,
) -> Result<PathBuf, SafeSpecPathError> {
    let relative_spec_path = safe_relative_spec_path(spec_id)?;

    if is_claude_plugin_worktree_spec_path(&relative_spec_path) {
        return Ok(PathBuf::from(layout.root().as_str()).join(relative_spec_path));
    }

    Ok(spec_root_path(layout).join(relative_spec_path))
}

fn spec_root_directory_for_kind(kind: WorkspaceKind) -> &'static str {
    match kind {
        WorkspaceKind::PluginWorkspace => PLUGIN_WORKSPACE_SPECS_DIR,
        WorkspaceKind::PluginWorktree => PLUGIN_WORKTREE_SPECS_DIR,
        WorkspaceKind::SpecSkill => SPEC_SKILL_FEATURES_DIR,
    }
}

fn spec_scan_roots(layout: &WorkspaceLayout) -> Result<Vec<SpecScanRoot>, SpecTreeScanError> {
    let mut roots = Vec::new();
    let primary_root = spec_root_path(layout);

    if directory_exists_for_scan(&primary_root)? {
        roots.push(SpecScanRoot::primary(primary_root));
    }

    if layout.kind() == WorkspaceKind::PluginWorkspace {
        roots.extend(collect_claude_worktree_scan_roots(Path::new(
            layout.root().as_str(),
        ))?);
    }

    Ok(roots)
}

fn collect_claude_worktree_scan_roots(
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

            if !directory_exists_for_scan(&specs_path)? {
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

fn directory_exists_for_scan(path: &Path) -> Result<bool, SpecTreeScanError> {
    match fs::metadata(path) {
        Ok(metadata) => Ok(metadata.is_dir()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(source) => Err(SpecTreeScanError::InspectPath {
            path: display_path(path),
            source,
        }),
    }
}

fn is_plugin_worktree_directory(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name == PLUGIN_WORKTREE_DIRECTORY)
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

fn has_claude_worktree_specs(workspace_root: &Path) -> Result<bool, WorkspaceDetectionError> {
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

fn is_claude_plugin_worktree_spec_path(relative_spec_path: &Path) -> bool {
    let components: Vec<String> = relative_spec_path
        .components()
        .map(|component| component.as_os_str().to_string_lossy().into_owned())
        .collect();

    matches!(
        components.as_slice(),
        [
            claude,
            worktrees,
            worktree_name,
            plugin_container,
            specs,
            ..
        ] if claude == ".claude"
            && worktrees == "worktrees"
            && !worktree_name.is_empty()
            && CLAUDE_WORKTREE_SPEC_CONTAINERS.contains(&plugin_container.as_str())
            && specs == PLUGIN_WORKTREE_SPECS_DIR
            && components.len() > 5
    )
}

fn scan_child_directories(
    directory: &Path,
    parent_id: &str,
    config: &WorkspaceConfig,
) -> Result<Vec<SpecNode>, SpecTreeScanError> {
    let entries = fs::read_dir(directory).map_err(|source| SpecTreeScanError::ReadDirectory {
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

        if is_hidden_name(&file_name) {
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
        .map(|(label, path)| scan_spec_directory(&path, parent_id, &label, config))
        .collect()
}

fn scan_spec_directory(
    directory: &Path,
    parent_id: &str,
    label: &str,
    config: &WorkspaceConfig,
) -> Result<SpecNode, SpecTreeScanError> {
    let id = spec_node_id(parent_id, label);
    let effective_config = config_for_spec_directory(directory, config)?;
    let files = scan_spec_files(directory, &effective_config)?;
    let children = scan_child_directories(directory, &id, config)?;

    SpecNode::new(id.clone(), label, files, children).map_err(|source| {
        SpecTreeScanError::InvalidNode {
            id,
            path: display_path(directory),
            source,
        }
    })
}

fn scan_spec_files(
    directory: &Path,
    config: &WorkspaceConfig,
) -> Result<Vec<SpecFile>, SpecTreeScanError> {
    config
        .files()
        .iter()
        .map(|mapping| {
            let file_path = directory.join(mapping.file_name());
            let status = spec_file_status(&file_path)?;

            SpecFile::with_config_source(
                mapping.key(),
                mapping.file_name(),
                status,
                mapping.source(),
            )
            .map_err(|source| SpecTreeScanError::InvalidFile {
                path: display_path(&file_path),
                source,
            })
        })
        .collect()
}

fn config_for_spec_directory(
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

fn spec_file_status(path: &Path) -> Result<SpecFileStatus, SpecTreeScanError> {
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

fn spec_node_id(parent_id: &str, label: &str) -> String {
    if parent_id.is_empty() {
        return label.to_string();
    }

    format!("{parent_id}/{label}")
}

fn is_hidden_name(name: &str) -> bool {
    name.starts_with('.')
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

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum SafeSpecPathError {
    #[error("spec id is invalid: {spec_id}")]
    InvalidSpecId { spec_id: String },
}

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;
    use crate::domain::{
        spec::{SpecFileKey, SpecFileStatus},
        workspace::{WorkspaceFileMapping, WorkspaceRoot},
    };

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

        fn write_file(&self, path: &str, contents: &str) {
            let path = self.root.join(path);
            let parent = path.parent().expect("test file should have parent");
            fs::create_dir_all(parent).expect("test file parent should be created");
            fs::write(path, contents).expect("test file should be written");
        }

        fn layout(&self, kind: WorkspaceKind) -> WorkspaceLayout {
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

        assert_eq!(vec!["auth", "zeta"], node_ids(&tree));
        let auth = &tree[0];
        assert_eq!("auth", auth.label());
        assert_eq!(vec!["auth/code-review"], node_ids(auth.children()));
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

        assert_eq!(vec!["visible"], node_ids(&tree));
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

        let issue = &tree[0];
        assert_eq!("021-issue-262", issue.id());
        assert_eq!(
            vec!["021-issue-262/code-review", "021-issue-262/plan-review"],
            node_ids(issue.children())
        );
        assert_eq!(
            vec![
                (SpecFileKey::Impl, SpecFileStatus::Present),
                (SpecFileKey::Tasks, SpecFileStatus::Present),
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
                (SpecFileKey::Exploration, SpecFileStatus::Present),
                (SpecFileKey::Hearing, SpecFileStatus::Present),
            ],
            file_statuses(&worktree.children()[0])
        );
    }

    #[test]
    fn spec_directory_path_resolves_claude_plugin_worktree_spec_ids() {
        let workspace = TestWorkspace::new("claude-worktree-spec-path");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let path = spec_directory_path(
            &layout,
            ".claude/worktrees/feature-auth/.plugin-worktree/.specs/auth",
        )
        .expect("worktree spec id should resolve");

        assert_eq!(
            workspace
                .root()
                .join(".claude/worktrees/feature-auth/.plugin-worktree/.specs/auth"),
            path
        );
    }

    #[test]
    fn spec_directory_path_resolves_claude_plugin_workspace_spec_ids() {
        let workspace = TestWorkspace::new("claude-plugin-workspace-spec-path");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let path = spec_directory_path(
            &layout,
            ".claude/worktrees/doccom-be/.plugin-workspace/.specs/019-be-doc-comments",
        )
        .expect("plugin workspace spec id should resolve");

        assert_eq!(
            workspace
                .root()
                .join(".claude/worktrees/doccom-be/.plugin-workspace/.specs/019-be-doc-comments"),
            path
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

        assert_eq!(
            vec![(SpecFileKey::Hearing, SpecFileStatus::Present)],
            file_statuses(&tree[0])
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

        let auth = &tree[0];
        let checkout = &tree[1];

        assert_eq!("auth", auth.id());
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
