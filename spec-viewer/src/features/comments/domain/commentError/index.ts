import type { AddCommentCommandError } from "@/lib/api/tauri/addComment";
import type { DeleteCommentCommandError } from "@/lib/api/tauri/deleteComment";
import type { ExportCommentsCommandError } from "@/lib/api/tauri/exportComments";
import type { GenerateLlmPromptCommandError } from "@/lib/api/tauri/generateLlmPrompt";
import type { ListCommentsCommandError } from "@/lib/api/tauri/listComments";
import type { ReopenCommentCommandError } from "@/lib/api/tauri/reopenComment";
import type { ResolveCommentCommandError } from "@/lib/api/tauri/resolveComment";
import type { UpdateCommentCommandError } from "@/lib/api/tauri/updateComment";

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
