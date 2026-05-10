//! Filesystem adapters.

use std::{
    fs, io,
    path::{Component, Path, PathBuf},
};

use thiserror::Error;

use crate::domain::{
    spec::{SpecDocumentFormat, SpecDomainError, SpecFile, SpecFileStatus, SpecNode},
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

pub fn archive_spec_directory(
    layout: &WorkspaceLayout,
    spec_id: &str,
) -> Result<PathBuf, SpecArchiveError> {
    let relative_spec_path = safe_relative_spec_path(spec_id).map_err(SpecArchiveError::from)?;
    let archive_paths = archive_spec_paths(layout, &relative_spec_path)?;

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
        unique_archive_destination(&archive_root, &archive_paths.relative_spec_path);
    let parent =
        destination_path
            .parent()
            .ok_or_else(|| SpecArchiveError::InvalidArchiveDestination {
                path: display_path(&destination_path),
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

#[derive(Debug, Clone, PartialEq, Eq)]
struct ArchiveSpecPaths {
    source_path: PathBuf,
    source_root: PathBuf,
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
            source_root: workspace_root.join(source_root_relative),
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
        WorkspaceKind::SpecSkill => SPEC_SKILL_FEATURES_DIR,
    }
}

fn spec_scan_roots(layout: &WorkspaceLayout) -> Result<Vec<SpecScanRoot>, SpecTreeScanError> {
    let mut roots = Vec::new();
    let primary_root = spec_root_path(layout);

    if directory_exists_for_scan(&primary_root)? {
        if let Some((id_prefix, label)) = primary_source_group_for_kind(layout.kind()) {
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
        roots.extend(collect_claude_worktree_scan_roots(Path::new(
            layout.root().as_str(),
        ))?);
    }

    Ok(roots)
}

fn primary_source_group_for_kind(kind: WorkspaceKind) -> Option<(&'static str, &'static str)> {
    match kind {
        WorkspaceKind::PluginWorkspace => Some((PLUGIN_WORKSPACE_SPECS_DIR, "ルート")),
        WorkspaceKind::PluginWorktree | WorkspaceKind::SpecSkill => None,
    }
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
            let resolved_file = resolve_spec_file_for_scan(&file_path)?;

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

fn resolve_spec_file_for_scan(path: &Path) -> Result<ScannedSpecFile, SpecTreeScanError> {
    let preferred_format = SpecDocumentFormat::from_file_name(&display_path(path));

    if spec_file_status(path)? == SpecFileStatus::Present {
        return Ok(ScannedSpecFile {
            status: SpecFileStatus::Present,
            format: preferred_format,
        });
    }

    let Some(html_fallback_path) = html_fallback_path(path) else {
        return Ok(ScannedSpecFile {
            status: SpecFileStatus::Missing,
            format: preferred_format,
        });
    };

    let fallback_status = spec_file_status(&html_fallback_path)?;

    if fallback_status == SpecFileStatus::Present {
        return Ok(ScannedSpecFile {
            status: SpecFileStatus::Present,
            format: SpecDocumentFormat::Html,
        });
    }

    Ok(ScannedSpecFile {
        status: SpecFileStatus::Missing,
        format: preferred_format,
    })
}

fn html_fallback_path(path: &Path) -> Option<PathBuf> {
    if !path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
    {
        return None;
    }

    Some(path.with_extension("html"))
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
    fn archive_spec_directory_moves_plugin_workspace_spec_to_hidden_archive() {
        let workspace = TestWorkspace::new("archive-plugin-workspace-spec");
        workspace.create_dir(PLUGIN_WORKSPACE_SPECS_DIR);
        workspace.write_file(".plugin-workspace/.specs/auth/tasks.md", "# Tasks");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let archive_path = archive_spec_directory(&layout, ".plugin-workspace/.specs/auth")
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

        let archive_path = archive_spec_directory(&layout, ".plugin-workspace/.specs/auth")
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

        let result = archive_spec_directory(&layout, ".plugin-workspace/.specs");

        assert!(matches!(
            result,
            Err(SpecArchiveError::SourceGroupRoot { .. })
        ));
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
            vec![
                ".plugin-workspace/.specs/021-issue-262/code-review",
                ".plugin-workspace/.specs/021-issue-262/plan-review"
            ],
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
