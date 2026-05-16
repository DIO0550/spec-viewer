import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import type {
  CommandError,
  CommandName,
  CommandRequest,
  CommandResponse,
  NormalizedCommandError,
} from "@/shared/types/ipc";
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
import type {
  ArchiveSpecRequest,
  ArchiveSpecResponse,
  ReadSpecFileRequest,
  SpecDocument,
  SpecTree,
} from "@/features/specs/types/spec";
import type {
  CreateReviewRunRequest,
  CreateReviewRunResponse,
  ArchiveReviewRunRequest,
  ArchiveReviewRunResponse,
  ListReviewRunsRequest,
  ListReviewRunsResponse,
} from "@/features/review-runs/types/reviewRun";
import type {
  StartSpecFileWatchRequest,
  StartSpecFileWatchResponse,
  StopSpecFileWatchResponse,
} from "@/features/specs/types/watch";
import type { Workspace } from "@/features/workspace/types/workspace";

const UNKNOWN_COMMAND_ERROR_MESSAGE = "Unknown IPC command failure";
const COMMENT_EXPORT_DEFAULT_SPEC_ID = "spec";

export type WorkspaceDragDropEvent =
  | Readonly<{
      type: "enter";
      paths: readonly string[];
    }>
  | Readonly<{
      type: "over";
    }>
  | Readonly<{
      type: "drop";
      paths: readonly string[];
    }>
  | Readonly<{
      type: "leave";
    }>;

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

export type ReviewRunCommands = Readonly<{
  createReviewRun: (
    request: CreateReviewRunRequest,
  ) => Promise<CreateReviewRunResponse>;
  listReviewRuns: (
    request: ListReviewRunsRequest,
  ) => Promise<ListReviewRunsResponse>;
  archiveReviewRun: (
    request: ArchiveReviewRunRequest,
  ) => Promise<ArchiveReviewRunResponse>;
}>;

/** @returns The directory selected from the native workspace picker, or null. */
export async function selectWorkspaceDirectory(): Promise<string | null> {
  return open({
    directory: true,
    multiple: false,
    title: "Open workspace",
  });
}

/** @returns A destination path for the requested comment export, or null. */
export async function selectCommentExportDestination(
  target: ExportCommentsTarget,
): Promise<string | null> {
  const options = createCommentExportDialogOptions(target);

  return save(options);
}

/** @returns Loaded workspace metadata for the selected directory. */
export async function loadWorkspace(
  selectedDirectory: string,
): Promise<Workspace> {
  return invokeCommand("load_workspace", { selectedDirectory });
}

/** @returns Whether the given path points to an existing directory. */
export async function validateWorkspaceDirectory(
  path: string,
): Promise<Readonly<{ isDirectory: boolean }>> {
  return invokeCommand("validate_workspace_directory", { path });
}

/** @returns An unlisten function for native Tauri workspace drag-and-drop events. */
export async function subscribeWorkspaceDragDropEvents(
  handler: (event: WorkspaceDragDropEvent) => void,
): Promise<() => void> {
  return getCurrentWebview().onDragDropEvent((event) => {
    handler(event.payload as WorkspaceDragDropEvent);
  });
}

/** @returns Spec tree for the workspace path. */
export async function listSpecs(workspacePath: string): Promise<SpecTree> {
  return invokeCommand("list_specs", { workspacePath });
}

/** @returns Markdown contents or missing-file metadata for a spec file. */
export async function readSpecFile(
  request: ReadSpecFileRequest,
): Promise<SpecDocument> {
  return invokeCommand("read_spec_file", request);
}

/** @returns Metadata for the spec directory moved into the workspace archive. */
export async function archiveSpec(
  request: ArchiveSpecRequest,
): Promise<ArchiveSpecResponse> {
  return invokeCommand("archive_spec", request);
}

/** @returns Backend watcher registration metadata for the selected spec file. */
export async function startSpecFileWatch(
  request: StartSpecFileWatchRequest,
): Promise<StartSpecFileWatchResponse> {
  return invokeCommand("start_spec_file_watch", request);
}

/** @returns Confirmation that the active backend watcher was stopped. */
export async function stopSpecFileWatch(): Promise<StopSpecFileWatchResponse> {
  return invokeCommand("stop_spec_file_watch", {});
}

/** @returns Comment threads for the requested spec file and status filter. */
export async function listComments(
  request: ListCommentsRequest,
): Promise<ListCommentsResponse> {
  return invokeCommand("list_comments", request);
}

/** @returns The newly persisted comment. */
export async function addComment(request: AddCommentRequest): Promise<Comment> {
  return invokeCommand("add_comment", request);
}

/** @returns The updated comment after replacing its body. */
export async function updateComment(
  request: UpdateCommentRequest,
): Promise<Comment> {
  return invokeCommand("update_comment", request);
}

/** @returns Delete confirmation for the requested comment. */
export async function deleteComment(
  request: DeleteCommentRequest,
): Promise<DeleteCommentResponse> {
  return invokeCommand("delete_comment", request);
}

/** @returns The comment after marking it resolved. */
export async function resolveComment(
  request: CommentStatusRequest,
): Promise<Comment> {
  return invokeCommand("resolve_comment", request);
}

/** @returns The comment after reopening it. */
export async function reopenComment(
  request: CommentStatusRequest,
): Promise<Comment> {
  return invokeCommand("reopen_comment", request);
}

/** @returns The comment after toggling its resolved status. */
export async function toggleCommentResolved(
  request: CommentStatusRequest,
): Promise<Comment> {
  return invokeCommand("toggle_comment_resolved", request);
}

/** @returns Metadata for the comment export written by the backend. */
export async function exportComments(
  request: ExportCommentsRequest,
): Promise<ExportCommentsResponse> {
  return invokeCommand("export_comments", request);
}

/** @returns A Markdown prompt bundle suitable for copying into an LLM chat. */
export async function generateLlmPrompt(
  request: GenerateLlmPromptRequest,
): Promise<GenerateLlmPromptResponse> {
  return invokeCommand("generate_llm_prompt", request);
}

/** @returns Metadata for the active review run bundle created by the backend. */
export async function createReviewRun(
  request: CreateReviewRunRequest,
): Promise<CreateReviewRunResponse> {
  return invokeCommand("create_review_run", request);
}

/** @returns Active and archived review runs for the selected review target. */
export async function listReviewRuns(
  request: ListReviewRunsRequest,
): Promise<ListReviewRunsResponse> {
  return invokeCommand("list_review_runs", request);
}

/** @returns Metadata for the archived review run after moving it out of active. */
export async function archiveReviewRun(
  request: ArchiveReviewRunRequest,
): Promise<ArchiveReviewRunResponse> {
  return invokeCommand("archive_review_run", request);
}

export const reviewRunCommands: ReviewRunCommands = {
  createReviewRun,
  listReviewRuns,
  archiveReviewRun,
};

export const commentCommands: CommentCommands = {
  listComments,
  addComment,
  updateComment,
  deleteComment,
  resolveComment,
  reopenComment,
  toggleCommentResolved,
};

/** @returns A stable command error shape for UI state and messages. */
export function normalizeCommandError(error: unknown): NormalizedCommandError {
  if (isCommandError(error)) {
    return {
      code: error.code,
      message: error.message,
      raw: error,
    };
  }

  if (error instanceof Error) {
    return {
      code: "unknown",
      message: error.message,
      raw: error,
    };
  }

  if (typeof error === "string") {
    return {
      code: "unknown",
      message: error,
      raw: error,
    };
  }

  return {
    code: "unknown",
    message: UNKNOWN_COMMAND_ERROR_MESSAGE,
    raw: error,
  };
}

/** @returns The typed response from the named Tauri command. */
async function invokeCommand<Name extends CommandName>(
  name: Name,
  request: CommandRequest<Name>,
): Promise<CommandResponse<Name>> {
  try {
    return await invoke<CommandResponse<Name>>(name, { request });
  } catch (error) {
    throw normalizeCommandError(error);
  }
}

/** @returns True when an unknown value matches the backend CommandError DTO. */
function isCommandError(error: unknown): error is CommandError {
  if (!isRecord(error)) {
    return false;
  }

  return isCommandErrorCode(error.code) && typeof error.message === "string";
}

/** @returns True when an unknown value is a non-null object record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** @returns True when an unknown value is a known backend command error code. */
function isCommandErrorCode(value: unknown): value is CommandError["code"] {
  return (
    value === "invalidRequest" ||
    value === "workspaceDetection" ||
    value === "configLoad" ||
    value === "specTreeScan" ||
    value === "specArchive" ||
    value === "markdownRead" ||
    value === "invalidSpec" ||
    value === "invalidComment" ||
    value === "commentRepository" ||
    value === "reviewRunExport" ||
    value === "fileWatch"
  );
}

/** @returns Native save dialog options for the requested comment export target. */
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

/** @returns A safe default file name for a comment export. */
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

/** @returns A file-system-safe path component for save dialog defaults. */
function sanitizeExportPathPart(value: string): string {
  const sanitized = value.trim().replace(/[^A-Za-z0-9._-]+/g, "-");

  if (sanitized.length === 0) {
    return COMMENT_EXPORT_DEFAULT_SPEC_ID;
  }

  return sanitized;
}
