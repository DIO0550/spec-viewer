import type { AddCommentCommandError } from "@/features/comments/infra/tauri/addComment";
import type { DeleteCommentCommandError } from "@/features/comments/infra/tauri/deleteComment";
import type { ExportCommentsCommandError } from "@/features/comments/infra/tauri/exportComments";
import type { GenerateLlmPromptCommandError } from "@/features/comments/infra/tauri/generateLlmPrompt";
import type { ListCommentsCommandError } from "@/features/comments/infra/tauri/listComments";
import type { ReopenCommentCommandError } from "@/features/comments/infra/tauri/reopenComment";
import type { ResolveCommentCommandError } from "@/features/comments/infra/tauri/resolveComment";
import type { ToggleCommentResolvedCommandError } from "@/features/comments/infra/tauri/toggleCommentResolved";
import type { UpdateCommentCommandError } from "@/features/comments/infra/tauri/updateComment";

export type CommentCommandError =
  | AddCommentCommandError
  | DeleteCommentCommandError
  | ExportCommentsCommandError
  | GenerateLlmPromptCommandError
  | ListCommentsCommandError
  | ReopenCommentCommandError
  | ResolveCommentCommandError
  | ToggleCommentResolvedCommandError
  | UpdateCommentCommandError;

export type CommentFeatureErrorCode =
  | "invalidComment"
  | "commentRepository"
  | "invalidRequest"
  | "unknown";

export type CommentFeatureError = Readonly<{
  feature: "comments";
  code: CommentFeatureErrorCode;
  message: string;
  cause: CommentCommandError;
}>;

export const CommentFeatureError = {
  /** @returns A feature-level comment error from any comment command error. */
  fromCommandError(error: CommentCommandError): CommentFeatureError {
    return {
      feature: "comments",
      code: CommentFeatureError.fromCommandErrorCode(error.code),
      message: error.message,
      cause: error,
    };
  },

  /** @returns A comment feature error code mapped from a transport command code. */
  fromCommandErrorCode(
    code: CommentCommandError["code"],
  ): CommentFeatureErrorCode {
    if (
      code === "invalidComment" ||
      code === "commentRepository" ||
      code === "invalidRequest"
    ) {
      return code;
    }

    return "unknown";
  },
} as const;

/** @deprecated Use CommentFeatureError for comment feature state. */
export type LegacyCommentOperationError = CommentFeatureError;
