//! Comment command DTOs and handlers.

mod requests;
mod responses;

pub use requests::{
    AddCommentRequest, CommentAnchorRequest, CommentStatusRequest, DeleteCommentRequest,
    ExportCommentsRequest, ExportCommentsTargetRequest, GenerateLlmPromptRequest,
    ListCommentsRequest, UpdateCommentRequest,
};
pub use responses::{
    CharRangeDto, CommentAnchorResolutionResponse, CommentAnchorResolutionTargetResponse,
    CommentAnchorResponse, CommentResponse, CommentSourceRangeResponse, DeleteCommentResponse,
    ExportCommentsResponse, GenerateLlmPromptResponse, ListCommentsResponse,
};

use tauri::State;

use crate::app::{
    services::performance::{emit_span, start_span, PerformanceContext},
    use_cases::{ExportCommentsError, ExportCommentsInput, GenerateLlmPromptInput},
};

use super::{CommandError, CommandResult, CommandState};

use requests::{parse_file_key, parse_status_filter};

#[tauri::command]
pub fn list_comments(
    state: State<'_, CommandState>,
    request: ListCommentsRequest,
) -> CommandResult<ListCommentsResponse> {
    let file_key = parse_file_key(&request.file_key)?;
    let status_filter = parse_status_filter(request.status_filter.as_deref())?;
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let performance_context = request
        .correlation_id
        .as_ref()
        .map(|correlation_id| PerformanceContext::new(correlation_id, "list_comments"));
    let end_span = performance_context
        .as_ref()
        .map(|context| start_span(context, "command.list_comments"));
    let result = (|| {
        let current_blocks = state
            .use_cases()
            .read_spec_blocks_cached(&workspace, &request.spec_id, file_key)
            .map_err(CommandError::from)?;
        let resolutions = state
            .use_cases()
            .comment_use_cases(&workspace)
            .resolve_comment_anchors(&request.spec_id, file_key, status_filter, &current_blocks)?;

        Ok::<_, CommandError>((current_blocks.len(), resolutions))
    })();

    if let (Some(context), Some(end_span)) = (performance_context.as_ref(), end_span) {
        let mut metadata = std::collections::BTreeMap::new();
        metadata.insert("spec_id", request.spec_id.clone());
        metadata.insert("file_key", request.file_key.clone());
        match &result {
            Ok((block_count, resolutions)) => {
                metadata.insert("block_count", block_count.to_string());
                metadata.insert("comment_count", resolutions.resolutions().len().to_string());
            }
            Err(error) => {
                metadata.insert("error", "true".to_string());
                metadata.insert("error_code", error.code().to_string());
            }
        }
        emit_span(context, end_span(metadata));
    }

    let (_block_count, resolutions) = result?;
    Ok(ListCommentsResponse::from(resolutions.into_resolutions()))
}

#[tauri::command]
pub fn add_comment(
    state: State<'_, CommandState>,
    request: AddCommentRequest,
) -> CommandResult<CommentResponse> {
    let anchor = request.anchor.into_domain()?;
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let comment = state
        .use_cases()
        .comment_use_cases(&workspace)
        .add_comment(&request.spec_id, anchor, request.body)?;

    Ok(CommentResponse::from(&comment))
}

#[tauri::command]
pub fn update_comment(
    state: State<'_, CommandState>,
    request: UpdateCommentRequest,
) -> CommandResult<CommentResponse> {
    let file_key = parse_file_key(&request.file_key)?;
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let comment = state
        .use_cases()
        .comment_use_cases(&workspace)
        .update_comment(
            &request.spec_id,
            file_key,
            &request.comment_id,
            request.body,
        )?;

    Ok(CommentResponse::from(&comment))
}

#[tauri::command]
pub fn delete_comment(
    state: State<'_, CommandState>,
    request: DeleteCommentRequest,
) -> CommandResult<DeleteCommentResponse> {
    let file_key = parse_file_key(&request.file_key)?;
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;

    state
        .use_cases()
        .comment_use_cases(&workspace)
        .delete_comment(&request.spec_id, file_key, &request.comment_id)?;

    Ok(DeleteCommentResponse { deleted: true })
}

#[tauri::command]
pub fn resolve_comment(
    state: State<'_, CommandState>,
    request: CommentStatusRequest,
) -> CommandResult<CommentResponse> {
    update_comment_status(state, request, CommentStatusAction::Resolve)
}

#[tauri::command]
pub fn reopen_comment(
    state: State<'_, CommandState>,
    request: CommentStatusRequest,
) -> CommandResult<CommentResponse> {
    update_comment_status(state, request, CommentStatusAction::Reopen)
}

#[tauri::command]
pub fn toggle_comment_resolved(
    state: State<'_, CommandState>,
    request: CommentStatusRequest,
) -> CommandResult<CommentResponse> {
    update_comment_status(state, request, CommentStatusAction::Toggle)
}

#[tauri::command]
pub fn export_comments(
    state: State<'_, CommandState>,
    request: ExportCommentsRequest,
) -> CommandResult<ExportCommentsResponse> {
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let target = request.target.into_domain()?;
    let result = state.use_cases().export_comments(
        &workspace,
        ExportCommentsInput::new(&request.workspace_path, target, &request.destination_path),
    )?;

    Ok(ExportCommentsResponse::from(result))
}

#[tauri::command]
pub fn generate_llm_prompt(
    state: State<'_, CommandState>,
    request: GenerateLlmPromptRequest,
) -> CommandResult<GenerateLlmPromptResponse> {
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let target = request.target.into_domain()?;
    let prompt = state.use_cases().generate_llm_prompt(
        &workspace,
        GenerateLlmPromptInput::new(&request.workspace_path, target),
    )?;

    Ok(GenerateLlmPromptResponse::from(prompt))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CommentStatusAction {
    Resolve,
    Reopen,
    Toggle,
}

fn update_comment_status(
    state: State<'_, CommandState>,
    request: CommentStatusRequest,
    action: CommentStatusAction,
) -> CommandResult<CommentResponse> {
    let file_key = parse_file_key(&request.file_key)?;
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let comment_use_cases = state.use_cases().comment_use_cases(&workspace);
    let comment = match action {
        CommentStatusAction::Resolve => {
            comment_use_cases.resolve_comment(&request.spec_id, file_key, &request.comment_id)?
        }
        CommentStatusAction::Reopen => {
            comment_use_cases.reopen_comment(&request.spec_id, file_key, &request.comment_id)?
        }
        CommentStatusAction::Toggle => comment_use_cases.toggle_comment_resolved(
            &request.spec_id,
            file_key,
            &request.comment_id,
        )?,
    };

    Ok(CommentResponse::from(&comment))
}

impl From<ExportCommentsError> for CommandError {
    fn from(error: ExportCommentsError) -> Self {
        match error {
            ExportCommentsError::UnknownSpec { .. }
            | ExportCommentsError::MissingDestinationPath => {
                Self::invalid_request(error.to_string())
            }
            ExportCommentsError::UseCase(source) => Self::from(source),
        }
    }
}
