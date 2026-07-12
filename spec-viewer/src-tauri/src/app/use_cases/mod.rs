//! Use cases that coordinate domain logic and infrastructure.

pub mod comments;
pub mod review_runs;

use thiserror::Error;

use crate::{
    app::services::{
        file_watching::{plan_file_watch, FileWatchPlan},
        markdown_cache::MarkdownDocumentCache,
    },
    domain::{
        comment::{CommentDomainError, CommentRepositoryError},
        spec::{
            MarkdownBlock, ReadSpecFile, ScanSpecTree, SpecDomainError, SpecFileKey,
            SpecFileReadPortError, SpecId, SpecNode, SpecTreeScanPortError,
        },
        workspace::{
            DetectWorkspace, LoadWorkspaceConfig, WorkspaceConfig, WorkspaceConfigLoadPortError,
            WorkspaceDetectionPortError, WorkspaceLayout,
        },
    },
    infrastructure::{
        filesystem::{
            archive_spec_directory, FilesystemSpecTreeScanner, FilesystemWorkspaceDetector,
            SpecArchiveError,
        },
        markdown::{FilesystemMarkdownReader, MarkdownReadError},
        persistence::config::WorkspaceConfigLoader,
    },
};

pub use crate::domain::comment::{AnchorResolutionReason, AnchorResolutionStatus};
pub use crate::domain::spec::{
    MissingSpecDocument as AppMissingMarkdownFile, ReadSpecFileResult,
    SpecDocument as AppMarkdownDocument,
};
pub use comments::{
    CommentAnchorResolution, CommentAnchorResolutionTarget, CommentUseCases,
    FilesystemCommentUseCases, GenerateCommentId, GetCurrentTime, ResolveCommentAnchorsResult,
    UtcCommentClock, UuidCommentIdGenerator,
};
pub use review_runs::{
    ArchiveReviewRunInput, ArchiveReviewRunResult, CreateReviewRunInput, CreateReviewRunResult,
    ListReviewRunsInput, ListReviewRunsResult, ListedReviewRun, ReviewRunExecutionMode,
    ReviewRunListProblem, ReviewRunListProblemState,
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
        spec_id: &SpecId,
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
        spec_id: &SpecId,
    ) -> Result<ArchiveSpecResult, AppUseCaseError> {
        let archive_path = archive_spec_directory(workspace.layout(), spec_id)?;

        Ok(ArchiveSpecResult::new(
            spec_id.as_str(),
            archive_path.to_string_lossy().into_owned(),
        ))
    }

    pub fn read_spec_file_cached(
        &self,
        workspace: &LoadWorkspaceResult,
        spec_id: &SpecId,
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
        spec_id: &SpecId,
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
        spec_id: &SpecId,
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
            .map_err(AppUseCaseError::from)
    }
}

fn spec_config_for_directory<ConfigLoader>(
    config_loader: &ConfigLoader,
    layout: &WorkspaceLayout,
    workspace_config: &WorkspaceConfig,
    spec_id: &SpecId,
) -> Result<WorkspaceConfig, AppUseCaseError>
where
    ConfigLoader: LoadWorkspaceConfig,
{
    let Some(spec_override) = config_loader.load_spec_config_override(layout, spec_id)? else {
        return Ok(workspace_config.clone());
    };

    Ok(workspace_config.merge_spec_override(&spec_override))
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
}

impl ArchiveSpecResult {
    pub fn new(archived_spec_id: impl Into<String>, archive_path: impl Into<String>) -> Self {
        Self {
            archived_spec_id: archived_spec_id.into(),
            archive_path: archive_path.into(),
        }
    }

    pub fn archived_spec_id(&self) -> &str {
        &self.archived_spec_id
    }

    pub fn archive_path(&self) -> &str {
        &self.archive_path
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
    #[error("failed to export review run: {message}")]
    ReviewRunExport { message: String },
}

impl From<WorkspaceDetectionPortError> for AppUseCaseError {
    fn from(source: WorkspaceDetectionPortError) -> Self {
        Self::WorkspaceDetection {
            message: source.to_string(),
        }
    }
}

impl From<WorkspaceConfigLoadPortError> for AppUseCaseError {
    fn from(source: WorkspaceConfigLoadPortError) -> Self {
        Self::ConfigLoad {
            message: source.to_string(),
        }
    }
}

impl From<SpecTreeScanPortError> for AppUseCaseError {
    fn from(source: SpecTreeScanPortError) -> Self {
        match source {
            SpecTreeScanPortError::ConfigLoad { message } => Self::ConfigLoad { message },
            SpecTreeScanPortError::Scan { message } => Self::SpecTreeScan { message },
        }
    }
}

impl From<SpecFileReadPortError> for AppUseCaseError {
    fn from(source: SpecFileReadPortError) -> Self {
        Self::MarkdownRead {
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
        result: Result<WorkspaceLayout, WorkspaceDetectionPortError>,
    }

    impl DetectWorkspace for FakeWorkspaceDetector {
        fn detect_workspace(
            &self,
            _selected_directory: &str,
        ) -> Result<WorkspaceLayout, WorkspaceDetectionPortError> {
            self.result.clone()
        }
    }

    #[derive(Debug, Clone)]
    struct FakeConfigLoader {
        result: Result<WorkspaceConfig, WorkspaceConfigLoadPortError>,
    }

    impl LoadWorkspaceConfig for FakeConfigLoader {
        fn load_workspace_config(
            &self,
            _layout: &WorkspaceLayout,
        ) -> Result<WorkspaceConfig, WorkspaceConfigLoadPortError> {
            self.result.clone()
        }

        fn load_spec_config_override(
            &self,
            _layout: &WorkspaceLayout,
            _spec_id: &SpecId,
        ) -> Result<Option<SpecConfigOverride>, WorkspaceConfigLoadPortError> {
            Ok(None)
        }
    }

    #[derive(Debug, Clone)]
    struct FakeSpecTreeScanner {
        result: Result<Vec<SpecNode>, SpecTreeScanPortError>,
    }

    impl ScanSpecTree for FakeSpecTreeScanner {
        fn scan_spec_tree(
            &self,
            _layout: &WorkspaceLayout,
            _config: &WorkspaceConfig,
        ) -> Result<Vec<SpecNode>, SpecTreeScanPortError> {
            self.result.clone()
        }
    }

    #[derive(Debug, Clone)]
    struct FakeMarkdownReader {
        result: Result<ReadSpecFileResult, SpecFileReadPortError>,
    }

    impl ReadSpecFile for FakeMarkdownReader {
        fn read_spec_file(
            &self,
            _layout: &WorkspaceLayout,
            _config: &WorkspaceConfig,
            _spec_id: &SpecId,
            _key: SpecFileKey,
        ) -> Result<ReadSpecFileResult, SpecFileReadPortError> {
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
        ) -> Result<Vec<SpecNode>, SpecTreeScanPortError> {
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
            _spec_id: &SpecId,
            _key: SpecFileKey,
        ) -> Result<ReadSpecFileResult, SpecFileReadPortError> {
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
            ) -> Result<WorkspaceConfig, WorkspaceConfigLoadPortError> {
                self.call_count.set(self.call_count.get() + 1);
                Ok(WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace))
            }

            fn load_spec_config_override(
                &self,
                _layout: &WorkspaceLayout,
                _spec_id: &SpecId,
            ) -> Result<Option<SpecConfigOverride>, WorkspaceConfigLoadPortError> {
                Ok(None)
            }
        }

        let config_loader = CountingConfigLoader {
            call_count: Rc::new(Cell::new(0)),
        };
        let call_count = Rc::clone(&config_loader.call_count);
        let use_cases = app_use_cases(
            FakeWorkspaceDetector {
                result: Err(WorkspaceDetectionPortError::new("unsupported workspace")),
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
            SpecId::new("auth").expect("spec id should be valid"),
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
            ) -> Result<WorkspaceConfig, WorkspaceConfigLoadPortError> {
                Ok(self.workspace_config.clone())
            }

            fn load_spec_config_override(
                &self,
                _layout: &WorkspaceLayout,
                _spec_id: &SpecId,
            ) -> Result<Option<SpecConfigOverride>, WorkspaceConfigLoadPortError> {
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
                _spec_id: &SpecId,
                key: SpecFileKey,
            ) -> Result<ReadSpecFileResult, SpecFileReadPortError> {
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
    fn workspace_detection_port_errors_map_to_app_level_errors() {
        let error = AppUseCaseError::from(WorkspaceDetectionPortError::new(
            "unsupported workspace layout at: /workspace/project",
        ));

        assert_eq!(
            AppUseCaseError::WorkspaceDetection {
                message: "unsupported workspace layout at: /workspace/project".to_string()
            },
            error
        );
    }

    #[test]
    fn spec_config_override_scan_errors_map_to_config_load_errors() {
        let source = SpecTreeScanPortError::config_load("failed to load spec config override");

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
