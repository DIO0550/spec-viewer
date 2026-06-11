import { save } from "@tauri-apps/plugin-dialog";

import type {
  AddCommentRequest,
  Comment,
  CommentStatusRequest,
  DeleteCommentRequest,
  DeleteCommentResponse,
  ExportCommentsRequest,
  ExportCommentsResponse,
  ExportCommentsTarget,
  GenerateLlmPromptRequest,
  GenerateLlmPromptResponse,
  ListCommentsRequest,
  ListCommentsResponse,
  UpdateCommentRequest,
} from "@/features/comments/types/comment";

import { invokeCommand } from "./invokeCommand";

const COMMENT_EXPORT_DEFAULT_SPEC_ID = "spec";

export type CommentCommands = Readonly<{
  listComments: (request: ListCommentsRequest) => Promise<ListCommentsResponse>;
  addComment: (request: AddCommentRequest) => Promise<Comment>;
  updateComment: (request: UpdateCommentRequest) => Promise<Comment>;
  deleteComment: (
    request: DeleteCommentRequest,
  ) => Promise<DeleteCommentResponse>;
  resolveComment: (request: CommentStatusRequest) => Promise<Comment>;
  reopenComment: (request: CommentStatusRequest) => Promise<Comment>;
  toggleCommentResolved: (request: CommentStatusRequest) => Promise<Comment>;
}>;

/**
 * @param request - Spec file scope and status filter.
 * @returns Comment threads for the requested spec file and status filter.
 */
export async function listComments(
  request: ListCommentsRequest,
): Promise<ListCommentsResponse> {
  return invokeCommand("list_comments", request);
}

/**
 * @param request - Anchor and body for the new comment.
 * @returns The newly persisted comment.
 */
export async function addComment(request: AddCommentRequest): Promise<Comment> {
  return invokeCommand("add_comment", request);
}

/**
 * @param request - Comment id and replacement body.
 * @returns The updated comment after replacing its body.
 */
export async function updateComment(
  request: UpdateCommentRequest,
): Promise<Comment> {
  return invokeCommand("update_comment", request);
}

/**
 * @param request - Comment id to delete.
 * @returns Delete confirmation for the requested comment.
 */
export async function deleteComment(
  request: DeleteCommentRequest,
): Promise<DeleteCommentResponse> {
  return invokeCommand("delete_comment", request);
}

/**
 * @param request - Comment id to resolve.
 * @returns The comment after marking it resolved.
 */
export async function resolveComment(
  request: CommentStatusRequest,
): Promise<Comment> {
  return invokeCommand("resolve_comment", request);
}

/**
 * @param request - Comment id to reopen.
 * @returns The comment after reopening it.
 */
export async function reopenComment(
  request: CommentStatusRequest,
): Promise<Comment> {
  return invokeCommand("reopen_comment", request);
}

/**
 * @param request - Comment id to toggle.
 * @returns The comment after toggling its resolved status.
 */
export async function toggleCommentResolved(
  request: CommentStatusRequest,
): Promise<Comment> {
  return invokeCommand("toggle_comment_resolved", request);
}

/**
 * @param request - Export target and destination path.
 * @returns Metadata for the comment export written by the backend.
 */
export async function exportComments(
  request: ExportCommentsRequest,
): Promise<ExportCommentsResponse> {
  return invokeCommand("export_comments", request);
}

/**
 * @param request - Prompt generation scope.
 * @returns A Markdown prompt bundle suitable for copying into an LLM chat.
 */
export async function generateLlmPrompt(
  request: GenerateLlmPromptRequest,
): Promise<GenerateLlmPromptResponse> {
  return invokeCommand("generate_llm_prompt", request);
}

/**
 * @param target - Requested comment export target.
 * @returns A destination path for the requested comment export, or null.
 */
export async function selectCommentExportDestination(
  target: ExportCommentsTarget,
): Promise<string | null> {
  const options = createCommentExportDialogOptions(target);

  return save(options);
}

export const commentCommands: CommentCommands = {
  listComments,
  addComment,
  updateComment,
  deleteComment,
  resolveComment,
  reopenComment,
  toggleCommentResolved,
};

/**
 * @param target - Requested comment export target.
 * @returns Native save dialog options for the requested comment export target.
 */
function createCommentExportDialogOptions(target: ExportCommentsTarget) {
  const fileName = createCommentExportDefaultFileName(target);
  const isJsonExport = target.scope === "workspace";

  return {
    title: "Export comments",
    defaultPath: fileName,
    filters: [
      {
        name: isJsonExport ? "JSON" : "Markdown",
        extensions: [isJsonExport ? "json" : "md"],
      },
    ],
  };
}

/**
 * @param target - Requested comment export target.
 * @returns A safe default file name for a comment export.
 */
function createCommentExportDefaultFileName(
  target: ExportCommentsTarget,
): string {
  if (target.scope === "workspace") {
    return "workspace-comments.json";
  }

  const specId = sanitizeExportPathPart(target.specId);

  if (target.scope === "spec") {
    return `${specId}-comments.md`;
  }

  return `${specId}-${target.fileKey}-comments.md`;
}

/**
 * @param value - Raw path component candidate.
 * @returns A file-system-safe path component for save dialog defaults.
 */
function sanitizeExportPathPart(value: string): string {
  const sanitized = value.trim().replace(/[^A-Za-z0-9._-]+/g, "-");

  if (sanitized.length === 0) {
    return COMMENT_EXPORT_DEFAULT_SPEC_ID;
  }

  return sanitized;
}
