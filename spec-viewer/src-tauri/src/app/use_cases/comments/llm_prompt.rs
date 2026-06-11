//! LLM prompt generation use case orchestration.

use chrono::Utc;

use crate::{
    app::use_cases::{FilesystemAppUseCases, LoadWorkspaceResult, ReadSpecFileResult},
    domain::{
        comment::{
            CommentExportTarget, CommentStatusFilter, ExportedComment, LlmPrompt, LlmPromptFile,
        },
        spec::{SpecFileKey, SpecNode},
    },
};

use super::ExportCommentsError;

/// Input for the LLM prompt generation use case.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GenerateLlmPromptInput {
    workspace_path: String,
    target: CommentExportTarget,
}

impl GenerateLlmPromptInput {
    pub fn new(workspace_path: impl Into<String>, target: CommentExportTarget) -> Self {
        Self {
            workspace_path: workspace_path.into(),
            target,
        }
    }

    pub fn workspace_path(&self) -> &str {
        &self.workspace_path
    }

    pub fn target(&self) -> &CommentExportTarget {
        &self.target
    }
}

impl FilesystemAppUseCases {
    /// Renders the LLM prompt for unresolved comments of the target.
    pub fn generate_llm_prompt(
        &self,
        workspace: &LoadWorkspaceResult,
        input: GenerateLlmPromptInput,
    ) -> Result<LlmPrompt, ExportCommentsError> {
        let generated_at = Utc::now();
        let files = match input.target() {
            CommentExportTarget::File { spec_id, file_key } => {
                vec![self.collect_llm_prompt_file(
                    workspace,
                    spec_id,
                    spec_id,
                    *file_key,
                    file_key.display_label(),
                )?]
            }
            CommentExportTarget::Spec { spec_id } => {
                let specs = self.list_specs(workspace)?.into_specs();
                let spec = SpecNode::find_by_id(&specs, spec_id).ok_or_else(|| {
                    ExportCommentsError::UnknownSpec {
                        spec_id: spec_id.clone(),
                    }
                })?;

                self.collect_llm_prompt_files_for_spec(workspace, spec)?
            }
            CommentExportTarget::Workspace => {
                let specs = self.list_specs(workspace)?.into_specs();
                specs
                    .iter()
                    .flat_map(|spec| spec.collect_nodes_with_files().into_iter())
                    .map(|spec| self.collect_llm_prompt_files_for_spec(workspace, spec))
                    .collect::<Result<Vec<_>, _>>()?
                    .into_iter()
                    .flatten()
                    .collect()
            }
        };

        Ok(LlmPrompt::render(
            input.workspace_path(),
            input.target(),
            generated_at,
            &files,
        ))
    }

    fn collect_llm_prompt_files_for_spec(
        &self,
        workspace: &LoadWorkspaceResult,
        spec: &SpecNode,
    ) -> Result<Vec<LlmPromptFile>, ExportCommentsError> {
        spec.files()
            .iter()
            .map(|file| {
                self.collect_llm_prompt_file(
                    workspace,
                    spec.id(),
                    spec.label(),
                    file.key(),
                    file.display_label(),
                )
            })
            .collect()
    }

    fn collect_llm_prompt_file(
        &self,
        workspace: &LoadWorkspaceResult,
        spec_id: &str,
        spec_label: &str,
        file_key: SpecFileKey,
        file_label: &str,
    ) -> Result<LlmPromptFile, ExportCommentsError> {
        let (markdown_path, markdown_contents, blocks) = match self
            .read_spec_file_cached(workspace, spec_id, file_key)?
        {
            ReadSpecFileResult::Found(document) => (
                document.path().to_string(),
                Some(document.contents().to_string()),
                document.blocks().to_vec(),
            ),
            ReadSpecFileResult::Missing(missing) => (missing.path().to_string(), None, Vec::new()),
        };
        let resolutions = self.comment_use_cases(workspace).resolve_comment_anchors(
            spec_id,
            file_key,
            CommentStatusFilter::Open,
            &blocks,
        )?;

        Ok(LlmPromptFile::new(
            spec_id,
            spec_label,
            file_key,
            file_label,
            markdown_path,
            markdown_contents,
            resolutions
                .resolutions()
                .iter()
                .map(ExportedComment::from_resolution)
                .collect(),
        ))
    }
}
