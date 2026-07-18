//! Workspace command DTOs and handlers.

use std::{fs, io, path::Path};

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app::use_cases::{AppUseCaseError, LoadWorkspaceResult},
    domain::workspace::{WorkspaceConfig, WorkspaceFileMapping, WorkspaceLayout},
};

use super::CommandState;

pub type LoadWorkspaceCommandResult<T> = Result<T, WorkspaceCommandError>;
pub type ValidateWorkspaceDirectoryCommandResult<T> = Result<T, WorkspaceCommandError>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCommandError {
    code: WorkspaceCommandErrorCode,
    message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WorkspaceCommandErrorCode {
    InvalidRequest,
    WorkspaceDetection,
    ConfigLoad,
    Unexpected,
}

impl WorkspaceCommandError {
    fn new(code: WorkspaceCommandErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    fn invalid_request(message: impl Into<String>) -> Self {
        Self::new(WorkspaceCommandErrorCode::InvalidRequest, message)
    }

    fn from_app_error(error: AppUseCaseError) -> Self {
        let code = match error {
            AppUseCaseError::WorkspaceDetection { .. } => {
                WorkspaceCommandErrorCode::WorkspaceDetection
            }
            AppUseCaseError::ConfigLoad { .. } => WorkspaceCommandErrorCode::ConfigLoad,
            AppUseCaseError::SpecTreeScan { .. }
            | AppUseCaseError::SpecArchive { .. }
            | AppUseCaseError::MarkdownRead { .. }
            | AppUseCaseError::InvalidSpec { .. }
            | AppUseCaseError::InvalidComment { .. }
            | AppUseCaseError::CommentRepository { .. }
            | AppUseCaseError::ReviewRunExport { .. } => WorkspaceCommandErrorCode::Unexpected,
        };

        Self::new(code, error.to_string())
    }
}

impl From<AppUseCaseError> for WorkspaceCommandError {
    fn from(error: AppUseCaseError) -> Self {
        Self::from_app_error(error)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadWorkspaceRequest {
    selected_directory: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateWorkspaceDirectoryRequest {
    path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateWorkspaceDirectoryResponse {
    is_directory: bool,
}

impl ValidateWorkspaceDirectoryResponse {
    pub fn is_directory(&self) -> bool {
        self.is_directory
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceResponse {
    root: String,
    kind: String,
    files: Vec<WorkspaceFileMappingResponse>,
}

impl WorkspaceResponse {
    pub fn root(&self) -> &str {
        &self.root
    }

    pub fn kind(&self) -> &str {
        &self.kind
    }

    pub fn files(&self) -> &[WorkspaceFileMappingResponse] {
        &self.files
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFileMappingResponse {
    key: String,
    label: String,
    file_name: String,
    config_source: String,
}

impl WorkspaceFileMappingResponse {
    pub fn key(&self) -> &str {
        &self.key
    }

    pub fn label(&self) -> &str {
        &self.label
    }

    pub fn file_name(&self) -> &str {
        &self.file_name
    }

    pub fn config_source(&self) -> &str {
        &self.config_source
    }
}

#[tauri::command]
pub fn load_workspace(
    state: State<'_, CommandState>,
    request: LoadWorkspaceRequest,
) -> LoadWorkspaceCommandResult<WorkspaceResponse> {
    let workspace = state
        .use_cases()
        .load_workspace(&request.selected_directory)?;

    Ok(WorkspaceResponse::from(&workspace))
}

#[tauri::command]
pub fn validate_workspace_directory(
    request: ValidateWorkspaceDirectoryRequest,
) -> ValidateWorkspaceDirectoryCommandResult<ValidateWorkspaceDirectoryResponse> {
    let trimmed_path = request.path.trim();

    if trimmed_path.is_empty() {
        return Ok(ValidateWorkspaceDirectoryResponse {
            is_directory: false,
        });
    }

    let path = Path::new(trimmed_path);

    match fs::metadata(path) {
        Ok(metadata) => Ok(ValidateWorkspaceDirectoryResponse {
            is_directory: metadata.is_dir(),
        }),
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            Ok(ValidateWorkspaceDirectoryResponse {
                is_directory: false,
            })
        }
        Err(error) => Err(WorkspaceCommandError::invalid_request(format!(
            "failed to inspect dropped path: {}",
            error
        ))),
    }
}

impl From<&LoadWorkspaceResult> for WorkspaceResponse {
    fn from(result: &LoadWorkspaceResult) -> Self {
        Self::from_layout_and_config(result.layout(), result.config())
    }
}

impl WorkspaceResponse {
    pub(crate) fn from_layout_and_config(
        layout: &WorkspaceLayout,
        config: &WorkspaceConfig,
    ) -> Self {
        let files = config
            .files()
            .iter()
            .map(WorkspaceFileMappingResponse::from)
            .collect();

        Self {
            root: layout.root().as_str().to_string(),
            kind: layout.kind().identifier().to_string(),
            files,
        }
    }
}

impl From<&WorkspaceFileMapping> for WorkspaceFileMappingResponse {
    fn from(mapping: &WorkspaceFileMapping) -> Self {
        Self {
            key: mapping.key().as_str().to_string(),
            label: mapping.key().display_label().to_string(),
            file_name: mapping.file_name().to_string(),
            config_source: mapping.source().as_str().to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{
        spec::SpecFileKey,
        workspace::{WorkspaceConfig, WorkspaceFileMapping, WorkspaceKind, WorkspaceRoot},
    };

    #[test]
    fn workspace_command_error_serializes_known_codes() {
        let error = WorkspaceCommandError::new(
            WorkspaceCommandErrorCode::WorkspaceDetection,
            "workspace missing",
        );
        let value = serde_json::to_value(error).expect("error should serialize");

        assert_eq!("workspaceDetection", value["code"]);
        assert_eq!("workspace missing", value["message"]);
    }

    #[test]
    fn workspace_response_serializes_layout_and_config_without_domain_types() {
        let root = WorkspaceRoot::new("/workspace/example").expect("root should be valid");
        let layout = WorkspaceLayout::new(root, WorkspaceKind::PluginWorkspace);
        let config = WorkspaceConfig::new(vec![WorkspaceFileMapping::new(
            SpecFileKey::Tasks,
            "todo.md",
        )
        .expect("mapping should be valid")])
        .expect("config should be valid");

        let response = WorkspaceResponse::from_layout_and_config(&layout, &config);

        assert_eq!("/workspace/example", response.root());
        assert_eq!("plugin-workspace", response.kind());
        assert_eq!(1, response.files().len());
        assert_eq!("tasks", response.files()[0].key());
        assert_eq!("Tasks", response.files()[0].label());
        assert_eq!("todo.md", response.files()[0].file_name());
        assert_eq!("workspaceConfig", response.files()[0].config_source());
    }

    #[test]
    fn validate_workspace_directory_response_exposes_directory_flag() {
        let response = ValidateWorkspaceDirectoryResponse { is_directory: true };

        assert!(response.is_directory());
    }
}
