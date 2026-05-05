//! Spec tree and Markdown command DTOs and handlers.

use std::str::FromStr;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app::use_cases::{
        AppMarkdownDocument, AppMissingMarkdownFile, LoadWorkspaceResult, ReadSpecFileResult,
    },
    domain::spec::{
        MarkdownBlock, MarkdownBlockSourceRange, SpecFile, SpecFileKey, SpecFileStatus, SpecNode,
    },
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
    config_source: String,
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

    pub fn config_source(&self) -> &str {
        &self.config_source
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadSpecFileResponse {
    key: String,
    path: String,
    contents: Option<String>,
    missing: bool,
    blocks: Vec<MarkdownBlockResponse>,
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

    pub fn blocks(&self) -> &[MarkdownBlockResponse] {
        &self.blocks
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownBlockResponse {
    block_type: String,
    block_index: usize,
    text_hash: String,
    text_snippet: String,
    source_range: Option<MarkdownBlockSourceRangeResponse>,
}

impl MarkdownBlockResponse {
    pub fn block_type(&self) -> &str {
        &self.block_type
    }

    pub fn block_index(&self) -> usize {
        self.block_index
    }

    pub fn text_hash(&self) -> &str {
        &self.text_hash
    }

    pub fn text_snippet(&self) -> &str {
        &self.text_snippet
    }

    pub fn source_range(&self) -> Option<&MarkdownBlockSourceRangeResponse> {
        self.source_range.as_ref()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownBlockSourceRangeResponse {
    start_byte_offset: usize,
    end_byte_offset: usize,
}

impl MarkdownBlockSourceRangeResponse {
    pub fn start_byte_offset(&self) -> usize {
        self.start_byte_offset
    }

    pub fn end_byte_offset(&self) -> usize {
        self.end_byte_offset
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
            config_source: file.config_source().as_str().to_string(),
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
            blocks: document
                .blocks()
                .iter()
                .map(MarkdownBlockResponse::from)
                .collect(),
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
            blocks: Vec::new(),
        }
    }
}

impl From<&MarkdownBlock> for MarkdownBlockResponse {
    fn from(block: &MarkdownBlock) -> Self {
        Self {
            block_type: block.block_type().as_str().to_string(),
            block_index: block.index().value(),
            text_hash: block.text_hash().as_str().to_string(),
            text_snippet: create_block_text_snippet(block.text().normalized()),
            source_range: block
                .source_range()
                .map(MarkdownBlockSourceRangeResponse::from),
        }
    }
}

impl From<MarkdownBlockSourceRange> for MarkdownBlockSourceRangeResponse {
    fn from(range: MarkdownBlockSourceRange) -> Self {
        Self {
            start_byte_offset: range.start_byte_offset(),
            end_byte_offset: range.end_byte_offset(),
        }
    }
}

fn status_label(status: SpecFileStatus) -> &'static str {
    match status {
        SpecFileStatus::Present => "present",
        SpecFileStatus::Missing => "missing",
    }
}

fn create_block_text_snippet(text: &str) -> String {
    const MAX_BLOCK_TEXT_SNIPPET_LENGTH: usize = 160;

    text.chars().take(MAX_BLOCK_TEXT_SNIPPET_LENGTH).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::spec::{
        MarkdownBlockHash, MarkdownBlockIndex, MarkdownBlockText, MarkdownBlockType,
    };

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
        assert_eq!(
            "workspaceConfig",
            response.specs()[0].files()[0].config_source()
        );
        assert_eq!("auth/login", response.specs()[0].children()[0].id());
        assert_eq!(
            "missing",
            response.specs()[0].children()[0].files()[0].status()
        );
    }

    #[test]
    fn read_spec_file_response_serializes_found_document() {
        let source_range =
            MarkdownBlockSourceRange::new(0, 7).expect("source range should be valid");
        let block = MarkdownBlock::new(
            MarkdownBlockType::Heading,
            MarkdownBlockIndex::new(0),
            MarkdownBlockText::new("# Tasks", "Tasks").expect("block text should be valid"),
            MarkdownBlockHash::new("sha256:abc12345").expect("hash should be valid"),
            Some(source_range),
        );
        let document = AppMarkdownDocument::with_blocks(
            SpecFileKey::Tasks,
            "/workspace/auth/tasks.md",
            "# Tasks",
            vec![block],
        );

        let response = ReadSpecFileResponse::from(ReadSpecFileResult::Found(document));

        assert_eq!("tasks", response.key());
        assert_eq!("/workspace/auth/tasks.md", response.path());
        assert_eq!(Some("# Tasks"), response.contents());
        assert!(!response.missing());
        assert_eq!(1, response.blocks().len());
        assert_eq!("heading", response.blocks()[0].block_type());
        assert_eq!(0, response.blocks()[0].block_index());
        assert_eq!("sha256:abc12345", response.blocks()[0].text_hash());
        assert_eq!("Tasks", response.blocks()[0].text_snippet());
        assert_eq!(
            Some(&MarkdownBlockSourceRangeResponse {
                start_byte_offset: 0,
                end_byte_offset: 7,
            }),
            response.blocks()[0].source_range()
        );
    }

    #[test]
    fn read_spec_file_response_serializes_missing_document() {
        let missing = AppMissingMarkdownFile::new(SpecFileKey::Design, "/workspace/auth/design.md");

        let response = ReadSpecFileResponse::from(ReadSpecFileResult::Missing(missing));

        assert_eq!("design", response.key());
        assert_eq!("/workspace/auth/design.md", response.path());
        assert_eq!(None, response.contents());
        assert!(response.missing());
        assert!(response.blocks().is_empty());
    }
}
