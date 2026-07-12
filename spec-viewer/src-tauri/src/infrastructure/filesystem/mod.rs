//! Filesystem adapters.

use std::{
    fs, io,
    path::{Path, PathBuf},
};

use thiserror::Error;

use crate::domain::{
    spec::{
        ScanSpecTree, SpecDirectoryFact, SpecDocumentFormat, SpecFileFact, SpecFileKey,
        SpecFileStatus, SpecId, SpecRootFact, SpecTreeAssembler, SpecTreeFacts,
        SpecTreeScanPortError,
    },
    workspace::{
        DetectWorkspace, LoadSpecConfigOverride, WorkspaceConfig, WorkspaceConfigLoadPortError,
        WorkspaceDetectionMode, WorkspaceDetectionPortError, WorkspaceDomainError, WorkspaceKind,
        WorkspaceLayout, WorkspaceRelativePath, WorkspaceRoot, WorkspaceTopology,
    },
};
use crate::infrastructure::persistence::config::WorkspaceConfigLoader;
use crate::infrastructure::spec_file_resolution::{
    spec_file_path_candidates, SpecFilePathCandidate,
};

const SPEC_ARCHIVE_DIRECTORY: &str = ".archive";

#[derive(Debug, Clone, Default)]
pub struct FilesystemWorkspaceDetector {
    path_checker: FilesystemPathChecker,
    topology: WorkspaceTopology,
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
            for rule in self.topology.detection_precedence() {
                let detected_root = match rule.mode() {
                    WorkspaceDetectionMode::Marker => self
                        .path_checker
                        .directory_exists(directory.join(rule.marker().as_str()))?
                        .then(|| directory.to_path_buf()),
                    WorkspaceDetectionMode::NamedDirectoryMarker => {
                        let has_required_name =
                            directory.file_name().and_then(|name| name.to_str())
                                == rule.required_directory_name();
                        (has_required_name
                            && self
                                .path_checker
                                .directory_exists(directory.join(rule.marker().as_str()))?)
                        .then(|| directory.to_path_buf())
                    }
                    WorkspaceDetectionMode::ClaudeWorktreeCollection => {
                        self.detect_claude_worktree_collection_root(directory)?
                    }
                };

                if let Some(root) = detected_root {
                    return create_workspace_layout(&root, rule.kind());
                }
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
        let collection_root = self.topology.claude_worktree_collection_root();

        for workspace_root in possible_claude_worktree_collection_roots(directory, &self.topology) {
            if self
                .path_checker
                .directory_exists(workspace_root.join(collection_root.as_str()))?
                && has_claude_worktree_specs(&workspace_root, &self.topology)?
            {
                return Ok(Some(workspace_root));
            }
        }

        Ok(None)
    }
}

impl DetectWorkspace for FilesystemWorkspaceDetector {
    fn detect_workspace(
        &self,
        selected_directory: &str,
    ) -> Result<WorkspaceLayout, WorkspaceDetectionPortError> {
        self.detect(selected_directory)
            .map_err(|source| WorkspaceDetectionPortError::new(source.to_string()))
    }
}

#[derive(Debug, Clone)]
pub struct FilesystemSpecTreeScanner<ConfigLoader = WorkspaceConfigLoader> {
    config_loader: ConfigLoader,
    topology: WorkspaceTopology,
}

impl<ConfigLoader> FilesystemSpecTreeScanner<ConfigLoader> {
    pub fn new(config_loader: ConfigLoader) -> Self {
        Self {
            config_loader,
            topology: WorkspaceTopology::default(),
        }
    }

    pub fn scan(
        &self,
        layout: &WorkspaceLayout,
        config: &WorkspaceConfig,
    ) -> Result<SpecTreeFacts, SpecTreeScanError>
    where
        ConfigLoader: LoadSpecConfigOverride,
    {
        let mut roots = Vec::new();

        for root in spec_scan_roots(layout, &self.topology)? {
            let children = scan_child_directories(
                &root.path,
                &root.relative_path,
                layout,
                config,
                &self.config_loader,
            )?;
            roots.push(SpecRootFact::new(root.relative_path.as_str(), children));
        }

        Ok(SpecTreeFacts::new(roots))
    }
}

impl<ConfigLoader> ScanSpecTree for FilesystemSpecTreeScanner<ConfigLoader>
where
    ConfigLoader: LoadSpecConfigOverride,
{
    fn scan_spec_tree(
        &self,
        layout: &WorkspaceLayout,
        config: &WorkspaceConfig,
    ) -> Result<SpecTreeFacts, SpecTreeScanPortError> {
        self.scan(layout, config).map_err(|source| {
            let message = source.to_string();

            if matches!(source, SpecTreeScanError::ConfigOverrideLoad { .. }) {
                return SpecTreeScanPortError::config_load(message);
            }

            SpecTreeScanPortError::scan(message)
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SpecScanRoot {
    path: PathBuf,
    relative_path: WorkspaceRelativePath,
}

impl SpecScanRoot {
    fn new(path: PathBuf, relative_path: WorkspaceRelativePath) -> Self {
        Self {
            path,
            relative_path,
        }
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
    #[error("workspace topology is invalid")]
    InvalidTopology { source: WorkspaceDomainError },
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
    let topology = WorkspaceTopology::default();
    PathBuf::from(layout.root().as_str()).join(topology.primary_spec_root(layout.kind()).as_str())
}

fn spec_relative_path(spec_id: &SpecId) -> PathBuf {
    let mut path = PathBuf::new();

    for segment in spec_id.segments() {
        path.push(segment);
    }

    path
}

pub fn spec_directory_path(layout: &WorkspaceLayout, spec_id: &SpecId) -> PathBuf {
    let location = WorkspaceTopology::default()
        .locate_spec(layout.kind(), spec_id.as_str())
        .expect("validated spec id should resolve to a workspace-relative location");

    PathBuf::from(layout.root().as_str()).join(location.directory().as_str())
}

pub fn archive_spec_directory(
    layout: &WorkspaceLayout,
    spec_id: &SpecId,
) -> Result<PathBuf, SpecArchiveError> {
    let relative_spec_path = spec_relative_path(spec_id);
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
    let relative_spec_id = display_path(relative_spec_path);
    let location = WorkspaceTopology::default()
        .locate_spec(layout.kind(), &relative_spec_id)
        .map_err(|_| SpecArchiveError::InvalidArchiveSource {
            spec_id: relative_spec_id,
        })?;

    Ok(ArchiveSpecPaths {
        source_path: workspace_root.join(location.directory().as_str()),
        source_root: workspace_root.join(location.source_root().as_str()),
        relative_spec_path: PathBuf::from(location.relative_spec()),
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

fn spec_scan_roots(
    layout: &WorkspaceLayout,
    topology: &WorkspaceTopology,
) -> Result<Vec<SpecScanRoot>, SpecTreeScanError> {
    let mut roots = Vec::new();
    let primary_relative = topology.primary_spec_root(layout.kind());
    let primary_root = PathBuf::from(layout.root().as_str()).join(primary_relative.as_str());

    if directory_exists_for_scan(&primary_root)? {
        roots.push(SpecScanRoot::new(primary_root, primary_relative));
    }

    if layout.kind() == WorkspaceKind::PluginWorkspace {
        roots.extend(collect_claude_worktree_scan_roots(
            Path::new(layout.root().as_str()),
            topology,
        )?);
    }

    Ok(roots)
}

fn collect_claude_worktree_scan_roots(
    workspace_root: &Path,
    topology: &WorkspaceTopology,
) -> Result<Vec<SpecScanRoot>, SpecTreeScanError> {
    let worktrees_root = workspace_root.join(topology.claude_worktree_collection_root().as_str());
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

        for container in topology.claude_worktree_containers() {
            let relative_path = topology
                .claude_worktree_spec_root(&worktree_name, container)
                .map_err(|source| SpecTreeScanError::InvalidObservation {
                    path: display_path(&entry.path()),
                    source,
                })?;
            let specs_path = workspace_root.join(relative_path.as_str());

            if !directory_exists_for_scan(&specs_path)? {
                continue;
            }

            roots.push(SpecScanRoot::new(specs_path, relative_path));
        }
    }

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

fn possible_claude_worktree_collection_roots(
    directory: &Path,
    topology: &WorkspaceTopology,
) -> Vec<PathBuf> {
    let mut roots = vec![directory.to_path_buf()];
    let file_name = directory.file_name().and_then(|name| name.to_str());
    let collection_root = topology.claude_worktree_collection_root();
    let collection_segments = collection_root.segments().collect::<Vec<_>>();
    let [claude_directory_name, worktrees_directory_name] = collection_segments.as_slice() else {
        return roots;
    };

    if file_name == Some(claude_directory_name) {
        if let Some(parent) = directory.parent() {
            roots.push(parent.to_path_buf());
        }
    }

    if file_name == Some(worktrees_directory_name) {
        if let Some(claude_directory) = directory.parent() {
            if claude_directory.file_name().and_then(|name| name.to_str())
                == Some(claude_directory_name)
            {
                if let Some(parent) = claude_directory.parent() {
                    roots.push(parent.to_path_buf());
                }
            }
        }
    }

    roots
}

fn has_claude_worktree_specs(
    workspace_root: &Path,
    topology: &WorkspaceTopology,
) -> Result<bool, WorkspaceDetectionError> {
    let worktrees_root = workspace_root.join(topology.claude_worktree_collection_root().as_str());
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
        let file_type =
            entry
                .file_type()
                .map_err(|source| WorkspaceDetectionError::InspectPath {
                    path: display_path(&entry.path()),
                    source,
                })?;

        if !file_type.is_dir() {
            continue;
        }

        let worktree_name = entry.file_name().to_string_lossy().into_owned();

        for container in topology.claude_worktree_containers() {
            let relative_root = topology
                .claude_worktree_spec_root(&worktree_name, container)
                .map_err(|source| WorkspaceDetectionError::InvalidTopology { source })?;
            let specs_path = workspace_root.join(relative_root.as_str());

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

fn scan_child_directories<ConfigLoader>(
    directory: &Path,
    relative_directory: &WorkspaceRelativePath,
    layout: &WorkspaceLayout,
    config: &WorkspaceConfig,
    config_loader: &ConfigLoader,
) -> Result<Vec<SpecDirectoryFact>, SpecTreeScanError>
where
    ConfigLoader: LoadSpecConfigOverride,
{
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

        if !SpecTreeAssembler::includes_directory(config, &file_name) {
            continue;
        }

        let file_type = entry
            .file_type()
            .map_err(|source| SpecTreeScanError::InspectPath {
                path: display_path(&entry.path()),
                source,
            })?;

        if file_type.is_dir() {
            let relative_child = relative_directory.join(&file_name).map_err(|source| {
                SpecTreeScanError::InvalidObservation {
                    path: display_path(&entry.path()),
                    source,
                }
            })?;
            child_directories.push(scan_spec_directory(
                &entry.path(),
                &relative_child,
                layout,
                &file_name,
                config,
                config_loader,
            )?);
        }
    }

    Ok(child_directories)
}

fn scan_spec_directory<ConfigLoader>(
    directory: &Path,
    relative_directory: &WorkspaceRelativePath,
    layout: &WorkspaceLayout,
    label: &str,
    config: &WorkspaceConfig,
    config_loader: &ConfigLoader,
) -> Result<SpecDirectoryFact, SpecTreeScanError>
where
    ConfigLoader: LoadSpecConfigOverride,
{
    let effective_config =
        config_for_spec_directory(layout, relative_directory, config, config_loader)?;
    let files = scan_spec_files(directory, &effective_config)?;
    let children =
        scan_child_directories(directory, relative_directory, layout, config, config_loader)?;

    Ok(SpecDirectoryFact::new(label, files, children))
}

fn scan_spec_files(
    directory: &Path,
    config: &WorkspaceConfig,
) -> Result<Vec<SpecFileFact>, SpecTreeScanError> {
    config
        .files()
        .iter()
        .map(|mapping| {
            let file_path = directory.join(mapping.file_name());
            let resolved_file = resolve_spec_file_for_scan(mapping.key(), &file_path)?;

            Ok(SpecFileFact::new(
                mapping.key(),
                mapping.file_name(),
                resolved_file.status,
                resolved_file.format,
                mapping.source(),
            ))
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

fn config_for_spec_directory<ConfigLoader>(
    layout: &WorkspaceLayout,
    relative_directory: &WorkspaceRelativePath,
    config: &WorkspaceConfig,
    config_loader: &ConfigLoader,
) -> Result<WorkspaceConfig, SpecTreeScanError>
where
    ConfigLoader: LoadSpecConfigOverride,
{
    let Some(spec_override) = config_loader
        .load_spec_config_override_at(layout, relative_directory)
        .map_err(|source| SpecTreeScanError::ConfigOverrideLoad {
            path: relative_directory.as_str().to_string(),
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

#[derive(Debug, Error)]
pub enum SpecTreeScanError {
    #[error("failed to read spec directory: {path}")]
    ReadDirectory { path: String, source: io::Error },
    #[error("failed to inspect spec path: {path}")]
    InspectPath { path: String, source: io::Error },
    #[error("observed spec path is invalid: {path}")]
    InvalidObservation {
        path: String,
        source: WorkspaceDomainError,
    },
    #[error("failed to load spec config override for {path}")]
    ConfigOverrideLoad {
        path: String,
        source: WorkspaceConfigLoadPortError,
    },
}

#[derive(Debug, Error)]
pub enum SpecArchiveError {
    #[error("spec id cannot be archived because it is a source group root: {spec_id}")]
    SourceGroupRoot { spec_id: String },
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

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;
    use crate::domain::{
        spec::{SpecDocumentFormat, SpecFileKey, SpecFileStatus, SpecNode},
        workspace::{WorkspaceFileMapping, WorkspaceRoot},
    };

    const PLUGIN_WORKSPACE_SPECS_DIR: &str = ".plugin-workspace/.specs";
    const SPEC_SKILL_FEATURES_DIR: &str = ".spec-skill/features";

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
    fn spec_id(value: &str) -> SpecId {
        SpecId::new(value).expect("test spec id should be valid")
    }

    fn scan_tree(
        layout: &WorkspaceLayout,
        config: &WorkspaceConfig,
    ) -> Result<Vec<SpecNode>, SpecTreeScanError> {
        let facts =
            FilesystemSpecTreeScanner::new(WorkspaceConfigLoader::new()).scan(layout, config)?;
        let tree = SpecTreeAssembler::new(WorkspaceTopology::default())
            .assemble(layout.kind(), config, facts)
            .expect("filesystem observations should assemble");

        Ok(tree.into_roots())
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

        let tree = scan_tree(&layout, &config).expect("spec tree should be scanned");

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

        let tree = scan_tree(&layout, &config).expect("spec tree should be scanned");

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

        let tree = scan_tree(&layout, &config).expect("spec tree should be scanned");

        let auth = &tree[0].children()[0];
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

        let tree = scan_tree(&layout, &config).expect("spec tree should be scanned");

        let auth = &tree[0].children()[0];
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

        let tree = scan_tree(&layout, &config).expect("spec tree should be scanned");

        let test_cases = tree[0].children()[0]
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

        let tree = scan_tree(&layout, &config).expect("spec tree should be scanned");

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

        let tree = scan_tree(&layout, &config).expect("spec tree should be scanned");

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

        let tree = scan_tree(&layout, &config).expect("spec tree should be scanned");

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

        let tree = scan_tree(&layout, &config).expect("spec tree should be scanned");

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

        let archive_path =
            archive_spec_directory(&layout, &spec_id(".plugin-workspace/.specs/auth"))
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
            archive_spec_directory(&layout, &spec_id(".plugin-workspace/.specs/auth"))
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

        let result = archive_spec_directory(&layout, &spec_id(".plugin-workspace/.specs"));

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

        let tree = scan_tree(&layout, &config).expect("spec tree should be scanned");

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

        let tree = scan_tree(&layout, &config).expect("spec-driven-dev tree should be scanned");

        let root = &tree[0];
        assert_eq!(PLUGIN_WORKSPACE_SPECS_DIR, root.id().as_str());
        assert_eq!("ルート", root.label());
        let issue = &root.children()[0];
        assert_eq!(
            ".plugin-workspace/.specs/021-issue-262",
            issue.id().as_str()
        );
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

        let tree = scan_tree(&layout, &config).expect("worktree specs should be scanned");

        let worktree = &tree[0];
        assert_eq!(
            ".claude/worktrees/feature-auth/.plugin-worktree/.specs",
            worktree.id().as_str()
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
                (SpecFileKey::Requirements, SpecFileStatus::Missing),
                (SpecFileKey::TechReference, SpecFileStatus::Missing),
                (SpecFileKey::TestCases, SpecFileStatus::Missing),
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

        let tree = scan_tree(&layout, &config).expect("plugin workspace specs should be scanned");

        let worktree = &tree[0];
        assert_eq!(
            ".claude/worktrees/doccom-be/.plugin-workspace/.specs",
            worktree.id().as_str()
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
                (SpecFileKey::Requirements, SpecFileStatus::Missing),
                (SpecFileKey::TechReference, SpecFileStatus::Missing),
                (SpecFileKey::TestCases, SpecFileStatus::Missing),
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
            &spec_id(".claude/worktrees/feature-auth/.plugin-worktree/.specs/auth"),
        );

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
            &spec_id(".claude/worktrees/doccom-be/.plugin-workspace/.specs/019-be-doc-comments"),
        );

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

        let path = spec_directory_path(&layout, &spec_id(".plugin-workspace/.specs/auth"));

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

        let tree = scan_tree(&layout, &config).expect("spec tree should be scanned");

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

        let tree = scan_tree(&layout, &config).expect("spec tree should be scanned");

        let root = &tree[0];
        let auth = &root.children()[0];
        let checkout = &root.children()[1];

        assert_eq!(".plugin-workspace/.specs/auth", auth.id().as_str());
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

        let result = scan_tree(&layout, &config);

        assert!(matches!(
            result,
            Err(SpecTreeScanError::ConfigOverrideLoad { path, .. }) if path.ends_with("auth")
        ));
    }

    fn node_ids(nodes: &[SpecNode]) -> Vec<&str> {
        nodes.iter().map(|node| node.id().as_str()).collect()
    }

    fn file_statuses(node: &SpecNode) -> Vec<(SpecFileKey, SpecFileStatus)> {
        node.files()
            .iter()
            .map(|file| (file.key(), file.status()))
            .collect()
    }
}
