//! Comment export use case orchestration.

use chrono::{DateTime, Utc};
use thiserror::Error;

use crate::{
    app::use_cases::{AppUseCaseError, FilesystemAppUseCases, LoadWorkspaceResult},
    domain::{
        comment::{
            CommentExport, CommentExportFile, CommentExportFormat, CommentExportRenderError,
            CommentExportTarget, CommentStatusFilter, ExportedComment,
        },
        spec::{SpecFileKey, SpecNode},
    },
    infrastructure::persistence::comment_export_writer::{
        CommentExportWriteError, CommentExportWriter,
    },
};

/// Input for the comment export use case.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExportCommentsInput {
    workspace_path: String,
    target: CommentExportTarget,
    destination_path: String,
}

impl ExportCommentsInput {
    pub fn new(
        workspace_path: impl Into<String>,
        target: CommentExportTarget,
        destination_path: impl Into<String>,
    ) -> Self {
        Self {
            workspace_path: workspace_path.into(),
            target,
            destination_path: destination_path.into(),
        }
    }

    pub fn workspace_path(&self) -> &str {
        &self.workspace_path
    }

    pub fn target(&self) -> &CommentExportTarget {
        &self.target
    }

    pub fn destination_path(&self) -> &str {
        &self.destination_path
    }
}

/// Result of writing a comment export.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExportCommentsResult {
    destination_path: String,
    format: CommentExportFormat,
    comment_count: usize,
}

impl ExportCommentsResult {
    pub fn new(
        destination_path: impl Into<String>,
        format: CommentExportFormat,
        comment_count: usize,
    ) -> Self {
        Self {
            destination_path: destination_path.into(),
            format,
            comment_count,
        }
    }

    pub fn destination_path(&self) -> &str {
        &self.destination_path
    }

    pub fn format(&self) -> CommentExportFormat {
        self.format
    }

    pub fn comment_count(&self) -> usize {
        self.comment_count
    }
}

/// Error raised by the comment export and LLM prompt use cases.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ExportCommentsError {
    #[error("unknown spec id: {spec_id}")]
    UnknownSpec { spec_id: String },
    #[error("comment export destination path is required")]
    MissingDestinationPath,
    #[error(transparent)]
    UseCase(#[from] AppUseCaseError),
}

impl From<CommentExportRenderError> for ExportCommentsError {
    fn from(source: CommentExportRenderError) -> Self {
        Self::UseCase(AppUseCaseError::CommentRepository {
            message: source.to_string(),
        })
    }
}

impl From<CommentExportWriteError> for ExportCommentsError {
    fn from(source: CommentExportWriteError) -> Self {
        match source {
            CommentExportWriteError::MissingDestinationPath => Self::MissingDestinationPath,
            CommentExportWriteError::Io { .. } => {
                Self::UseCase(AppUseCaseError::CommentRepository {
                    message: source.to_string(),
                })
            }
        }
    }
}

impl FilesystemAppUseCases {
    /// Builds the comment export for the target and writes it to the destination.
    pub fn export_comments(
        &self,
        workspace: &LoadWorkspaceResult,
        input: ExportCommentsInput,
    ) -> Result<ExportCommentsResult, ExportCommentsError> {
        let generated_at = Utc::now();
        let export = self.build_comment_export(workspace, &input, generated_at)?;

        CommentExportWriter::new().write(input.destination_path(), export.contents())?;

        Ok(ExportCommentsResult::new(
            input.destination_path(),
            export.format(),
            export.comment_count(),
        ))
    }

    fn build_comment_export(
        &self,
        workspace: &LoadWorkspaceResult,
        input: &ExportCommentsInput,
        generated_at: DateTime<Utc>,
    ) -> Result<CommentExport, ExportCommentsError> {
        match input.target() {
            CommentExportTarget::File { spec_id, file_key } => {
                let file = self.collect_comment_export_file(
                    workspace,
                    spec_id,
                    spec_id,
                    *file_key,
                    file_key.display_label(),
                )?;

                Ok(CommentExport::markdown(
                    "Current File Comments",
                    input.workspace_path(),
                    generated_at,
                    std::slice::from_ref(&file),
                ))
            }
            CommentExportTarget::Spec { spec_id } => {
                let specs = self.list_specs(workspace)?.into_specs();
                let spec = SpecNode::find_by_id(&specs, spec_id).ok_or_else(|| {
                    ExportCommentsError::UnknownSpec {
                        spec_id: spec_id.clone(),
                    }
                })?;
                let files = self.collect_comment_export_files_for_spec(workspace, spec)?;

                Ok(CommentExport::markdown(
                    "Current Spec Comments",
                    input.workspace_path(),
                    generated_at,
                    &files,
                ))
            }
            CommentExportTarget::Workspace => {
                let specs = self.list_specs(workspace)?.into_specs();
                let files = specs
                    .iter()
                    .flat_map(|spec| spec.collect_nodes_with_files().into_iter())
                    .map(|spec| self.collect_comment_export_files_for_spec(workspace, spec))
                    .collect::<Result<Vec<_>, _>>()?
                    .into_iter()
                    .flatten()
                    .collect::<Vec<_>>();

                CommentExport::workspace_json(input.workspace_path(), generated_at, &files)
                    .map_err(ExportCommentsError::from)
            }
        }
    }

    fn collect_comment_export_files_for_spec(
        &self,
        workspace: &LoadWorkspaceResult,
        spec: &SpecNode,
    ) -> Result<Vec<CommentExportFile>, ExportCommentsError> {
        spec.files()
            .iter()
            .map(|file| {
                self.collect_comment_export_file(
                    workspace,
                    spec.id(),
                    spec.label(),
                    file.key(),
                    file.display_label(),
                )
            })
            .collect()
    }

    fn collect_comment_export_file(
        &self,
        workspace: &LoadWorkspaceResult,
        spec_id: &str,
        spec_label: &str,
        file_key: SpecFileKey,
        file_label: &str,
    ) -> Result<CommentExportFile, ExportCommentsError> {
        let current_blocks = self.read_spec_blocks_cached(workspace, spec_id, file_key)?;
        let resolutions = self.comment_use_cases(workspace).resolve_comment_anchors(
            spec_id,
            file_key,
            CommentStatusFilter::All,
            &current_blocks,
        )?;

        Ok(CommentExportFile::new(
            spec_id,
            spec_label,
            file_key,
            file_label,
            resolutions
                .resolutions()
                .iter()
                .map(ExportedComment::from_resolution)
                .collect(),
        ))
    }
}
