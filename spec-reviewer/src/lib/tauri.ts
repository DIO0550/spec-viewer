import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import type {
  CommandError,
  CommandName,
  CommandRequest,
  CommandResponse,
  NormalizedCommandError,
} from "../types/ipc";
import type {
  AddCommentRequest,
  Comment,
  CommentStatusRequest,
  DeleteCommentRequest,
  DeleteCommentResponse,
  ListCommentsRequest,
  ListCommentsResponse,
  UpdateCommentRequest,
} from "../types/comment";
import type {
  ReadSpecFileRequest,
  SpecDocument,
  SpecTree,
} from "../types/spec";
import type { Workspace } from "../types/workspace";

const UNKNOWN_COMMAND_ERROR_MESSAGE = "Unknown IPC command failure";

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

/** @returns The directory selected from the native workspace picker, or null. */
export async function selectWorkspaceDirectory(): Promise<string | null> {
  return open({
    directory: true,
    multiple: false,
    title: "Open workspace",
  });
}

/** @returns Loaded workspace metadata for the selected directory. */
export async function loadWorkspace(
  selectedDirectory: string,
): Promise<Workspace> {
  return invokeCommand("load_workspace", { selectedDirectory });
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
    value === "markdownRead" ||
    value === "invalidSpec" ||
    value === "invalidComment" ||
    value === "commentRepository"
  );
}
