import type { AddCommentCommandError } from "@/shared/api/tauri/addComment";
import type { DeleteCommentCommandError } from "@/shared/api/tauri/deleteComment";
import type { ExportCommentsCommandError } from "@/shared/api/tauri/exportComments";
import type { GenerateLlmPromptCommandError } from "@/shared/api/tauri/generateLlmPrompt";
import type { ListCommentsCommandError } from "@/shared/api/tauri/listComments";
import type { ReopenCommentCommandError } from "@/shared/api/tauri/reopenComment";
import type { ResolveCommentCommandError } from "@/shared/api/tauri/resolveComment";
import type { UpdateCommentCommandError } from "@/shared/api/tauri/updateComment";

export type CommentCommandError =
  | AddCommentCommandError
  | DeleteCommentCommandError
  | ExportCommentsCommandError
  | GenerateLlmPromptCommandError
  | ListCommentsCommandError
  | ReopenCommentCommandError
  | ResolveCommentCommandError
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
