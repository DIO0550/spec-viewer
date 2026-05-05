//! Workspace command DTOs and handlers.

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app::use_cases::LoadWorkspaceResult,
    domain::workspace::{WorkspaceConfig, WorkspaceFileMapping, WorkspaceLayout},
};

use super::{CommandResult, CommandState};

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadWorkspaceRequest {
    selected_directory: String,
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
}

#[tauri::command]
pub fn load_workspace(
    state: State<'_, CommandState>,
    request: LoadWorkspaceRequest,
) -> CommandResult<WorkspaceResponse> {
    let workspace = state
        .use_cases()
        .load_workspace(&request.selected_directory)?;

    Ok(WorkspaceResponse::from(&workspace))
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
    }
}
