//! Use cases that coordinate domain logic and infrastructure.

pub mod comments;
pub mod repository_diff;
pub mod spec_diff;

use std::path::Path;

use thiserror::Error;

use crate::{
    app::services::{
        file_watching::{plan_file_watch, FileWatchPlan},
        markdown_cache::MarkdownDocumentCache,
    },
    domain::{
        comment::{CommentDomainError, CommentRepositoryError},
        spec::{MarkdownBlock, SpecDocumentFormat, SpecDomainError},
        spec::{SpecFileKey, SpecNode},
        workspace::{WorkspaceConfig, WorkspaceLayout},
    },
    infrastructure::{
        filesystem::{
            archive_spec_directory, spec_directory_path, FilesystemSpecTreeScanner,
            FilesystemWorkspaceDetector, SafeSpecPathError, SpecArchiveError, SpecTreeScanError,
            WorkspaceDetectionError,
        },
        markdown::{
            FilesystemMarkdownReader, MarkdownDocument, MarkdownReadError, MarkdownReadResult,
            MissingMarkdownFile,
        },
        persistence::config::{ConfigLoadError, WorkspaceConfigLoader},
    },
};

pub use crate::domain::comment::{AnchorResolutionReason, AnchorResolutionStatus};
pub use comments::{
    CommentAnchorResolution, CommentAnchorResolutionTarget, CommentUseCases,
    FilesystemCommentUseCases, GenerateCommentId, GetCurrentTime, ResolveCommentAnchorsResult,
    UtcCommentClock, UuidCommentIdGenerator,
};
pub type FilesystemAppUseCases = AppUseCases<
    FilesystemWorkspaceDetector,
    WorkspaceConfigLoader,
    FilesystemSpecTreeScanner,
    FilesystemMarkdownReader,
>;

#[derive(Debug, Clone)]
pub struct AppUseCases<Detector, ConfigLoader, SpecTreeScanner, MarkdownReader> {
    workspace_detector: Detector,
    config_loader: ConfigLoader,
    spec_tree_scanner: SpecTreeScanner,
    markdown_reader: MarkdownReader,
    markdown_cache: MarkdownDocumentCache,
}

impl<Detector, ConfigLoader, SpecTreeScanner, MarkdownReader>
    AppUseCases<Detector, ConfigLoader, SpecTreeScanner, MarkdownReader>
{
    pub fn new(
        workspace_detector: Detector,
        config_loader: ConfigLoader,
        spec_tree_scanner: SpecTreeScanner,
        markdown_reader: MarkdownReader,
    ) -> Self {
        Self {
            workspace_detector,
            config_loader,
            spec_tree_scanner,
            markdown_reader,
            markdown_cache: MarkdownDocumentCache::new(),
        }
    }
}

impl Default for FilesystemAppUseCases {
    fn default() -> Self {
        Self::new(
            FilesystemWorkspaceDetector::new(),
            WorkspaceConfigLoader::new(),
            FilesystemSpecTreeScanner::new(),
            FilesystemMarkdownReader::new(),
        )
    }
}

impl FilesystemAppUseCases {
    pub fn comment_use_cases(&self, workspace: &LoadWorkspaceResult) -> FilesystemCommentUseCases {
        FilesystemCommentUseCases::for_workspace(workspace)
    }

    pub fn markdown_cache(&self) -> &MarkdownDocumentCache {
        &self.markdown_cache
    }

    pub fn plan_file_watch(
        &self,
        workspace: &LoadWorkspaceResult,
        spec_id: &str,
        key: SpecFileKey,
    ) -> Result<FileWatchPlan, AppUseCaseError> {
        let effective_config = spec_config_for_directory(
            &self.config_loader,
            workspace.layout(),
            workspace.config(),
            spec_id,
        )?;

        plan_file_watch(workspace, &effective_config, spec_id, key)
    }

    pub fn archive_spec(
        &self,
        workspace: &LoadWorkspaceResult,
        spec_id: &str,
    ) -> Result<ArchiveSpecResult, AppUseCaseError> {
        let destination = archive_spec_directory(workspace.layout(), workspace.config(), spec_id)?;

        Ok(ArchiveSpecResult::new(
            spec_id,
            destination.path().to_string_lossy().into_owned(),
            destination.source_group_id(),
            destination.destination_node_id(),
        ))
    }

    pub fn read_spec_file_cached(
        &self,
        workspace: &LoadWorkspaceResult,
        spec_id: &str,
        key: SpecFileKey,
    ) -> Result<ReadSpecFileResult, AppUseCaseError> {
        let effective_config = spec_config_for_directory(
            &self.config_loader,
            workspace.layout(),
            workspace.config(),
            spec_id,
        )?;

        self.markdown_cache
            .read_spec_file(
                &self.markdown_reader,
                workspace.layout(),
                &effective_config,
                spec_id,
                key,
            )
            .map(ReadSpecFileResult::from)
            .map_err(AppUseCaseError::from)
    }

    pub fn read_spec_blocks_cached(
        &self,
        workspace: &LoadWorkspaceResult,
        spec_id: &str,
        key: SpecFileKey,
    ) -> Result<Vec<MarkdownBlock>, AppUseCaseError> {
        match self.read_spec_file_cached(workspace, spec_id, key)? {
            ReadSpecFileResult::Found(document) => Ok(document.blocks().to_vec()),
            ReadSpecFileResult::Missing(_) => Ok(Vec::new()),
        }
    }
}

impl<Detector, ConfigLoader, SpecTreeScanner, MarkdownReader>
    AppUseCases<Detector, ConfigLoader, SpecTreeScanner, MarkdownReader>
where
    Detector: DetectWorkspace,
    ConfigLoader: LoadWorkspaceConfig,
    SpecTreeScanner: ScanSpecTree,
    MarkdownReader: ReadSpecFile,
{
    pub fn load_workspace(
        &self,
        selected_directory: impl AsRef<str>,
    ) -> Result<LoadWorkspaceResult, AppUseCaseError> {
        let layout = self
            .workspace_detector
            .detect_workspace(selected_directory.as_ref())?;
        let config = self.config_loader.load_workspace_config(&layout)?;

        Ok(LoadWorkspaceResult::new(layout, config))
    }

    pub fn list_specs(
        &self,
        workspace: &LoadWorkspaceResult,
    ) -> Result<ListSpecsResult, AppUseCaseError> {
        let specs = self
            .spec_tree_scanner
            .scan_spec_tree(workspace.layout(), workspace.config())?;

        Ok(ListSpecsResult::new(specs))
    }

    pub fn read_spec_file(
        &self,
        workspace: &LoadWorkspaceResult,
        spec_id: &str,
        key: SpecFileKey,
    ) -> Result<ReadSpecFileResult, AppUseCaseError> {
        let effective_config = spec_config_for_directory(
            &self.config_loader,
            workspace.layout(),
            workspace.config(),
            spec_id,
        )?;

        self.markdown_reader
            .read_spec_file(workspace.layout(), &effective_config, spec_id, key)
    }
}

pub trait DetectWorkspace {
    fn detect_workspace(
        &self,
        selected_directory: &str,
    ) -> Result<WorkspaceLayout, AppUseCaseError>;
}

impl DetectWorkspace for FilesystemWorkspaceDetector {
    fn detect_workspace(
        &self,
        selected_directory: &str,
    ) -> Result<WorkspaceLayout, AppUseCaseError> {
        self.detect(selected_directory)
            .map_err(AppUseCaseError::from)
    }
}

pub trait LoadWorkspaceConfig {
    fn load_workspace_config(
        &self,
        layout: &WorkspaceLayout,
    ) -> Result<WorkspaceConfig, AppUseCaseError>;

    fn load_spec_config_override(
        &self,
        spec_directory: &Path,
    ) -> Result<Option<crate::domain::workspace::SpecConfigOverride>, AppUseCaseError>;
}

impl LoadWorkspaceConfig for WorkspaceConfigLoader {
    fn load_workspace_config(
        &self,
        layout: &WorkspaceLayout,
    ) -> Result<WorkspaceConfig, AppUseCaseError> {
        self.load(layout).map_err(AppUseCaseError::from)
    }

    fn load_spec_config_override(
        &self,
        spec_directory: &Path,
    ) -> Result<Option<crate::domain::workspace::SpecConfigOverride>, AppUseCaseError> {
        self.load_spec_override_from_directory(spec_directory)
            .map_err(AppUseCaseError::from)
    }
}

fn spec_config_for_directory<ConfigLoader>(
    config_loader: &ConfigLoader,
    layout: &WorkspaceLayout,
    workspace_config: &WorkspaceConfig,
    spec_id: &str,
) -> Result<WorkspaceConfig, AppUseCaseError>
where
    ConfigLoader: LoadWorkspaceConfig,
{
    let spec_directory = spec_directory_path(layout, spec_id)?;
    let Some(spec_override) = config_loader.load_spec_config_override(&spec_directory)? else {
        return Ok(workspace_config.clone());
    };

    Ok(workspace_config.merge_spec_override(&spec_override))
}

pub trait ScanSpecTree {
    fn scan_spec_tree(
        &self,
        layout: &WorkspaceLayout,
        config: &WorkspaceConfig,
    ) -> Result<Vec<SpecNode>, AppUseCaseError>;
}

impl ScanSpecTree for FilesystemSpecTreeScanner {
    fn scan_spec_tree(
        &self,
        layout: &WorkspaceLayout,
        config: &WorkspaceConfig,
    ) -> Result<Vec<SpecNode>, AppUseCaseError> {
        self.scan(layout, config).map_err(AppUseCaseError::from)
    }
}

pub trait ReadSpecFile {
    fn read_spec_file(
        &self,
        layout: &WorkspaceLayout,
        config: &WorkspaceConfig,
        spec_id: &str,
        key: SpecFileKey,
    ) -> Result<ReadSpecFileResult, AppUseCaseError>;
}

impl ReadSpecFile for FilesystemMarkdownReader {
    fn read_spec_file(
        &self,
        layout: &WorkspaceLayout,
        config: &WorkspaceConfig,
        spec_id: &str,
        key: SpecFileKey,
    ) -> Result<ReadSpecFileResult, AppUseCaseError> {
        self.read(layout, config, spec_id, key)
            .map(ReadSpecFileResult::from)
            .map_err(AppUseCaseError::from)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LoadWorkspaceResult {
    layout: WorkspaceLayout,
    config: WorkspaceConfig,
}

impl LoadWorkspaceResult {
    pub fn new(layout: WorkspaceLayout, config: WorkspaceConfig) -> Self {
        Self { layout, config }
    }

    pub fn layout(&self) -> &WorkspaceLayout {
        &self.layout
    }

    pub fn config(&self) -> &WorkspaceConfig {
        &self.config
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListSpecsResult {
    specs: Vec<SpecNode>,
}

impl ListSpecsResult {
    pub fn new(specs: Vec<SpecNode>) -> Self {
        Self { specs }
    }

    pub fn specs(&self) -> &[SpecNode] {
        &self.specs
    }

    pub fn into_specs(self) -> Vec<SpecNode> {
        self.specs
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveSpecResult {
    archived_spec_id: String,
    archive_path: String,
    source_group_id: String,
    destination_node_id: String,
}

impl ArchiveSpecResult {
    pub fn new(
        archived_spec_id: impl Into<String>,
        archive_path: impl Into<String>,
        source_group_id: impl Into<String>,
        destination_node_id: impl Into<String>,
    ) -> Self {
        Self {
            archived_spec_id: archived_spec_id.into(),
            archive_path: archive_path.into(),
            source_group_id: source_group_id.into(),
            destination_node_id: destination_node_id.into(),
        }
    }

    pub fn archived_spec_id(&self) -> &str {
        &self.archived_spec_id
    }

    pub fn archive_path(&self) -> &str {
        &self.archive_path
    }

    pub fn source_group_id(&self) -> &str {
        &self.source_group_id
    }

    pub fn destination_node_id(&self) -> &str {
        &self.destination_node_id
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReadSpecFileResult {
    Found(AppMarkdownDocument),
    Missing(AppMissingMarkdownFile),
}

impl ReadSpecFileResult {
    pub fn is_missing(&self) -> bool {
        matches!(self, Self::Missing(_))
    }
}

impl From<MarkdownReadResult> for ReadSpecFileResult {
    fn from(result: MarkdownReadResult) -> Self {
        match result {
            MarkdownReadResult::Found(document) => Self::Found(document.into()),
            MarkdownReadResult::Missing(missing) => Self::Missing(missing.into()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppMarkdownDocument {
    key: SpecFileKey,
    format: SpecDocumentFormat,
    path: String,
    contents: String,
    blocks: Vec<MarkdownBlock>,
}

impl AppMarkdownDocument {
    pub fn new(key: SpecFileKey, path: impl Into<String>, contents: impl Into<String>) -> Self {
        Self::with_format_and_blocks(
            key,
            SpecDocumentFormat::Markdown,
            path,
            contents,
            Vec::new(),
        )
    }

    pub fn with_blocks(
        key: SpecFileKey,
        path: impl Into<String>,
        contents: impl Into<String>,
        blocks: Vec<MarkdownBlock>,
    ) -> Self {
        Self::with_format_and_blocks(key, SpecDocumentFormat::Markdown, path, contents, blocks)
    }

    pub fn with_format_and_blocks(
        key: SpecFileKey,
        format: SpecDocumentFormat,
        path: impl Into<String>,
        contents: impl Into<String>,
        blocks: Vec<MarkdownBlock>,
    ) -> Self {
        Self {
            key,
            format,
            path: path.into(),
            contents: contents.into(),
            blocks,
        }
    }

    pub fn key(&self) -> SpecFileKey {
        self.key
    }

    pub fn format(&self) -> SpecDocumentFormat {
        self.format
    }

    pub fn path(&self) -> &str {
        &self.path
    }

    pub fn contents(&self) -> &str {
        &self.contents
    }

    pub fn blocks(&self) -> &[MarkdownBlock] {
        &self.blocks
    }
}

impl From<MarkdownDocument> for AppMarkdownDocument {
    fn from(document: MarkdownDocument) -> Self {
        Self::with_format_and_blocks(
            document.key(),
            document.format(),
            document.path().to_string(),
            document.contents().to_string(),
            document.blocks().to_vec(),
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppMissingMarkdownFile {
    key: SpecFileKey,
    format: SpecDocumentFormat,
    path: String,
}

impl AppMissingMarkdownFile {
    pub fn new(key: SpecFileKey, path: impl Into<String>) -> Self {
        Self::with_format(key, SpecDocumentFormat::Markdown, path)
    }

    pub fn with_format(
        key: SpecFileKey,
        format: SpecDocumentFormat,
        path: impl Into<String>,
    ) -> Self {
        Self {
            key,
            format,
            path: path.into(),
        }
    }

    pub fn key(&self) -> SpecFileKey {
        self.key
    }

    pub fn format(&self) -> SpecDocumentFormat {
        self.format
    }

    pub fn path(&self) -> &str {
        &self.path
    }
}

impl From<MissingMarkdownFile> for AppMissingMarkdownFile {
    fn from(missing: MissingMarkdownFile) -> Self {
        Self::with_format(missing.key(), missing.format(), missing.path().to_string())
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum AppUseCaseError {
    #[error("failed to detect workspace: {message}")]
    WorkspaceDetection { message: String },
    #[error("failed to load workspace config: {message}")]
    ConfigLoad { message: String },
    #[error("failed to scan spec tree: {message}")]
    SpecTreeScan { message: String },
    #[error("failed to archive spec: {message}")]
    SpecArchive { message: String },
    #[error("failed to read spec file: {message}")]
    MarkdownRead { message: String },
    #[error("invalid spec input: {message}")]
    InvalidSpec { message: String },
    #[error("invalid comment input: {message}")]
    InvalidComment { message: String },
    #[error("failed to persist comments: {message}")]
    CommentRepository { message: String },
}

impl From<WorkspaceDetectionError> for AppUseCaseError {
    fn from(source: WorkspaceDetectionError) -> Self {
        Self::WorkspaceDetection {
            message: source.to_string(),
        }
    }
}

impl From<ConfigLoadError> for AppUseCaseError {
    fn from(source: ConfigLoadError) -> Self {
        Self::ConfigLoad {
            message: source.to_string(),
        }
    }
}

impl From<SpecTreeScanError> for AppUseCaseError {
    fn from(source: SpecTreeScanError) -> Self {
        if matches!(source, SpecTreeScanError::ConfigOverrideLoad { .. }) {
            return Self::ConfigLoad {
                message: source.to_string(),
            };
        }

        Self::SpecTreeScan {
            message: source.to_string(),
        }
    }
}

impl From<SafeSpecPathError> for AppUseCaseError {
    fn from(source: SafeSpecPathError) -> Self {
        Self::InvalidSpec {
            message: source.to_string(),
        }
    }
}

impl From<SpecArchiveError> for AppUseCaseError {
    fn from(source: SpecArchiveError) -> Self {
        Self::SpecArchive {
            message: source.to_string(),
        }
    }
}

impl From<MarkdownReadError> for AppUseCaseError {
    fn from(source: MarkdownReadError) -> Self {
        Self::MarkdownRead {
            message: source.to_string(),
        }
    }
}

impl From<SpecDomainError> for AppUseCaseError {
    fn from(source: SpecDomainError) -> Self {
        Self::InvalidSpec {
            message: source.to_string(),
        }
    }
}

impl From<CommentDomainError> for AppUseCaseError {
    fn from(source: CommentDomainError) -> Self {
        Self::InvalidComment {
            message: source.to_string(),
        }
    }
}

impl From<CommentRepositoryError> for AppUseCaseError {
    fn from(source: CommentRepositoryError) -> Self {
        Self::CommentRepository {
            message: source.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        cell::{Cell, RefCell},
        rc::Rc,
    };

    use super::*;
    use crate::domain::{
        spec::{SpecFile, SpecFileStatus},
        workspace::{
            SpecConfigOverride, WorkspaceConfig, WorkspaceConfigSource, WorkspaceFileMapping,
            WorkspaceKind, WorkspaceLayout, WorkspaceRoot,
        },
    };

    #[derive(Debug, Clone)]
    struct FakeWorkspaceDetector {
        result: Result<WorkspaceLayout, AppUseCaseError>,
    }

    impl DetectWorkspace for FakeWorkspaceDetector {
        fn detect_workspace(
            &self,
            _selected_directory: &str,
        ) -> Result<WorkspaceLayout, AppUseCaseError> {
            self.result.clone()
        }
    }

    #[derive(Debug, Clone)]
    struct FakeConfigLoader {
        result: Result<WorkspaceConfig, AppUseCaseError>,
    }

    impl LoadWorkspaceConfig for FakeConfigLoader {
        fn load_workspace_config(
            &self,
            _layout: &WorkspaceLayout,
        ) -> Result<WorkspaceConfig, AppUseCaseError> {
            self.result.clone()
        }

        fn load_spec_config_override(
            &self,
            _spec_directory: &Path,
        ) -> Result<Option<crate::domain::workspace::SpecConfigOverride>, AppUseCaseError> {
            Ok(None)
        }
    }

    #[derive(Debug, Clone)]
    struct FakeSpecTreeScanner {
        result: Result<Vec<SpecNode>, AppUseCaseError>,
    }

    impl ScanSpecTree for FakeSpecTreeScanner {
        fn scan_spec_tree(
            &self,
            _layout: &WorkspaceLayout,
            _config: &WorkspaceConfig,
        ) -> Result<Vec<SpecNode>, AppUseCaseError> {
            self.result.clone()
        }
    }

    #[derive(Debug, Clone)]
    struct FakeMarkdownReader {
        result: Result<ReadSpecFileResult, AppUseCaseError>,
    }

    impl ReadSpecFile for FakeMarkdownReader {
        fn read_spec_file(
            &self,
            _layout: &WorkspaceLayout,
            _config: &WorkspaceConfig,
            _spec_id: &str,
            _key: SpecFileKey,
        ) -> Result<ReadSpecFileResult, AppUseCaseError> {
            self.result.clone()
        }
    }

    #[derive(Debug, Clone, Default)]
    struct PanicSpecTreeScanner;

    impl ScanSpecTree for PanicSpecTreeScanner {
        fn scan_spec_tree(
            &self,
            _layout: &WorkspaceLayout,
            _config: &WorkspaceConfig,
        ) -> Result<Vec<SpecNode>, AppUseCaseError> {
            panic!("spec tree scanner should not be called")
        }
    }

    #[derive(Debug, Clone, Default)]
    struct PanicMarkdownReader;

    impl ReadSpecFile for PanicMarkdownReader {
        fn read_spec_file(
            &self,
            _layout: &WorkspaceLayout,
            _config: &WorkspaceConfig,
            _spec_id: &str,
            _key: SpecFileKey,
        ) -> Result<ReadSpecFileResult, AppUseCaseError> {
            panic!("markdown reader should not be called")
        }
    }

    #[test]
    fn load_workspace_detects_layout_and_loads_config() {
        let layout = workspace_layout(WorkspaceKind::PluginWorkspace);
        let config = config_with_mapping(SpecFileKey::Tasks, "todo.md");
        let use_cases = app_use_cases(
            FakeWorkspaceDetector {
                result: Ok(layout.clone()),
            },
            FakeConfigLoader {
                result: Ok(config.clone()),
            },
            PanicSpecTreeScanner,
            PanicMarkdownReader,
        );

        let result = use_cases
            .load_workspace("/workspace/project")
            .expect("workspace should load");

        assert_eq!(&layout, result.layout());
        assert_eq!(&config, result.config());
    }

    #[test]
    fn load_workspace_does_not_load_config_when_detection_fails() {
        #[derive(Debug, Clone)]
        struct CountingConfigLoader {
            call_count: Rc<Cell<u32>>,
        }

        impl LoadWorkspaceConfig for CountingConfigLoader {
            fn load_workspace_config(
                &self,
                _layout: &WorkspaceLayout,
            ) -> Result<WorkspaceConfig, AppUseCaseError> {
                self.call_count.set(self.call_count.get() + 1);
                Ok(WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace))
            }

            fn load_spec_config_override(
                &self,
                _spec_directory: &Path,
            ) -> Result<Option<crate::domain::workspace::SpecConfigOverride>, AppUseCaseError>
            {
                Ok(None)
            }
        }

        let config_loader = CountingConfigLoader {
            call_count: Rc::new(Cell::new(0)),
        };
        let call_count = Rc::clone(&config_loader.call_count);
        let use_cases = app_use_cases(
            FakeWorkspaceDetector {
                result: Err(AppUseCaseError::WorkspaceDetection {
                    message: "unsupported workspace".to_string(),
                }),
            },
            config_loader.clone(),
            PanicSpecTreeScanner,
            PanicMarkdownReader,
        );

        let result = use_cases.load_workspace("/workspace/project");

        assert_eq!(
            Err(AppUseCaseError::WorkspaceDetection {
                message: "unsupported workspace".to_string()
            }),
            result
        );
        assert_eq!(0, call_count.get());
    }

    #[test]
    fn list_specs_scans_with_loaded_workspace() {
        let workspace = LoadWorkspaceResult::new(
            workspace_layout(WorkspaceKind::PluginWorkspace),
            config_with_mapping(SpecFileKey::Tasks, "tasks.md"),
        );
        let spec = SpecNode::leaf(
            "auth",
            "auth",
            vec![
                SpecFile::new(SpecFileKey::Tasks, "tasks.md", SpecFileStatus::Present)
                    .expect("spec file should be valid"),
            ],
        )
        .expect("spec node should be valid");
        let use_cases = app_use_cases(
            FakeWorkspaceDetector {
                result: Ok(workspace.layout().clone()),
            },
            FakeConfigLoader {
                result: Ok(workspace.config().clone()),
            },
            FakeSpecTreeScanner {
                result: Ok(vec![spec.clone()]),
            },
            PanicMarkdownReader,
        );

        let result = use_cases
            .list_specs(&workspace)
            .expect("specs should be listed");

        assert_eq!(&[spec], result.specs());
    }

    #[test]
    fn read_spec_file_returns_found_markdown_document() {
        let workspace = LoadWorkspaceResult::new(
            workspace_layout(WorkspaceKind::PluginWorkspace),
            config_with_mapping(SpecFileKey::Tasks, "tasks.md"),
        );
        let document =
            AppMarkdownDocument::new(SpecFileKey::Tasks, "/workspace/auth/tasks.md", "# Tasks");
        let use_cases = app_use_cases(
            FakeWorkspaceDetector {
                result: Ok(workspace.layout().clone()),
            },
            FakeConfigLoader {
                result: Ok(workspace.config().clone()),
            },
            PanicSpecTreeScanner,
            FakeMarkdownReader {
                result: Ok(ReadSpecFileResult::Found(document.clone())),
            },
        );

        let result = use_cases
            .read_spec_file(&workspace, "auth", SpecFileKey::Tasks)
            .expect("spec file should be read");

        assert_eq!(ReadSpecFileResult::Found(document), result);
    }

    #[test]
    fn read_spec_file_applies_spec_config_override_before_reading() {
        #[derive(Debug, Clone)]
        struct OverrideConfigLoader {
            workspace_config: WorkspaceConfig,
            spec_override: SpecConfigOverride,
        }

        impl LoadWorkspaceConfig for OverrideConfigLoader {
            fn load_workspace_config(
                &self,
                _layout: &WorkspaceLayout,
            ) -> Result<WorkspaceConfig, AppUseCaseError> {
                Ok(self.workspace_config.clone())
            }

            fn load_spec_config_override(
                &self,
                _spec_directory: &Path,
            ) -> Result<Option<SpecConfigOverride>, AppUseCaseError> {
                Ok(Some(self.spec_override.clone()))
            }
        }

        #[derive(Debug, Clone)]
        struct CapturingMarkdownReader {
            observed_file_name: Rc<RefCell<Option<String>>>,
        }

        impl ReadSpecFile for CapturingMarkdownReader {
            fn read_spec_file(
                &self,
                _layout: &WorkspaceLayout,
                config: &WorkspaceConfig,
                _spec_id: &str,
                key: SpecFileKey,
            ) -> Result<ReadSpecFileResult, AppUseCaseError> {
                let file_name = config
                    .file_for_key(key)
                    .map(|mapping| mapping.file_name().to_string());

                self.observed_file_name.replace(file_name);

                Ok(ReadSpecFileResult::Missing(AppMissingMarkdownFile::new(
                    key,
                    "/workspace/project/auth/local-tasks.md",
                )))
            }
        }

        let observed_file_name = Rc::new(RefCell::new(None));
        let workspace_config = config_with_mapping(SpecFileKey::Tasks, "workspace-tasks.md");
        let spec_override = SpecConfigOverride::new(vec![WorkspaceFileMapping::with_source(
            SpecFileKey::Tasks,
            "local-tasks.md",
            WorkspaceConfigSource::SpecOverride,
        )
        .expect("mapping should be valid")])
        .expect("override should be valid");
        let workspace = LoadWorkspaceResult::new(
            workspace_layout(WorkspaceKind::PluginWorkspace),
            workspace_config.clone(),
        );
        let use_cases = app_use_cases(
            FakeWorkspaceDetector {
                result: Ok(workspace.layout().clone()),
            },
            OverrideConfigLoader {
                workspace_config,
                spec_override,
            },
            PanicSpecTreeScanner,
            CapturingMarkdownReader {
                observed_file_name: Rc::clone(&observed_file_name),
            },
        );

        use_cases
            .read_spec_file(&workspace, "auth", SpecFileKey::Tasks)
            .expect("spec file read should resolve override");

        assert_eq!(
            Some("local-tasks.md".to_string()),
            observed_file_name.borrow().clone()
        );
    }

    #[test]
    fn read_spec_file_returns_missing_markdown_file() {
        let workspace = LoadWorkspaceResult::new(
            workspace_layout(WorkspaceKind::PluginWorkspace),
            config_with_mapping(SpecFileKey::Tasks, "tasks.md"),
        );
        let missing = AppMissingMarkdownFile::new(SpecFileKey::Tasks, "/workspace/auth/tasks.md");
        let use_cases = app_use_cases(
            FakeWorkspaceDetector {
                result: Ok(workspace.layout().clone()),
            },
            FakeConfigLoader {
                result: Ok(workspace.config().clone()),
            },
            PanicSpecTreeScanner,
            FakeMarkdownReader {
                result: Ok(ReadSpecFileResult::Missing(missing.clone())),
            },
        );

        let result = use_cases
            .read_spec_file(&workspace, "auth", SpecFileKey::Tasks)
            .expect("missing file should be a result");

        assert_eq!(ReadSpecFileResult::Missing(missing), result);
        assert!(result.is_missing());
    }

    #[test]
    fn infrastructure_errors_map_to_app_level_errors() {
        let error = AppUseCaseError::from(WorkspaceDetectionError::UnsupportedWorkspace {
            root: "/workspace/project".to_string(),
        });

        assert_eq!(
            AppUseCaseError::WorkspaceDetection {
                message: "unsupported workspace layout at: /workspace/project".to_string()
            },
            error
        );
    }

    #[test]
    fn spec_config_override_scan_errors_map_to_config_load_errors() {
        let source = SpecTreeScanError::ConfigOverrideLoad {
            path: "/workspace/project/.plugin-workspace/.specs/auth".to_string(),
            source: ConfigLoadError::InvalidFileMapping {
                path: "/workspace/project/.plugin-workspace/.specs/auth/.spec-reviewer/config.json"
                    .to_string(),
                source: crate::domain::workspace::WorkspaceConfigError::UnsafeFileName {
                    key: SpecFileKey::Tasks,
                    file_name: "../tasks.md".to_string(),
                },
            },
        };

        let error = AppUseCaseError::from(source);

        assert!(matches!(error, AppUseCaseError::ConfigLoad { .. }));
    }

    fn app_use_cases<Detector, ConfigLoader, SpecTreeScanner, MarkdownReader>(
        detector: Detector,
        config_loader: ConfigLoader,
        spec_tree_scanner: SpecTreeScanner,
        markdown_reader: MarkdownReader,
    ) -> AppUseCases<Detector, ConfigLoader, SpecTreeScanner, MarkdownReader> {
        AppUseCases::new(detector, config_loader, spec_tree_scanner, markdown_reader)
    }

    fn workspace_layout(kind: WorkspaceKind) -> WorkspaceLayout {
        let root = WorkspaceRoot::new("/workspace/project").expect("root should be valid");

        WorkspaceLayout::new(root, kind)
    }

    fn config_with_mapping(key: SpecFileKey, file_name: &str) -> WorkspaceConfig {
        WorkspaceConfig::new(vec![
            WorkspaceFileMapping::new(key, file_name).expect("mapping should be valid")
        ])
        .expect("config should be valid")
    }
}
