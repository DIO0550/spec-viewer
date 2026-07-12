import type {
  CommentFeatureError,
  CommentFeatureErrorCode,
} from "@/features/comments/application/commentError";
import type { CommentErrorReason } from "@/features/comments/domain/commentError";
import {
  AddCommentCommandError,
  type AddCommentCommandError as AddCommentCommandErrorType,
} from "@/features/comments/infra/tauri/addComment";
import {
  DeleteCommentCommandError,
  type DeleteCommentCommandError as DeleteCommentCommandErrorType,
} from "@/features/comments/infra/tauri/deleteComment";
import {
  ExportCommentsCommandError,
  type ExportCommentsCommandError as ExportCommentsCommandErrorType,
} from "@/features/comments/infra/tauri/exportComments";
import {
  GenerateLlmPromptCommandError,
  type GenerateLlmPromptCommandError as GenerateLlmPromptCommandErrorType,
} from "@/features/comments/infra/tauri/generateLlmPrompt";
import {
  ListCommentsCommandError,
  type ListCommentsCommandError as ListCommentsCommandErrorType,
} from "@/features/comments/infra/tauri/listComments";
import {
  ReopenCommentCommandError,
  type ReopenCommentCommandError as ReopenCommentCommandErrorType,
} from "@/features/comments/infra/tauri/reopenComment";
import {
  ResolveCommentCommandError,
  type ResolveCommentCommandError as ResolveCommentCommandErrorType,
} from "@/features/comments/infra/tauri/resolveComment";
import {
  ToggleCommentResolvedCommandError,
  type ToggleCommentResolvedCommandError as ToggleCommentResolvedCommandErrorType,
} from "@/features/comments/infra/tauri/toggleCommentResolved";
import {
  UpdateCommentCommandError,
  type UpdateCommentCommandError as UpdateCommentCommandErrorType,
} from "@/features/comments/infra/tauri/updateComment";

export type CommentErrorOperation =
  | "add"
  | "update"
  | "delete"
  | "resolve"
  | "reopen"
  | "toggle"
  | "list"
  | "export"
  | "generatePrompt";

type CommentCommandError =
  | AddCommentCommandErrorType
  | UpdateCommentCommandErrorType
  | DeleteCommentCommandErrorType
  | ResolveCommentCommandErrorType
  | ReopenCommentCommandErrorType
  | ToggleCommentResolvedCommandErrorType
  | ListCommentsCommandErrorType
  | ExportCommentsCommandErrorType
  | GenerateLlmPromptCommandErrorType;

/**
 * @param operation - Comment command that rejected.
 * @param error - Unknown value rejected by the command boundary.
 * @returns Application error with a pure domain reason and stable display contract.
 */
export function toCommentFeatureError(
  operation: CommentErrorOperation,
  error: unknown,
): CommentFeatureError {
  const cause = toCommentCommandError(operation, error);
  const mapping = toCommentErrorMapping(cause.code);

  return {
    feature: "comments",
    code: mapping.code,
    message: cause.message,
    domainError: { reason: mapping.reason },
    cause,
  };
}

/**
 * @param operation - Comment command that rejected.
 * @param error - Unknown value rejected by the command boundary.
 * @returns The command-specific infrastructure error for a rejected operation.
 */
function toCommentCommandError(
  operation: CommentErrorOperation,
  error: unknown,
): CommentCommandError {
  switch (operation) {
    case "add":
      return AddCommentCommandError.fromUnknown(error);
    case "update":
      return UpdateCommentCommandError.fromUnknown(error);
    case "delete":
      return DeleteCommentCommandError.fromUnknown(error);
    case "resolve":
      return ResolveCommentCommandError.fromUnknown(error);
    case "reopen":
      return ReopenCommentCommandError.fromUnknown(error);
    case "toggle":
      return ToggleCommentResolvedCommandError.fromUnknown(error);
    case "list":
      return ListCommentsCommandError.fromUnknown(error);
    case "export":
      return ExportCommentsCommandError.fromUnknown(error);
    case "generatePrompt":
      return GenerateLlmPromptCommandError.fromUnknown(error);
  }
}

/**
 * @param code - Parsed comment command error code.
 * @returns Domain reason and display code for a comment command error code.
 */
function toCommentErrorMapping(
  code: CommentCommandError["code"],
): Readonly<{ code: CommentFeatureErrorCode; reason: CommentErrorReason }> {
  if (code === "invalidComment") {
    return { code, reason: "commentRejected" };
  }
  if (code === "commentRepository") {
    return { code, reason: "commentPersistenceFailed" };
  }
  if (code === "invalidRequest") {
    return { code, reason: "requestRejected" };
  }
  return { code: "unknown", reason: "unexpectedFailure" };
}
