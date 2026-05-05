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
        let root = spec_root_path(layout);

        scan_child_directories(&root, "", config)
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

fn spec_root_directory_for_kind(kind: WorkspaceKind) -> &'static str {
    match kind {
        WorkspaceKind::PluginWorkspace => PLUGIN_WORKSPACE_SPECS_DIR,
        WorkspaceKind::SpecSkill => SPEC_SKILL_FEATURES_DIR,
    }
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
    let files = scan_spec_files(directory, config)?;
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

            SpecFile::new(mapping.key(), mapping.file_name(), status).map_err(|source| {
                SpecTreeScanError::InvalidFile {
                    path: display_path(&file_path),
                    source,
                }
            })
        })
        .collect()
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
        workspace.write_file(".plugin-workspace/.specs/auth/code-review/impl.md", "");
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
