use thiserror::Error;

use crate::domain::spec::SpecId;

use super::{SpecConfigOverride, WorkspaceConfig, WorkspaceLayout, WorkspaceRelativePath};

pub trait DetectWorkspace {
    fn detect_workspace(
        &self,
        selected_directory: &str,
    ) -> Result<WorkspaceLayout, WorkspaceDetectionPortError>;
}

pub trait LoadWorkspaceConfig {
    fn load_workspace_config(
        &self,
        layout: &WorkspaceLayout,
    ) -> Result<WorkspaceConfig, WorkspaceConfigLoadPortError>;

    fn load_spec_config_override(
        &self,
        layout: &WorkspaceLayout,
        spec_id: &SpecId,
    ) -> Result<Option<SpecConfigOverride>, WorkspaceConfigLoadPortError>;
}

pub trait LoadSpecConfigOverride {
    fn load_spec_config_override_at(
        &self,
        layout: &WorkspaceLayout,
        relative_spec_directory: &WorkspaceRelativePath,
    ) -> Result<Option<SpecConfigOverride>, WorkspaceConfigLoadPortError>;
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
#[error("{message}")]
pub struct WorkspaceDetectionPortError {
    message: String,
}

impl WorkspaceDetectionPortError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }

    pub fn message(&self) -> &str {
        &self.message
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
#[error("{message}")]
pub struct WorkspaceConfigLoadPortError {
    message: String,
}

impl WorkspaceConfigLoadPortError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }

    pub fn message(&self) -> &str {
        &self.message
    }
}
