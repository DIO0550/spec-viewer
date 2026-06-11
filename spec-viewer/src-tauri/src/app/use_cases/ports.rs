//! Ports that AppUseCases depends on, with their filesystem adapter impls.

use std::path::Path;

use crate::{
    domain::{
        spec::{SpecFileKey, SpecNode},
        workspace::{SpecConfigOverride, WorkspaceConfig, WorkspaceLayout},
    },
    infrastructure::{
        filesystem::{FilesystemSpecTreeScanner, FilesystemWorkspaceDetector},
        markdown::FilesystemMarkdownReader,
        persistence::config::WorkspaceConfigLoader,
    },
};

use super::{error::AppUseCaseError, results::ReadSpecFileResult};

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
    ) -> Result<Option<SpecConfigOverride>, AppUseCaseError>;
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
    ) -> Result<Option<SpecConfigOverride>, AppUseCaseError> {
        self.load_spec_override_from_directory(spec_directory)
            .map_err(AppUseCaseError::from)
    }
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
