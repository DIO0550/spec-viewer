//! Spec tree and Markdown command DTOs and handlers.

use std::str::FromStr;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app::services::performance::{emit_span, start_span, PerformanceContext},
    app::use_cases::{
        AppMarkdownDocument, AppMissingMarkdownFile, AppUseCaseError, ArchiveSpecResult,
        LoadSpecBundleResult, LoadWorkspaceResult, ReadSpecFileResult, SpecArtifactBundleItem,
        SpecArtifactError, SpecArtifactOutcome,
    },
    domain::spec::{
        MarkdownBlock, MarkdownBlockSourceRange, SpecArtifactIdentity, SpecDocumentFormat,
        SpecFile, SpecFileKey, SpecFileStatus, SpecNode, SpecNodeKind,
    },
};

use super::{parse_spec_id, CommandState};

type SpecCommandResult<T> = Result<T, SpecCommandError>;

pub type ListSpecsCommandResult<T> = SpecCommandResult<T>;
pub type LoadSpecBundleCommandResult<T> = SpecCommandResult<T>;
pub type ReadSpecFileCommandResult<T> = SpecCommandResult<T>;
pub type ArchiveSpecCommandResult<T> = SpecCommandResult<T>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecCommandError {
    code: SpecCommandErrorCode,
    message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SpecCommandErrorCode {
    InvalidRequest,
    WorkspaceDetection,
    ConfigLoad,
    SpecTreeScan,
    SpecArchive,
    MarkdownRead,
    InvalidSpec,
    Unexpected,
}

impl SpecCommandError {
    fn new(code: SpecCommandErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    fn invalid_request(message: impl Into<String>) -> Self {
        Self::new(SpecCommandErrorCode::InvalidRequest, message)
    }

    fn code(&self) -> &'static str {
        match self.code {
            SpecCommandErrorCode::InvalidRequest => "invalidRequest",
            SpecCommandErrorCode::WorkspaceDetection => "workspaceDetection",
            SpecCommandErrorCode::ConfigLoad => "configLoad",
            SpecCommandErrorCode::SpecTreeScan => "specTreeScan",
            SpecCommandErrorCode::SpecArchive => "specArchive",
            SpecCommandErrorCode::MarkdownRead => "markdownRead",
            SpecCommandErrorCode::InvalidSpec => "invalidSpec",
            SpecCommandErrorCode::Unexpected => "unexpected",
        }
    }

    fn from_app_error(error: AppUseCaseError) -> Self {
        let code = match error {
            AppUseCaseError::WorkspaceDetection { .. } => SpecCommandErrorCode::WorkspaceDetection,
            AppUseCaseError::ConfigLoad { .. } => SpecCommandErrorCode::ConfigLoad,
            AppUseCaseError::SpecTreeScan { .. } => SpecCommandErrorCode::SpecTreeScan,
            AppUseCaseError::SpecArchive { .. } => SpecCommandErrorCode::SpecArchive,
            AppUseCaseError::MarkdownRead { .. } => SpecCommandErrorCode::MarkdownRead,
            AppUseCaseError::InvalidSpec { .. } => SpecCommandErrorCode::InvalidSpec,
            AppUseCaseError::InvalidComment { .. } | AppUseCaseError::CommentRepository { .. } => {
                SpecCommandErrorCode::Unexpected
            }
        };

        Self::new(code, error.to_string())
    }
}

impl From<AppUseCaseError> for SpecCommandError {
    fn from(error: AppUseCaseError) -> Self {
        Self::from_app_error(error)
    }
}

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
    correlation_id: Option<String>,
}
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadSpecBundleRequest {
    workspace_path: String,
    spec_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveSpecRequest {
    workspace_path: String,
    spec_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecTreeResponse {
    specs: Vec<SpecNodeResponse>,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecBundleResponse {
    spec_id: String,
    progress: String,
    artifacts: Vec<SpecArtifactResponse>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecArtifactResponse {
    identity: SpecArtifactIdentityResponse,
    file_key: Option<String>,
    file_name: String,
    label: String,
    format: String,
    progress: String,
    path: String,
    contents: Option<String>,
    blocks: Vec<MarkdownBlockResponse>,
    error: Option<SpecArtifactErrorResponse>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum SpecArtifactIdentityResponse {
    Standard { file_key: String },
    DirectMarkdown { file_name: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecArtifactErrorResponse {
    code: String,
    message: String,
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
    kind: String,
    source_group_id: String,
    relative_id: String,
    present_document_count: usize,
    descendant_spec_count: usize,
    progress: String,
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

    pub fn kind(&self) -> &str {
        &self.kind
    }

    pub fn source_group_id(&self) -> &str {
        &self.source_group_id
    }

    pub fn progress(&self) -> &str {
        &self.progress
    }

    pub fn relative_id(&self) -> &str {
        &self.relative_id
    }

    pub fn present_document_count(&self) -> usize {
        self.present_document_count
    }

    pub fn descendant_spec_count(&self) -> usize {
        self.descendant_spec_count
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
    format: String,
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

    pub fn format(&self) -> &str {
        &self.format
    }

    pub fn config_source(&self) -> &str {
        &self.config_source
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadSpecFileResponse {
    key: String,
    format: String,
    path: String,
    contents: Option<String>,
    missing: bool,
    blocks: Vec<MarkdownBlockResponse>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveSpecResponse {
    archived_spec_id: String,
    archive_path: String,
    source_group_id: String,
    destination_node_id: String,
}

impl ArchiveSpecResponse {
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

impl ReadSpecFileResponse {
    pub fn key(&self) -> &str {
        &self.key
    }

    pub fn format(&self) -> &str {
        &self.format
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
) -> ListSpecsCommandResult<SpecTreeResponse> {
    let workspace = load_workspace(state.use_cases(), &request.workspace_path)?;
    let result = state.use_cases().list_specs(&workspace)?;

    Ok(SpecTreeResponse::from(result.into_specs()))
}

#[tauri::command]
pub fn load_spec_bundle(
    state: State<'_, CommandState>,
    request: LoadSpecBundleRequest,
) -> LoadSpecBundleCommandResult<SpecBundleResponse> {
    let workspace = load_workspace(state.use_cases(), &request.workspace_path)?;
    let result = state
        .use_cases()
        .load_spec_bundle(&workspace, &request.spec_id)?;

    Ok(SpecBundleResponse::from(result))
}
#[tauri::command]
pub fn read_spec_file(
    state: State<'_, CommandState>,
    request: ReadSpecFileRequest,
) -> ReadSpecFileCommandResult<ReadSpecFileResponse> {
    let key = SpecFileKey::from_str(&request.file_key).map_err(|_| {
        SpecCommandError::invalid_request(format!("unsupported file key: {}", request.file_key))
    })?;
    let workspace = load_workspace(state.use_cases(), &request.workspace_path)?;
    let spec_id = parse_spec_id(&request.spec_id)?;
    let performance_context = request
        .correlation_id
        .as_ref()
        .map(|correlation_id| PerformanceContext::new(correlation_id, "read_spec_file"));
    let end_span = performance_context
        .as_ref()
        .map(|context| start_span(context, "command.read_spec_file"));
    let result = state
        .use_cases()
        .read_spec_file_cached(&workspace, &spec_id, key)
        .map_err(SpecCommandError::from);

    if let (Some(context), Some(end_span)) = (performance_context.as_ref(), end_span) {
        let mut metadata = std::collections::BTreeMap::new();
        metadata.insert("spec_id", request.spec_id.clone());
        metadata.insert("file_key", request.file_key.clone());
        if let Err(error) = &result {
            metadata.insert("error", "true".to_string());
            metadata.insert("error_code", error.code().to_string());
        }
        emit_span(context, end_span(metadata));
    }

    Ok(ReadSpecFileResponse::from(result?))
}

#[tauri::command]
pub fn archive_spec(
    state: State<'_, CommandState>,
    request: ArchiveSpecRequest,
) -> ArchiveSpecCommandResult<ArchiveSpecResponse> {
    let workspace = load_workspace(state.use_cases(), &request.workspace_path)?;
    let spec_id = parse_spec_id(&request.spec_id)?;
    let result = state.use_cases().archive_spec(&workspace, &spec_id)?;

    Ok(ArchiveSpecResponse::from(result))
}

fn load_workspace(
    use_cases: &crate::app::use_cases::FilesystemAppUseCases,
    workspace_path: &str,
) -> SpecCommandResult<LoadWorkspaceResult> {
    use_cases.load_workspace(workspace_path).map_err(Into::into)
}

impl From<Vec<SpecNode>> for SpecTreeResponse {
    fn from(specs: Vec<SpecNode>) -> Self {
        Self {
            specs: specs.iter().map(SpecNodeResponse::from).collect(),
        }
    }
}

impl From<LoadSpecBundleResult> for SpecBundleResponse {
    fn from(result: LoadSpecBundleResult) -> Self {
        Self {
            spec_id: result.spec_id,
            progress: result.progress.as_str().to_string(),
            artifacts: result
                .artifacts
                .into_iter()
                .map(SpecArtifactResponse::from)
                .collect(),
        }
    }
}

impl From<SpecArtifactBundleItem> for SpecArtifactResponse {
    fn from(item: SpecArtifactBundleItem) -> Self {
        let SpecArtifactBundleItem {
            identity,
            file_key,
            file_name,
            label,
            format,
            progress,
            path,
            outcome,
        } = item;
        let (contents, blocks, error) = match outcome {
            SpecArtifactOutcome::Loaded(document) => (
                Some(document.contents().to_string()),
                document
                    .blocks()
                    .iter()
                    .map(MarkdownBlockResponse::from)
                    .collect(),
                None,
            ),
            SpecArtifactOutcome::Failed(error) => (
                None,
                Vec::new(),
                Some(SpecArtifactErrorResponse::from(error)),
            ),
        };

        Self {
            identity: SpecArtifactIdentityResponse::from(identity),
            file_key: file_key.map(|key| key.as_str().to_string()),
            file_name,
            label,
            format: format.as_str().to_string(),
            progress: progress.as_str().to_string(),
            path,
            contents,
            blocks,
            error,
        }
    }
}

impl From<SpecArtifactIdentity> for SpecArtifactIdentityResponse {
    fn from(identity: SpecArtifactIdentity) -> Self {
        match identity {
            SpecArtifactIdentity::Standard(file_key) => Self::Standard {
                file_key: file_key.as_str().to_string(),
            },
            SpecArtifactIdentity::DirectMarkdown(file_name) => Self::DirectMarkdown { file_name },
        }
    }
}

impl From<SpecArtifactError> for SpecArtifactErrorResponse {
    fn from(error: SpecArtifactError) -> Self {
        Self {
            code: error.code.as_str().to_string(),
            message: error.message,
        }
    }
}
impl From<&SpecNode> for SpecNodeResponse {
    fn from(node: &SpecNode) -> Self {
        Self {
            id: node.id().to_string(),
            label: node.label().to_string(),
            kind: kind_label(node.kind()).to_string(),
            source_group_id: node.source_group_id().to_string(),
            relative_id: node.relative_id().to_string(),
            present_document_count: node.present_document_count(),
            descendant_spec_count: node.descendant_spec_count(),
            progress: node.progress().as_str().to_string(),
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
            format: format_label(file.format()).to_string(),
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

impl From<ArchiveSpecResult> for ArchiveSpecResponse {
    fn from(result: ArchiveSpecResult) -> Self {
        Self {
            archived_spec_id: result.archived_spec_id().to_string(),
            archive_path: result.archive_path().to_string(),
            source_group_id: result.source_group_id().to_string(),
            destination_node_id: result.destination_node_id().to_string(),
        }
    }
}

impl From<AppMarkdownDocument> for ReadSpecFileResponse {
    fn from(document: AppMarkdownDocument) -> Self {
        let key = match document.identity() {
            SpecArtifactIdentity::Standard(key) => key.as_str().to_string(),
            SpecArtifactIdentity::DirectMarkdown(file_name) => file_name.clone(),
        };

        Self {
            key,
            format: format_label(document.format()).to_string(),
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
            format: format_label(missing.format()).to_string(),
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

fn format_label(format: SpecDocumentFormat) -> &'static str {
    format.as_str()
}

fn kind_label(kind: SpecNodeKind) -> &'static str {
    kind.as_str()
}

fn create_block_text_snippet(text: &str) -> String {
    const MAX_BLOCK_TEXT_SNIPPET_LENGTH: usize = 160;

    text.chars().take(MAX_BLOCK_TEXT_SNIPPET_LENGTH).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app::use_cases::{
        LoadSpecBundleResult, SpecArtifactBundleItem, SpecArtifactError, SpecArtifactErrorCode,
    };
    use crate::domain::spec::{
        MarkdownBlockHash, MarkdownBlockIndex, MarkdownBlockText, MarkdownBlockType,
        SpecArtifactIdentity, SpecId, SpecProgress,
    };

    #[test]
    fn spec_tree_response_serializes_nested_nodes_and_file_statuses() {
        let child = SpecNode::leaf(
            SpecId::new("auth/login").expect("child spec id should be valid"),
            "login",
            vec![
                SpecFile::new(SpecFileKey::Tasks, "tasks.md", SpecFileStatus::Missing)
                    .expect("file should be valid"),
            ],
        )
        .expect("child should be valid");
        let root = SpecNode::new(
            SpecId::new("auth").expect("root spec id should be valid"),
            "auth",
            vec![SpecFile::new(
                SpecFileKey::Impl,
                "implementation-plan.md",
                SpecFileStatus::Present,
            )
            .expect("file should be valid")],
            vec![child],
        )
        .expect("node should be valid");

        let response = SpecTreeResponse::from(vec![root]);

        assert_eq!(1, response.specs().len());
        assert_eq!("auth", response.specs()[0].id());
        assert_eq!("auth", response.specs()[0].label());
        assert_eq!("spec", response.specs()[0].kind());
        assert_eq!("legacy", response.specs()[0].source_group_id());
        assert_eq!("auth", response.specs()[0].relative_id());
        assert_eq!(1, response.specs()[0].present_document_count());
        assert_eq!(1, response.specs()[0].descendant_spec_count());
        let serialized = serde_json::to_value(&response.specs()[0])
            .expect("spec node response should serialize");
        assert_eq!("spec", serialized["kind"]);
        assert_eq!("legacy", serialized["sourceGroupId"]);
        assert_eq!("auth", serialized["relativeId"]);
        assert_eq!(1, serialized["presentDocumentCount"]);
        assert_eq!(1, serialized["descendantSpecCount"]);
        assert_eq!("notStarted", serialized["progress"]);
        assert_eq!("impl", response.specs()[0].files()[0].key());
        assert_eq!("Implementation", response.specs()[0].files()[0].label());
        assert_eq!(
            "implementation-plan.md",
            response.specs()[0].files()[0].file_name()
        );
        assert_eq!("present", response.specs()[0].files()[0].status());
        assert_eq!("markdown", response.specs()[0].files()[0].format());
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
    fn spec_bundle_response_serializes_camel_case_artifact_contract() {
        let result = LoadSpecBundleResult {
            spec_id: "001-feature".to_string(),
            progress: SpecProgress::Completed,
            artifacts: vec![
                SpecArtifactBundleItem {
                    identity: SpecArtifactIdentity::Standard(SpecFileKey::Tasks),
                    file_key: Some(SpecFileKey::Tasks),
                    file_name: "tasks.md".to_string(),
                    label: "Tasks".to_string(),
                    format: SpecDocumentFormat::Markdown,
                    progress: SpecProgress::Completed,
                    path: "/workspace/001-feature/tasks.md".to_string(),
                    outcome: SpecArtifactOutcome::Loaded(AppMarkdownDocument::with_artifact(
                        SpecArtifactIdentity::Standard(SpecFileKey::Tasks),
                        SpecDocumentFormat::Markdown,
                        "/workspace/001-feature/tasks.md",
                        "- [x] Done",
                        Vec::new(),
                    )),
                },
                SpecArtifactBundleItem {
                    identity: SpecArtifactIdentity::direct_markdown("notes.md")
                        .expect("direct identity should be valid"),
                    file_key: None,
                    file_name: "notes.md".to_string(),
                    label: "notes.md".to_string(),
                    format: SpecDocumentFormat::Markdown,
                    progress: SpecProgress::Unknown,
                    path: "/workspace/001-feature/notes.md".to_string(),
                    outcome: SpecArtifactOutcome::Failed(SpecArtifactError {
                        code: SpecArtifactErrorCode::MarkdownRead,
                        message: "This artifact could not be read.".to_string(),
                    }),
                },
            ],
        };

        let response = SpecBundleResponse::from(result);
        let value = serde_json::to_value(response).expect("bundle response should serialize");

        assert_eq!(
            serde_json::json!({
                "specId": "001-feature",
                "progress": "completed",
                "artifacts": [
                    {
                        "identity": {
                            "kind": "standard",
                            "fileKey": "tasks"
                        },
                        "fileKey": "tasks",
                        "fileName": "tasks.md",
                        "label": "Tasks",
                        "format": "markdown",
                        "progress": "completed",
                        "path": "/workspace/001-feature/tasks.md",
                        "contents": "- [x] Done",
                        "blocks": [],
                        "error": null
                    },
                    {
                        "identity": {
                            "kind": "directMarkdown",
                            "fileName": "notes.md"
                        },
                        "fileKey": null,
                        "fileName": "notes.md",
                        "label": "notes.md",
                        "format": "markdown",
                        "progress": "unknown",
                        "path": "/workspace/001-feature/notes.md",
                        "contents": null,
                        "blocks": [],
                        "error": {
                            "code": "markdownRead",
                            "message": "This artifact could not be read."
                        }
                    }
                ]
            }),
            value,
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
        assert_eq!("markdown", response.format());
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
        assert_eq!(
            serde_json::json!({
                "key": "tasks",
                "format": "markdown",
                "path": "/workspace/auth/tasks.md",
                "contents": "# Tasks",
                "missing": false,
                "blocks": [
                    {
                        "blockType": "heading",
                        "blockIndex": 0,
                        "textHash": "sha256:abc12345",
                        "textSnippet": "Tasks",
                        "sourceRange": {
                            "startByteOffset": 0,
                            "endByteOffset": 7
                        }
                    }
                ]
            }),
            serde_json::to_value(&response).expect("found response should serialize"),
        );
    }

    #[test]
    fn read_spec_file_response_serializes_missing_document() {
        let missing = AppMissingMarkdownFile::new(
            SpecFileKey::Requirements,
            "/workspace/auth/requirements.html",
        );

        let response = ReadSpecFileResponse::from(ReadSpecFileResult::Missing(missing));

        assert_eq!("requirements", response.key());
        assert_eq!("markdown", response.format());
        assert_eq!("/workspace/auth/requirements.html", response.path());
        assert_eq!(None, response.contents());
        assert!(response.missing());
        assert!(response.blocks().is_empty());
        assert_eq!(
            serde_json::json!({
                "key": "requirements",
                "format": "markdown",
                "path": "/workspace/auth/requirements.html",
                "contents": null,
                "missing": true,
                "blocks": []
            }),
            serde_json::to_value(&response).expect("missing response should serialize"),
        );
    }

    #[test]
    fn archive_spec_response_serializes_archive_metadata() {
        let result = ArchiveSpecResult::new(
            ".plugin-workspace/.specs/auth",
            "/workspace/.plugin-workspace/.specs/.archive/auth",
            ".plugin-workspace/.specs",
            ".archive/auth",
        );

        let response = ArchiveSpecResponse::from(result);

        assert_eq!(".plugin-workspace/.specs/auth", response.archived_spec_id());
        assert_eq!(
            "/workspace/.plugin-workspace/.specs/.archive/auth",
            response.archive_path()
        );
        assert_eq!(".plugin-workspace/.specs", response.source_group_id());
        assert_eq!(".archive/auth", response.destination_node_id());
        let serialized =
            serde_json::to_value(&response).expect("archive response should serialize");
        assert_eq!(".plugin-workspace/.specs", serialized["sourceGroupId"]);
        assert_eq!(".archive/auth", serialized["destinationNodeId"]);
    }

    #[test]
    fn read_spec_file_response_serializes_html_document_format() {
        let document = AppMarkdownDocument::with_format_and_blocks(
            SpecFileKey::Tasks,
            SpecDocumentFormat::Html,
            "/workspace/auth/tasks.html",
            "<h1>Tasks</h1>",
            Vec::new(),
        );

        let response = ReadSpecFileResponse::from(ReadSpecFileResult::Found(document));

        assert_eq!("html", response.format());
        assert_eq!("/workspace/auth/tasks.html", response.path());
        assert!(response.blocks().is_empty());
    }

    #[test]
    fn spec_id_parser_preserves_invalid_spec_ipc_code() {
        let error = parse_spec_id("../outside").expect_err("unsafe spec id should fail");
        let error = SpecCommandError::from_app_error(error);
        let value = serde_json::to_value(error).expect("error should serialize");

        assert_eq!("invalidSpec", value["code"]);
        assert_eq!(
            "invalid spec input: unsafe spec id: ../outside",
            value["message"]
        );
    }

    #[test]
    fn spec_archive_app_error_keeps_public_command_code() {
        let error = SpecCommandError::from(AppUseCaseError::SpecArchive {
            message: "archive rejected by domain policy".to_string(),
        });
        let serialized = serde_json::to_value(error).expect("command error should serialize");

        assert_eq!("specArchive", serialized["code"]);
    }
}
