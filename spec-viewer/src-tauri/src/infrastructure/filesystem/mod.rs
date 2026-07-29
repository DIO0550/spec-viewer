//! Filesystem adapters.

use std::{
    collections::HashMap,
    fs, io,
    path::{Component, Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
};

use thiserror::Error;

use crate::domain::{
    spec::{
        SpecDocumentFormat, SpecDomainError, SpecFile, SpecFileKey, SpecFileStatus, SpecNode,
        SpecNodeIdentity, SpecNodeKind,
    },
    workspace::{
        WorkspaceConfig, WorkspaceDomainError, WorkspaceKind, WorkspaceLayout, WorkspaceRoot,
    },
};
use crate::infrastructure::persistence::config::{ConfigLoadError, WorkspaceConfigLoader};
use crate::infrastructure::spec_file_resolution::{
    spec_file_path_candidates, SpecFilePathCandidate,
};

const PLUGIN_WORKSPACE_SPECS_DIR: &str = ".plugin-workspace/.specs";
const PLUGIN_WORKSPACE_DIRECTORY: &str = ".plugin-workspace";
const PLUGIN_WORKTREE_DIRECTORY: &str = ".plugin-worktree";
const PLUGIN_WORKTREE_SPECS_DIR: &str = ".specs";
const CLAUDE_WORKTREES_DIR: &str = ".claude/worktrees";
const SPEC_ARCHIVE_DIRECTORY: &str = ".archive";
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
            let children = scan_source_group(&root, config)?;

            if root.is_primary {
                nodes.extend(children);
                continue;
            }

            let source_group_id = root.source_group_id().to_string();
            let identity = SpecNodeIdentity::new(&source_group_id, ".").map_err(|source| {
                SpecTreeScanError::InvalidNode {
                    id: source_group_id.clone(),
                    path: display_path(&root.path),
                    source,
                }
            })?;
            let label = root.label.as_deref().unwrap_or(&source_group_id);
            let node = SpecNode::source_group(identity, label, children).map_err(|source| {
                SpecTreeScanError::InvalidNode {
                    id: source_group_id.clone(),
                    path: display_path(&root.path),
                    source,
                }
            })?;
            nodes.push(node);
        }

        Ok(nodes)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SpecScanRoot {
    path: PathBuf,
    id_prefix: String,
    label: Option<String>,
    is_primary: bool,
}

impl SpecScanRoot {
    fn primary(path: PathBuf, id_prefix: String) -> Self {
        Self {
            path,
            id_prefix,
            label: None,
            is_primary: true,
        }
    }

    fn source_group(path: PathBuf, id_prefix: String, label: String) -> Self {
        Self {
            path,
            id_prefix,
            label: Some(label),
            is_primary: false,
        }
    }

    fn worktree(path: PathBuf, id_prefix: String, label: String) -> Self {
        Self::source_group(path, id_prefix, label)
    }

    fn source_group_id(&self) -> &str {
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

    if let Ok(path_under_source_group) =
        relative_spec_path.strip_prefix(spec_root_directory_for_kind(layout.kind()))
    {
        return Ok(spec_root_path(layout).join(path_under_source_group));
    }

    if is_claude_plugin_worktree_spec_path(&relative_spec_path) {
        return Ok(PathBuf::from(layout.root().as_str()).join(relative_spec_path));
    }

    Ok(spec_root_path(layout).join(relative_spec_path))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchivedSpecDestination {
    path: PathBuf,
    source_group_id: String,
    destination_node_id: String,
}

impl ArchivedSpecDestination {
    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn source_group_id(&self) -> &str {
        &self.source_group_id
    }

    pub fn destination_node_id(&self) -> &str {
        &self.destination_node_id
    }
}

static ARCHIVE_SOURCE_GROUP_LOCKS: OnceLock<Mutex<HashMap<String, Arc<Mutex<()>>>>> =
    OnceLock::new();
const ARCHIVE_RENAME_RETRY_LIMIT: usize = 8;

pub fn archive_spec_directory(
    layout: &WorkspaceLayout,
    config: &WorkspaceConfig,
    spec_id: &str,
) -> Result<ArchivedSpecDestination, SpecArchiveError> {
    let relative_spec_path = safe_relative_spec_path(spec_id).map_err(SpecArchiveError::from)?;

    if relative_spec_path
        .components()
        .any(|component| component.as_os_str() == SPEC_ARCHIVE_DIRECTORY)
    {
        return Err(SpecArchiveError::AlreadyArchived {
            spec_id: spec_id.to_string(),
        });
    }

    let archive_paths = archive_spec_paths(layout, &relative_spec_path)?;

    if archive_paths.relative_spec_path.as_os_str().is_empty() {
        return Err(SpecArchiveError::SourceGroupRoot {
            spec_id: spec_id.to_string(),
        });
    }

    if !directory_exists_for_archive(&archive_paths.source_root)? {
        return Err(SpecArchiveError::StaleSourceGroup {
            source_group_id: archive_paths.source_group_id.clone(),
        });
    }

    let relative_id = display_path(&archive_paths.relative_spec_path);
    let tree = FilesystemSpecTreeScanner::new()
        .scan(layout, config)
        .map_err(|source| SpecArchiveError::ScanProjection { source })?;
    let node = find_node_by_identity(&tree, &archive_paths.source_group_id, &relative_id)
        .ok_or_else(|| SpecArchiveError::StaleSpecNode {
            source_group_id: archive_paths.source_group_id.clone(),
            relative_id: relative_id.clone(),
        })?;

    if node.kind() != SpecNodeKind::Spec {
        return Err(SpecArchiveError::NotArchivableNode {
            spec_id: spec_id.to_string(),
            kind: node.kind(),
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

    let lock = archive_source_group_lock(layout, &archive_paths.source_group_id)?;
    let _guard = lock.lock().map_err(|_| SpecArchiveError::ArchiveLock {
        source_group_id: archive_paths.source_group_id.clone(),
    })?;
    let archive_root = archive_paths.source_root.join(SPEC_ARCHIVE_DIRECTORY);
    fs::create_dir_all(&archive_root).map_err(|source| {
        SpecArchiveError::CreateArchiveDirectory {
            path: display_path(&archive_root),
            source,
        }
    })?;

    for _attempt in 0..=ARCHIVE_RENAME_RETRY_LIMIT {
        let destination_path =
            unique_archive_destination(&archive_root, &archive_paths.relative_spec_path);
        let parent = destination_path.parent().ok_or_else(|| {
            SpecArchiveError::InvalidArchiveDestination {
                path: display_path(&destination_path),
            }
        })?;
        fs::create_dir_all(parent).map_err(|source| SpecArchiveError::CreateArchiveDirectory {
            path: display_path(parent),
            source,
        })?;

        match fs::rename(&archive_paths.source_path, &destination_path) {
            Ok(()) => {
                let destination_node_id = destination_path
                    .strip_prefix(&archive_paths.source_root)
                    .map(display_path)
                    .map_err(|_| SpecArchiveError::InvalidArchiveDestination {
                        path: display_path(&destination_path),
                    })?;

                return Ok(ArchivedSpecDestination {
                    path: destination_path,
                    source_group_id: archive_paths.source_group_id,
                    destination_node_id,
                });
            }
            Err(source) if source.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(source) => {
                return Err(SpecArchiveError::MoveSpecDirectory {
                    source_path: display_path(&archive_paths.source_path),
                    archive_path: display_path(&destination_path),
                    source,
                });
            }
        }
    }

    Err(SpecArchiveError::DestinationConflict {
        source_group_id: archive_paths.source_group_id,
        relative_id,
    })
}

fn archive_source_group_lock(
    layout: &WorkspaceLayout,
    source_group_id: &str,
) -> Result<Arc<Mutex<()>>, SpecArchiveError> {
    let key = format!("{}::{source_group_id}", layout.root().as_str());
    let locks = ARCHIVE_SOURCE_GROUP_LOCKS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut locks = locks.lock().map_err(|_| SpecArchiveError::ArchiveLock {
        source_group_id: source_group_id.to_string(),
    })?;

    Ok(locks
        .entry(key)
        .or_insert_with(|| Arc::new(Mutex::new(())))
        .clone())
}

fn directory_exists_for_archive(path: &Path) -> Result<bool, SpecArchiveError> {
    match fs::metadata(path) {
        Ok(metadata) => Ok(metadata.is_dir()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(source) => Err(SpecArchiveError::InspectSpecDirectory {
            path: display_path(path),
            source,
        }),
    }
}

fn find_node_by_identity<'a>(
    nodes: &'a [SpecNode],
    source_group_id: &str,
    relative_id: &str,
) -> Option<&'a SpecNode> {
    nodes.iter().find_map(|node| {
        if node.source_group_id() == source_group_id && node.relative_id() == relative_id {
            return Some(node);
        }

        find_node_by_identity(node.children(), source_group_id, relative_id)
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ArchiveSpecPaths {
    source_path: PathBuf,
    source_root: PathBuf,
    source_group_id: String,
    relative_spec_path: PathBuf,
}

fn archive_spec_paths(
    layout: &WorkspaceLayout,
    relative_spec_path: &Path,
) -> Result<ArchiveSpecPaths, SpecArchiveError> {
    let workspace_root = PathBuf::from(layout.root().as_str());

    if let Some(source_root_relative) = claude_plugin_worktree_source_root(relative_spec_path) {
        let relative_path = relative_spec_path
            .strip_prefix(&source_root_relative)
            .map_err(|_| SpecArchiveError::InvalidArchiveSource {
                spec_id: display_path(relative_spec_path),
            })?
            .to_path_buf();

        return Ok(ArchiveSpecPaths {
            source_path: workspace_root.join(relative_spec_path),
            source_root: workspace_root.join(&source_root_relative),
            source_group_id: display_path(&source_root_relative),
            relative_spec_path: relative_path,
        });
    }

    let source_root_relative = Path::new(spec_root_directory_for_kind(layout.kind()));
    let source_root = workspace_root.join(source_root_relative);
    let relative_path = relative_spec_path
        .strip_prefix(source_root_relative)
        .unwrap_or(relative_spec_path)
        .to_path_buf();

    Ok(ArchiveSpecPaths {
        source_path: source_root.join(&relative_path),
        source_root,
        source_group_id: display_path(source_root_relative),
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

fn spec_root_directory_for_kind(kind: WorkspaceKind) -> &'static str {
    match kind {
        WorkspaceKind::PluginWorkspace => PLUGIN_WORKSPACE_SPECS_DIR,
        WorkspaceKind::PluginWorktree => PLUGIN_WORKTREE_SPECS_DIR,
    }
}

fn spec_scan_roots(layout: &WorkspaceLayout) -> Result<Vec<SpecScanRoot>, SpecTreeScanError> {
    let mut roots = Vec::new();
    let primary_root = spec_root_path(layout);

    if directory_exists_for_scan(&primary_root)? {
        roots.push(SpecScanRoot::primary(
            primary_root,
            spec_root_directory_for_kind(layout.kind()).to_string(),
        ));
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
    let components = relative_spec_path_components(relative_spec_path);

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

fn claude_plugin_worktree_source_root(relative_spec_path: &Path) -> Option<PathBuf> {
    let components = relative_spec_path_components(relative_spec_path);

    if !matches!(
        components.as_slice(),
        [claude, worktrees, worktree_name, plugin_container, specs, ..]
            if claude == ".claude"
                && worktrees == "worktrees"
                && !worktree_name.is_empty()
                && CLAUDE_WORKTREE_SPEC_CONTAINERS.contains(&plugin_container.as_str())
                && specs == PLUGIN_WORKTREE_SPECS_DIR
    ) {
        return None;
    }

    let mut source_root = PathBuf::new();

    for component in components.iter().take(5) {
        source_root.push(component);
    }

    Some(source_root)
}

fn relative_spec_path_components(relative_spec_path: &Path) -> Vec<String> {
    let components: Vec<String> = relative_spec_path
        .components()
        .map(|component| component.as_os_str().to_string_lossy().into_owned())
        .collect();

    components
}

fn scan_source_group(
    root: &SpecScanRoot,
    config: &WorkspaceConfig,
) -> Result<Vec<SpecNode>, SpecTreeScanError> {
    let source_group_id = root.source_group_id();
    let mut nodes = scan_directory_children(&root.path, source_group_id, "", config)?;
    let archive_path = root.path.join(SPEC_ARCHIVE_DIRECTORY);
    let archive_children = if directory_exists_for_scan(&archive_path)? {
        scan_directory_children(
            &archive_path,
            source_group_id,
            SPEC_ARCHIVE_DIRECTORY,
            config,
        )?
    } else {
        Vec::new()
    };
    let archive_identity =
        SpecNodeIdentity::new(source_group_id, SPEC_ARCHIVE_DIRECTORY).map_err(|source| {
            SpecTreeScanError::InvalidNode {
                id: spec_node_id(source_group_id, SPEC_ARCHIVE_DIRECTORY),
                path: display_path(&archive_path),
                source,
            }
        })?;
    let archive =
        SpecNode::archive(archive_identity, "Archive", archive_children).map_err(|source| {
            SpecTreeScanError::InvalidNode {
                id: spec_node_id(source_group_id, SPEC_ARCHIVE_DIRECTORY),
                path: display_path(&archive_path),
                source,
            }
        })?;
    nodes.push(archive);

    Ok(nodes)
}

fn scan_directory_children(
    directory: &Path,
    source_group_id: &str,
    parent_relative_id: &str,
    config: &WorkspaceConfig,
) -> Result<Vec<SpecNode>, SpecTreeScanError> {
    let child_directories = visible_child_directories(directory, config)?;

    child_directories
        .into_iter()
        .map(|(label, path)| {
            let relative_id = relative_node_id(parent_relative_id, &label);
            scan_directory_projection(&path, source_group_id, &relative_id, &label, config)
        })
        .collect()
}

fn visible_child_directories(
    directory: &Path,
    config: &WorkspaceConfig,
) -> Result<Vec<(String, PathBuf)>, SpecTreeScanError> {
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

        if is_hidden_name(&file_name) || is_scan_excluded_name(&file_name, config) {
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
    Ok(child_directories)
}

fn is_scan_excluded_name(file_name: &str, config: &WorkspaceConfig) -> bool {
    config
        .scan_excluded_directory_names()
        .iter()
        .any(|excluded_name| excluded_name == file_name)
}

fn scan_directory_projection(
    directory: &Path,
    source_group_id: &str,
    relative_id: &str,
    label: &str,
    config: &WorkspaceConfig,
) -> Result<SpecNode, SpecTreeScanError> {
    let effective = effective_directory_config(directory, config)?;
    let children = scan_directory_children(directory, source_group_id, relative_id, config)?;
    let files = scan_spec_files(directory, &effective.config)?;
    let present_document_count = files
        .iter()
        .filter(|file| file.status() == SpecFileStatus::Present)
        .count();

    if effective.node_kind == Some(SpecNodeKind::Category) && present_document_count > 0 {
        return Err(SpecTreeScanError::ConflictingNodeKind {
            path: display_path(directory),
        });
    }

    let inferred_kind =
        if present_document_count > 0 || has_numbered_spec_name(label) || children.is_empty() {
            SpecNodeKind::Spec
        } else {
            SpecNodeKind::Category
        };
    let kind = effective.node_kind.unwrap_or(inferred_kind);
    let identity = SpecNodeIdentity::new(source_group_id, relative_id).map_err(|source| {
        SpecTreeScanError::InvalidNode {
            id: spec_node_id(source_group_id, relative_id),
            path: display_path(directory),
            source,
        }
    })?;

    match kind {
        SpecNodeKind::Spec => SpecNode::spec(identity, label, files, children),
        SpecNodeKind::Category => SpecNode::category(identity, label, children),
        SpecNodeKind::Archive | SpecNodeKind::SourceGroup => {
            unreachable!("spec override only accepts spec or category kinds")
        }
    }
    .map_err(|source| SpecTreeScanError::InvalidNode {
        id: spec_node_id(source_group_id, relative_id),
        path: display_path(directory),
        source,
    })
}

fn has_numbered_spec_name(label: &str) -> bool {
    let bytes = label.as_bytes();
    bytes.len() > 4 && bytes[..3].iter().all(u8::is_ascii_digit) && bytes[3] == b'-'
}

fn relative_node_id(parent_relative_id: &str, label: &str) -> String {
    if parent_relative_id.is_empty() {
        return label.to_string();
    }

    format!("{parent_relative_id}/{label}")
}

struct EffectiveDirectoryConfig {
    config: WorkspaceConfig,
    node_kind: Option<SpecNodeKind>,
}

fn effective_directory_config(
    directory: &Path,
    config: &WorkspaceConfig,
) -> Result<EffectiveDirectoryConfig, SpecTreeScanError> {
    let Some(spec_override) = WorkspaceConfigLoader::new()
        .load_spec_override_from_directory(directory)
        .map_err(|source| SpecTreeScanError::ConfigOverrideLoad {
            path: display_path(directory),
            source,
        })?
    else {
        return Ok(EffectiveDirectoryConfig {
            config: config.clone(),
            node_kind: None,
        });
    };

    Ok(EffectiveDirectoryConfig {
        config: config.merge_spec_override(&spec_override),
        node_kind: spec_override.node_kind(),
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
            let resolved_file = resolve_spec_file_for_scan(mapping.key(), &file_path)?;

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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct ScannedSpecFile {
    status: SpecFileStatus,
    format: SpecDocumentFormat,
}

fn resolve_spec_file_for_scan(
    key: SpecFileKey,
    configured_path: &Path,
) -> Result<ScannedSpecFile, SpecTreeScanError> {
    let candidates = spec_file_path_candidates(key, configured_path);
    let preferred_format = candidates
        .first()
        .map(SpecFilePathCandidate::format)
        .unwrap_or_else(|| SpecDocumentFormat::from_file_name(&display_path(configured_path)));

    for candidate in &candidates {
        if spec_file_status(candidate.path())? == SpecFileStatus::Present {
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
    #[error("explicit category contains configured documents: {path}")]
    ConflictingNodeKind { path: String },
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

#[derive(Debug, Error)]
pub enum SpecArchiveError {
    #[error("spec id cannot be archived because it is a source group root: {spec_id}")]
    SourceGroupRoot { spec_id: String },
    #[error("spec id is already inside an archive: {spec_id}")]
    AlreadyArchived { spec_id: String },
    #[error("node is not archivable ({kind:?}): {spec_id}")]
    NotArchivableNode { spec_id: String, kind: SpecNodeKind },
    #[error("source group is no longer available; reload required: {source_group_id}")]
    StaleSourceGroup { source_group_id: String },
    #[error("spec node is stale; reload required: {source_group_id}:{relative_id}")]
    StaleSpecNode {
        source_group_id: String,
        relative_id: String,
    },
    #[error("failed to scan authoritative spec projection before archive")]
    ScanProjection { source: SpecTreeScanError },
    #[error("failed to acquire archive lock for source group: {source_group_id}")]
    ArchiveLock { source_group_id: String },
    #[error(
        "archive destination remained occupied after retries: {source_group_id}:{relative_id}"
    )]
    DestinationConflict {
        source_group_id: String,
        relative_id: String,
    },
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
    use std::{
        env, fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;
    use crate::domain::{
        spec::{SpecDocumentFormat, SpecFileKey, SpecFileStatus, SpecNodeKind},
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
    fn rejects_spec_skill_marker_without_current_workspace_marker() {
        let workspace = TestWorkspace::new("spec-skill-only");
        workspace.create_dir(".spec-skill/features");

        let result = FilesystemWorkspaceDetector::new().detect(workspace.root());

        assert!(matches!(
            result,
            Err(WorkspaceDetectionError::UnsupportedWorkspace { root })
                if root == workspace.root().to_string_lossy()
        ));
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
    fn spec_tree_scanner_projects_implicit_root_categories_counts_and_archive_last() {
        let workspace = TestWorkspace::new("semantic-projection");
        workspace.write_file(".plugin-workspace/.specs/alpha/tasks.md", "");
        workspace.create_dir(".plugin-workspace/.specs/planning/001-child");
        workspace.write_file(".plugin-workspace/.specs/.archive/old/tasks.md", "");
        workspace.create_dir(".plugin-workspace/.specs/.hidden");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("spec tree should be scanned");

        assert_eq!(
            vec![
                ".plugin-workspace/.specs/alpha",
                ".plugin-workspace/.specs/planning",
                ".plugin-workspace/.specs/.archive",
            ],
            node_ids(&tree),
        );
        assert_eq!(SpecNodeKind::Spec, tree[0].kind());
        assert_eq!(1, tree[0].present_document_count());
        assert_eq!(SpecNodeKind::Category, tree[1].kind());
        assert_eq!(1, tree[1].descendant_spec_count());
        assert_eq!(SpecNodeKind::Archive, tree[2].kind());
        assert_eq!(1, tree[2].descendant_spec_count());
    }

    #[test]
    fn spec_tree_scanner_orders_source_groups_and_preserves_stable_identity_and_counts() {
        let workspace = TestWorkspace::new("source-group-projection");
        workspace.write_file(".plugin-workspace/.specs/alpha/tasks.md", "");
        workspace.write_file(".plugin-workspace/.specs/unmapped/notes.md", "# ignored");
        workspace.create_dir(".plugin-workspace/.specs/planning/001-first");
        workspace.create_dir(".plugin-workspace/.specs/planning/002-second");
        workspace.create_dir(".plugin-workspace/.specs/planning/leaf");
        workspace.write_file(".plugin-workspace/.specs/.archive/old/tasks.md", "");
        workspace.create_dir(".plugin-workspace/.specs/.hidden/ignored");
        workspace.create_dir(".plugin-workspace/.specs/.archive-other/ignored");
        workspace.create_dir(".claude/worktrees/zeta/.plugin-worktree/.specs/z-spec");
        workspace.create_dir(".claude/worktrees/alpha/.plugin-worktree/.specs/a-spec");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("all source groups should be scanned");

        assert_eq!(
            vec![
                ".plugin-workspace/.specs/alpha",
                ".plugin-workspace/.specs/planning",
                ".plugin-workspace/.specs/unmapped",
                ".plugin-workspace/.specs/.archive",
                ".claude/worktrees/alpha/.plugin-worktree/.specs",
                ".claude/worktrees/zeta/.plugin-worktree/.specs",
            ],
            node_ids(&tree),
        );
        assert_eq!(1, tree[0].present_document_count());
        assert_eq!(3, tree[1].descendant_spec_count());
        assert_eq!(0, tree[2].present_document_count());
        assert_eq!(1, tree[3].descendant_spec_count());
        assert_eq!(SpecNodeKind::SourceGroup, tree[4].kind());
        assert_eq!(1, tree[4].descendant_spec_count());
        assert_eq!(
            vec![
                ".claude/worktrees/alpha/.plugin-worktree/.specs/a-spec",
                ".claude/worktrees/alpha/.plugin-worktree/.specs/.archive",
            ],
            node_ids(tree[4].children()),
        );
        assert_eq!(".plugin-workspace/.specs", tree[1].source_group_id());
        assert_eq!("planning", tree[1].relative_id());
        assert_eq!("planning/001-first", tree[1].children()[0].relative_id());
        assert_eq!(".archive", tree[3].relative_id());
        assert_eq!(".archive/old", tree[3].children()[0].relative_id());
        assert_eq!(
            ".claude/worktrees/alpha/.plugin-worktree/.specs",
            tree[4].source_group_id(),
        );
        assert_eq!(".", tree[4].relative_id());
        assert_eq!("a-spec", tree[4].children()[0].relative_id());
        assert!(node_ids(&tree)
            .iter()
            .all(|id| !id.contains(".hidden") && !id.contains(".archive-other")));
    }

    #[test]
    fn spec_tree_scanner_prefers_explicit_node_kind_marker() {
        let workspace = TestWorkspace::new("semantic-marker");
        workspace.write_file(
            ".plugin-workspace/.specs/empty-category/.spec-reviewer/config.json",
            r#"{ "nodeKind": "category" }"#,
        );
        workspace.write_file(
            ".plugin-workspace/.specs/parent-spec/.spec-reviewer/config.json",
            r#"{ "nodeKind": "spec" }"#,
        );
        workspace.create_dir(".plugin-workspace/.specs/parent-spec/child");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("spec tree should be scanned");

        assert_eq!(SpecNodeKind::Category, tree[0].kind());
        assert_eq!(SpecNodeKind::Spec, tree[1].kind());
    }

    #[test]
    fn spec_tree_scanner_rejects_explicit_category_with_mapped_document() {
        let workspace = TestWorkspace::new("semantic-marker-conflict");
        workspace.write_file(
            ".plugin-workspace/.specs/category/.spec-reviewer/config.json",
            r#"{ "nodeKind": "category" }"#,
        );
        workspace.write_file(".plugin-workspace/.specs/category/tasks.md", "");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let result = FilesystemSpecTreeScanner::new().scan(&layout, &config);

        assert!(matches!(
            result,
            Err(SpecTreeScanError::ConflictingNodeKind { .. })
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

        assert_eq!(
            vec![
                ".plugin-workspace/.specs/auth",
                ".plugin-workspace/.specs/zeta",
                ".plugin-workspace/.specs/.archive"
            ],
            node_ids(&tree)
        );

        let auth = &tree[0];
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
        assert_eq!(
            Some(SpecFileStatus::Missing),
            auth.file_for_key(SpecFileKey::Requirements)
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

        let auth = &tree[0];
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

        let auth = &tree[0];
        let tech_reference = auth
            .file_for_key(SpecFileKey::TechReference)
            .expect("tech reference file should be configured");
        assert_eq!(SpecFileStatus::Missing, tech_reference.status());
        assert_eq!(SpecDocumentFormat::Html, tech_reference.format());
    }

    #[test]
    fn spec_tree_scanner_reports_requirements_and_html_files_after_tasks() {
        let workspace = TestWorkspace::new("test-cases-html");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.write_file(
            ".plugin-workspace/.specs/auth/requirements.html",
            "<h1>Requirements</h1>",
        );
        workspace.write_file(
            ".plugin-workspace/.specs/auth/test-cases.html",
            "<h1>Cases</h1>",
        );
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("spec tree should be scanned");

        let auth = &tree[0];
        let files: Vec<(SpecFileKey, SpecDocumentFormat)> = auth
            .files()
            .iter()
            .map(|file| (file.key(), file.format()))
            .collect();
        assert_eq!(
            Some(&(SpecFileKey::Requirements, SpecDocumentFormat::Html)),
            files.get(2)
        );
        assert_eq!(
            Some(&(SpecFileKey::TechReference, SpecDocumentFormat::Html)),
            files.get(3)
        );
        assert_eq!(
            Some(&(SpecFileKey::TestCases, SpecDocumentFormat::Html)),
            files.get(4)
        );

        let test_cases = auth
            .file_for_key(SpecFileKey::TestCases)
            .expect("test cases file should be configured");
        assert_eq!(SpecFileStatus::Present, test_cases.status());
        assert_eq!("test-cases.html", test_cases.file_name());

        let requirements = auth
            .file_for_key(SpecFileKey::Requirements)
            .expect("requirements file should be configured");
        assert_eq!(SpecFileStatus::Present, requirements.status());
        assert_eq!("requirements.html", requirements.file_name());
    }

    #[test]
    fn spec_tree_scanner_reports_test_cases_markdown_fallback() {
        let workspace = TestWorkspace::new("test-cases-markdown-fallback");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.write_file(".plugin-workspace/.specs/auth/test-cases.md", "# Cases");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let tree = FilesystemSpecTreeScanner::new()
            .scan(&layout, &config)
            .expect("spec tree should be scanned");

        let test_cases = tree[0]
            .file_for_key(SpecFileKey::TestCases)
            .expect("test cases file should be configured");
        assert_eq!(SpecFileStatus::Present, test_cases.status());
        assert_eq!(SpecDocumentFormat::Markdown, test_cases.format());
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

        assert_eq!(
            vec![
                ".plugin-workspace/.specs/visible",
                ".plugin-workspace/.specs/.archive"
            ],
            node_ids(&tree)
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

        let auth = &tree[0];
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

        let auth = &tree[0];
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

        let tasks = tree[0]
            .file_for_key(SpecFileKey::Tasks)
            .expect("tasks mapping should exist");

        assert_eq!("tasks.md", tasks.file_name());
        assert_eq!(SpecFileStatus::Present, tasks.status());
        assert_eq!(SpecDocumentFormat::Html, tasks.format());
    }

    #[test]
    fn archive_spec_directory_moves_plugin_workspace_spec_to_hidden_archive() {
        let workspace = TestWorkspace::new("archive-plugin-workspace-spec");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.write_file(".plugin-workspace/.specs/auth/tasks.md", "# Tasks");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let archive_path =
            archive_spec_directory(&layout, &config, ".plugin-workspace/.specs/auth")
                .expect("spec should be archived");

        assert_eq!(
            workspace
                .root()
                .join(".plugin-workspace/.specs/.archive/auth"),
            archive_path.path()
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
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let archive_path =
            archive_spec_directory(&layout, &config, ".plugin-workspace/.specs/auth")
                .expect("spec should be archived with suffix");

        assert_eq!(
            workspace
                .root()
                .join(".plugin-workspace/.specs/.archive/auth-1"),
            archive_path.path()
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
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let result = archive_spec_directory(&layout, &config, ".plugin-workspace/.specs");

        assert!(matches!(
            result,
            Err(SpecArchiveError::SourceGroupRoot { .. })
        ));
    }

    #[test]
    fn archive_spec_directory_rejects_category_archived_and_moved_nodes() {
        let workspace = TestWorkspace::new("archive-kind-guards");
        workspace.write_file(
            ".plugin-workspace/.specs/category/.spec-reviewer/config.json",
            r#"{ "nodeKind": "category" }"#,
        );
        workspace.create_dir(".plugin-workspace/.specs/category/child");
        workspace.write_file(".plugin-workspace/.specs/auth/tasks.md", "# Tasks");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let category =
            archive_spec_directory(&layout, &config, ".plugin-workspace/.specs/category");
        assert!(matches!(
            category,
            Err(SpecArchiveError::NotArchivableNode {
                kind: SpecNodeKind::Category,
                ..
            })
        ));

        let archived =
            archive_spec_directory(&layout, &config, ".plugin-workspace/.specs/.archive/old");
        assert!(matches!(
            archived,
            Err(SpecArchiveError::AlreadyArchived { .. })
        ));

        archive_spec_directory(&layout, &config, ".plugin-workspace/.specs/auth")
            .expect("first archive should succeed");
        let moved = archive_spec_directory(&layout, &config, ".plugin-workspace/.specs/auth");
        assert!(matches!(moved, Err(SpecArchiveError::StaleSpecNode { .. })));
    }

    #[test]
    fn archive_spec_directory_reports_stale_secondary_source_group() {
        let workspace = TestWorkspace::new("archive-stale-source-group");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let result = archive_spec_directory(
            &layout,
            &config,
            ".claude/worktrees/missing/.plugin-worktree/.specs/auth",
        );

        assert!(matches!(
            result,
            Err(SpecArchiveError::StaleSourceGroup { .. })
        ));
    }

    #[test]
    fn archive_spec_directory_returns_unique_destination_identity_for_two_collisions() {
        let workspace = TestWorkspace::new("archive-destination-identity");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);
        let mut destinations = Vec::new();

        for _ in 0..3 {
            workspace.write_file(".plugin-workspace/.specs/auth/tasks.md", "# Tasks");
            destinations.push(
                archive_spec_directory(&layout, &config, ".plugin-workspace/.specs/auth")
                    .expect("archive should allocate a unique destination"),
            );
        }

        assert_eq!(
            vec![".archive/auth", ".archive/auth-1", ".archive/auth-2"],
            destinations
                .iter()
                .map(ArchivedSpecDestination::destination_node_id)
                .collect::<Vec<_>>(),
        );
        assert!(destinations
            .iter()
            .all(|destination| destination.source_group_id() == PLUGIN_WORKSPACE_SPECS_DIR));
    }

    #[test]
    fn archive_spec_directory_serializes_concurrent_requests_per_source_group() {
        let workspace = TestWorkspace::new("archive-concurrency");
        workspace.write_file(".plugin-workspace/.specs/auth/tasks.md", "# Auth");
        workspace.write_file(".plugin-workspace/.specs/billing/tasks.md", "# Billing");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);
        let requests = ["auth", "billing"].map(|spec| {
            let layout = layout.clone();
            let config = config.clone();
            std::thread::spawn(move || {
                archive_spec_directory(
                    &layout,
                    &config,
                    &format!(".plugin-workspace/.specs/{spec}"),
                )
            })
        });
        let destinations = requests.map(|request| {
            request
                .join()
                .expect("archive thread should not panic")
                .expect("archive request should succeed")
        });

        assert_ne!(
            destinations[0].destination_node_id(),
            destinations[1].destination_node_id(),
        );
        assert!(destinations
            .iter()
            .all(|destination| destination.source_group_id() == PLUGIN_WORKSPACE_SPECS_DIR));
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
        assert_eq!(".plugin-workspace/.specs/021-issue-262", issue.id());
        assert_eq!(
            vec![".plugin-workspace/.specs/021-issue-262/code-review"],
            node_ids(issue.children())
        );
        assert_eq!(
            vec![
                (SpecFileKey::Impl, SpecFileStatus::Present),
                (SpecFileKey::Tasks, SpecFileStatus::Present),
                (SpecFileKey::Requirements, SpecFileStatus::Missing),
                (SpecFileKey::TechReference, SpecFileStatus::Missing),
                (SpecFileKey::TestCases, SpecFileStatus::Missing),
                (SpecFileKey::Exploration, SpecFileStatus::Present),
                (SpecFileKey::Hearing, SpecFileStatus::Present),
                (SpecFileKey::QuizPlan, SpecFileStatus::Missing),
                (SpecFileKey::QuizImpl, SpecFileStatus::Missing),
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
            vec![
                ".claude/worktrees/feature-auth/.plugin-worktree/.specs/auth",
                ".claude/worktrees/feature-auth/.plugin-worktree/.specs/.archive"
            ],
            node_ids(worktree.children())
        );
        assert_eq!(
            vec![
                (SpecFileKey::Impl, SpecFileStatus::Present),
                (SpecFileKey::Tasks, SpecFileStatus::Present),
                (SpecFileKey::Requirements, SpecFileStatus::Missing),
                (SpecFileKey::TechReference, SpecFileStatus::Missing),
                (SpecFileKey::TestCases, SpecFileStatus::Missing),
                (SpecFileKey::Exploration, SpecFileStatus::Present),
                (SpecFileKey::Hearing, SpecFileStatus::Present),
                (SpecFileKey::QuizPlan, SpecFileStatus::Missing),
                (SpecFileKey::QuizImpl, SpecFileStatus::Missing),
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
            vec![
                ".claude/worktrees/doccom-be/.plugin-workspace/.specs/019-be-doc-comments",
                ".claude/worktrees/doccom-be/.plugin-workspace/.specs/.archive"
            ],
            node_ids(worktree.children())
        );
        assert_eq!(
            vec![
                (SpecFileKey::Impl, SpecFileStatus::Present),
                (SpecFileKey::Tasks, SpecFileStatus::Present),
                (SpecFileKey::Requirements, SpecFileStatus::Missing),
                (SpecFileKey::TechReference, SpecFileStatus::Missing),
                (SpecFileKey::TestCases, SpecFileStatus::Missing),
                (SpecFileKey::Exploration, SpecFileStatus::Present),
                (SpecFileKey::Hearing, SpecFileStatus::Present),
                (SpecFileKey::QuizPlan, SpecFileStatus::Missing),
                (SpecFileKey::QuizImpl, SpecFileStatus::Missing),
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
    fn spec_directory_path_resolves_root_plugin_workspace_source_group_spec_ids() {
        let workspace = TestWorkspace::new("root-plugin-workspace-source-group-spec-path");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let path = spec_directory_path(&layout, ".plugin-workspace/.specs/auth")
            .expect("root source group spec id should resolve");

        assert_eq!(workspace.root().join(".plugin-workspace/.specs/auth"), path);
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

        let auth = &tree[0];
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

        let auth = &tree[0];
        let checkout = &tree[1];

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
