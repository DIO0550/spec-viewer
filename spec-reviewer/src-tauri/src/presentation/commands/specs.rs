//! Spec tree and Markdown command DTOs and handlers.

use std::str::FromStr;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app::use_cases::{
        AppMarkdownDocument, AppMissingMarkdownFile, LoadWorkspaceResult, ReadSpecFileResult,
    },
    domain::spec::{SpecFile, SpecFileKey, SpecFileStatus, SpecNode},
};

use super::{CommandError, CommandResult, CommandState};

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSpecsRequest {
    workspace_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadSpecFileRequest {
    workspace_path: String,
    spec_id: String,
    file_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecTreeResponse {
    specs: Vec<SpecNodeResponse>,
}

impl SpecTreeResponse {
    pub fn specs(&self) -> &[SpecNodeResponse] {
        &self.specs
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecNodeResponse {
    id: String,
    label: String,
    files: Vec<SpecFileResponse>,
    children: Vec<SpecNodeResponse>,
}

impl SpecNodeResponse {
    pub fn id(&self) -> &str {
        &self.id
    }

    pub fn label(&self) -> &str {
        &self.label
    }

    pub fn files(&self) -> &[SpecFileResponse] {
        &self.files
    }

    pub fn children(&self) -> &[SpecNodeResponse] {
        &self.children
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecFileResponse {
    key: String,
    label: String,
    file_name: String,
    status: String,
}

impl SpecFileResponse {
    pub fn key(&self) -> &str {
        &self.key
    }

    pub fn label(&self) -> &str {
        &self.label
    }

    pub fn file_name(&self) -> &str {
        &self.file_name
    }

    pub fn status(&self) -> &str {
        &self.status
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadSpecFileResponse {
    key: String,
    path: String,
    contents: Option<String>,
    missing: bool,
}

impl ReadSpecFileResponse {
    pub fn key(&self) -> &str {
        &self.key
    }

    pub fn path(&self) -> &str {
        &self.path
    }

    pub fn contents(&self) -> Option<&str> {
        self.contents.as_deref()
    }

    pub fn missing(&self) -> bool {
        self.missing
    }
}

#[tauri::command]
pub fn list_specs(
    state: State<'_, CommandState>,
    request: ListSpecsRequest,
) -> CommandResult<SpecTreeResponse> {
    let workspace = load_workspace(state.use_cases(), &request.workspace_path)?;
    let result = state.use_cases().list_specs(&workspace)?;

    Ok(SpecTreeResponse::from(result.into_specs()))
}

#[tauri::command]
pub fn read_spec_file(
    state: State<'_, CommandState>,
    request: ReadSpecFileRequest,
) -> CommandResult<ReadSpecFileResponse> {
    let key = SpecFileKey::from_str(&request.file_key).map_err(|_| {
        CommandError::invalid_request(format!("unsupported file key: {}", request.file_key))
    })?;
    let workspace = load_workspace(state.use_cases(), &request.workspace_path)?;
    let result = state
        .use_cases()
        .read_spec_file(&workspace, &request.spec_id, key)?;

    Ok(ReadSpecFileResponse::from(result))
}

fn load_workspace(
    use_cases: &crate::app::use_cases::FilesystemAppUseCases,
    workspace_path: &str,
) -> CommandResult<LoadWorkspaceResult> {
    use_cases.load_workspace(workspace_path).map_err(Into::into)
}

impl From<Vec<SpecNode>> for SpecTreeResponse {
    fn from(specs: Vec<SpecNode>) -> Self {
        Self {
            specs: specs.iter().map(SpecNodeResponse::from).collect(),
        }
    }
}

impl From<&SpecNode> for SpecNodeResponse {
    fn from(node: &SpecNode) -> Self {
        Self {
            id: node.id().to_string(),
            label: node.label().to_string(),
            files: node.files().iter().map(SpecFileResponse::from).collect(),
            children: node.children().iter().map(SpecNodeResponse::from).collect(),
        }
    }
}

impl From<&SpecFile> for SpecFileResponse {
    fn from(file: &SpecFile) -> Self {
        Self {
            key: file.key().as_str().to_string(),
            label: file.display_label().to_string(),
            file_name: file.file_name().to_string(),
            status: status_label(file.status()).to_string(),
        }
    }
}

impl From<ReadSpecFileResult> for ReadSpecFileResponse {
    fn from(result: ReadSpecFileResult) -> Self {
        match result {
            ReadSpecFileResult::Found(document) => Self::from(document),
            ReadSpecFileResult::Missing(missing) => Self::from(missing),
        }
    }
}

impl From<AppMarkdownDocument> for ReadSpecFileResponse {
    fn from(document: AppMarkdownDocument) -> Self {
        Self {
            key: document.key().as_str().to_string(),
            path: document.path().to_string(),
            contents: Some(document.contents().to_string()),
            missing: false,
        }
    }
}

impl From<AppMissingMarkdownFile> for ReadSpecFileResponse {
    fn from(missing: AppMissingMarkdownFile) -> Self {
        Self {
            key: missing.key().as_str().to_string(),
            path: missing.path().to_string(),
            contents: None,
            missing: true,
        }
    }
}

fn status_label(status: SpecFileStatus) -> &'static str {
    match status {
        SpecFileStatus::Present => "present",
        SpecFileStatus::Missing => "missing",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spec_tree_response_serializes_nested_nodes_and_file_statuses() {
        let child = SpecNode::leaf(
            "auth/login",
            "login",
            vec![
                SpecFile::new(SpecFileKey::Tasks, "tasks.md", SpecFileStatus::Missing)
                    .expect("file should be valid"),
            ],
        )
        .expect("child should be valid");
        let root = SpecNode::new(
            "auth",
            "auth",
            vec![
                SpecFile::new(SpecFileKey::Impl, "impl.md", SpecFileStatus::Present)
                    .expect("file should be valid"),
            ],
            vec![child],
        )
        .expect("node should be valid");

        let response = SpecTreeResponse::from(vec![root]);

        assert_eq!(1, response.specs().len());
        assert_eq!("auth", response.specs()[0].id());
        assert_eq!("auth", response.specs()[0].label());
        assert_eq!("impl", response.specs()[0].files()[0].key());
        assert_eq!("Implementation", response.specs()[0].files()[0].label());
        assert_eq!("impl.md", response.specs()[0].files()[0].file_name());
        assert_eq!("present", response.specs()[0].files()[0].status());
        assert_eq!("auth/login", response.specs()[0].children()[0].id());
        assert_eq!(
            "missing",
            response.specs()[0].children()[0].files()[0].status()
        );
    }

    #[test]
    fn read_spec_file_response_serializes_found_document() {
        let document =
            AppMarkdownDocument::new(SpecFileKey::Tasks, "/workspace/auth/tasks.md", "# Tasks");

        let response = ReadSpecFileResponse::from(ReadSpecFileResult::Found(document));

        assert_eq!("tasks", response.key());
        assert_eq!("/workspace/auth/tasks.md", response.path());
        assert_eq!(Some("# Tasks"), response.contents());
        assert!(!response.missing());
    }

    #[test]
    fn read_spec_file_response_serializes_missing_document() {
        let missing = AppMissingMarkdownFile::new(SpecFileKey::Design, "/workspace/auth/design.md");

        let response = ReadSpecFileResponse::from(ReadSpecFileResult::Missing(missing));

        assert_eq!("design", response.key());
        assert_eq!("/workspace/auth/design.md", response.path());
        assert_eq!(None, response.contents());
        assert!(response.missing());
    }
}
