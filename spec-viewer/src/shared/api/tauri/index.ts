import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open, save } from "@tauri-apps/plugin-dialog";
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
  ArchiveUserReviewRequest,
  ArchiveUserReviewResponse,
  CreateUserReviewRequest,
  CreateUserReviewResponse,
  ListUserReviewsRequest,
  ListUserReviewsResponse,
} from "@/features/review-runs/types/userReviewIpc";
import type {
  ArchiveSpecRequest,
  ArchiveSpecResponse,
  ReadSpecFileRequest,
  SpecDocument,
  SpecTree,
} from "@/features/specs/types/spec";
import type {
  StartSpecFileWatchRequest,
  StartSpecFileWatchResponse,
  StopSpecFileWatchResponse,
} from "@/features/specs/types/watch";
import type { Workspace } from "@/features/workspace/types/workspace";
import type {
  CommandError,
  CommandName,
  CommandRequest,
  CommandResponse,
  NormalizedCommandError,
} from "@/shared/types/ipc";

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
  /**
   * @param request - Spec file and status filter to query.
   * @returns Comment threads for the requested spec file.
   */
  listComments: (request: ListCommentsRequest) => Promise<ListCommentsResponse>;
  /**
   * @param request - New comment payload to persist.
   * @returns The newly persisted comment.
   */
  addComment: (request: AddCommentRequest) => Promise<Comment>;
  /**
   * @param request - Comment id and replacement body.
   * @returns The updated comment.
   */
  updateComment: (request: UpdateCommentRequest) => Promise<Comment>;
  /**
   * @param request - Comment id to delete.
   * @returns Delete confirmation for the requested comment.
   */
  deleteComment: (
    request: DeleteCommentRequest,
  ) => Promise<DeleteCommentResponse>;
  /**
   * @param request - Comment id to resolve.
   * @returns The comment after marking it resolved.
   */
  resolveComment: (request: CommentStatusRequest) => Promise<Comment>;
  /**
   * @param request - Comment id to reopen.
   * @returns The comment after reopening it.
   */
  reopenComment: (request: CommentStatusRequest) => Promise<Comment>;
  /**
   * @param request - Comment id whose resolved status to toggle.
   * @returns The comment after toggling its resolved status.
   */
  toggleCommentResolved: (request: CommentStatusRequest) => Promise<Comment>;
}>;

export type UserReviewCommands = Readonly<{
  /**
   * @param request - Review target and metadata for the new review run.
   * @returns Metadata for the created review run bundle.
   */
  createUserReview: (
    request: CreateUserReviewRequest,
  ) => Promise<CreateUserReviewResponse>;
  /**
   * @param request - Review target to list runs for.
   * @returns Active and archived review runs for the target.
   */
  listUserReviews: (
    request: ListUserReviewsRequest,
  ) => Promise<ListUserReviewsResponse>;
  /**
   * @param request - Review run to archive.
   * @returns Metadata for the archived review run.
   */
  archiveUserReview: (
    request: ArchiveUserReviewRequest,
  ) => Promise<ArchiveUserReviewResponse>;
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

/**
 * @param handler - Receives each native drag-and-drop lifecycle event.
 * @returns An unlisten function for native Tauri workspace drag-and-drop events.
 */
export async function subscribeWorkspaceDragDropEvents(
  /** @param event - Native drag-and-drop lifecycle event payload. */
  handler: (event: WorkspaceDragDropEvent) => void,
): Promise<() => void> {
  return getCurrentWebview().onDragDropEvent((event) => {
    handler(event.payload as WorkspaceDragDropEvent);
  });
}

/**
 * @param workspacePath - Absolute path of the workspace to scan.
 * @returns Spec tree for the workspace path.
 */
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

/**
 * @param request - New comment payload to persist.
 * @returns The newly persisted comment.
 */
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
export async function createUserReview(
  request: CreateUserReviewRequest,
): Promise<CreateUserReviewResponse> {
  return invokeCommand("create_user_review", request);
}

/** @returns Active and archived review runs for the selected review target. */
export async function listUserReviews(
  request: ListUserReviewsRequest,
): Promise<ListUserReviewsResponse> {
  return invokeCommand("list_user_reviews", request);
}

/** @returns Metadata for the archived review run after moving it out of active. */
export async function archiveUserReview(
  request: ArchiveUserReviewRequest,
): Promise<ArchiveUserReviewResponse> {
  return invokeCommand("archive_user_review", request);
}

export const userReviewCommands: UserReviewCommands = {
  createUserReview,
  listUserReviews,
  archiveUserReview,
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

/**
 * @param error - Unknown error thrown from an IPC command.
 * @returns A stable command error shape for UI state and messages.
 */
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

/**
 * @param error - Unknown value to test.
 * @returns True when an unknown value matches the backend CommandError DTO.
 */
function isCommandError(error: unknown): error is CommandError {
  if (!isRecord(error)) {
    return false;
  }

  return isCommandErrorCode(error.code) && typeof error.message === "string";
}

/**
 * @param value - Unknown value to test.
 * @returns True when an unknown value is a non-null object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * @param value - Unknown value to test.
 * @returns True when an unknown value is a known backend command error code.
 */
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
    value === "userReviewExport" ||
    value === "fileWatch"
  );
}

/**
 * @param target - Export scope and identifiers for the comment export.
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

/**
 * @param value - Raw identifier to sanitize for use in a file name.
 * @returns A file-system-safe path component for save dialog defaults.
 */
function sanitizeExportPathPart(value: string): string {
  const sanitized = value.trim().replace(/[^A-Za-z0-9._-]+/g, "-");

  if (sanitized.length === 0) {
    return COMMENT_EXPORT_DEFAULT_SPEC_ID;
  }

  return sanitized;
}
