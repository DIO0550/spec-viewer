import type {
  DeleteCommentRequest,
  DeleteCommentResponse,
} from "@/features/comments/types/comment";

import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";
import { isRecord } from "@/shared/lib/isRecord";

export const DELETE_COMMENT_COMMAND = "delete_comment" as const;

export type DeleteCommentCommandName = typeof DELETE_COMMENT_COMMAND;
export type DeleteCommentCommandRequest = DeleteCommentRequest;
export type DeleteCommentCommandResponse = DeleteCommentResponse;
export type DeleteCommentCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "markdownRead"
  | "invalidComment"
  | "commentRepository"
  | "unexpected"
  | "unknown";

export type DeleteCommentCommandError = Readonly<{
  command: DeleteCommentCommandName;
  code: DeleteCommentCommandErrorCode;
  message: string;
  raw: unknown;
}>;

export type DeleteCommentCommandContract = Readonly<{
  name: DeleteCommentCommandName;
  request: DeleteCommentCommandRequest;
  response: DeleteCommentCommandResponse;
  error: DeleteCommentCommandError;
}>;

export const DeleteCommentCommandError = {
  /** @returns A command-specific delete_comment error parsed from an unknown value. */
  fromUnknown(error: unknown): DeleteCommentCommandError {
    if (
      isRecord(error) &&
      error.command === DELETE_COMMENT_COMMAND &&
      DeleteCommentCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: DELETE_COMMENT_COMMAND,
        code: error.code,
        message: error.message,
        raw: error.raw,
      };
    }

    if (
      isRecord(error) &&
      DeleteCommentCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: DELETE_COMMENT_COMMAND,
        code: error.code,
        message: error.message,
        raw: error,
      };
    }

    if (error instanceof Error) {
      return DeleteCommentCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return DeleteCommentCommandError.unknown(error, error);
    }

    return DeleteCommentCommandError.unknown(
      "Unknown delete_comment failure",
      error,
    );
  },

  /** @returns An unknown delete_comment command error preserving the raw payload. */
  unknown(message: string, raw: unknown): DeleteCommentCommandError {
    return {
      command: DELETE_COMMENT_COMMAND,
      code: "unknown",
      message,
      raw,
    };
  },

  /** @returns True when the value is a delete_comment command error code. */
  isCommandErrorCode(value: unknown): value is DeleteCommentCommandErrorCode {
    return DeleteCommentCommandError.isCode(value) || value === "unknown";
  },

  /** @returns True when the value is a known delete_comment backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<DeleteCommentCommandErrorCode, "unknown"> {
    return (
      value === "invalidRequest" ||
      value === "workspaceDetection" ||
      value === "configLoad" ||
      value === "markdownRead" ||
      value === "invalidComment" ||
      value === "commentRepository" ||
      value === "unexpected"
    );
  },
} as const;

/** @returns Delete confirmation for the requested comment. */
export async function deleteComment(
  request: DeleteCommentRequest,
): Promise<DeleteCommentCommandResponse> {
  const commandRequest: DeleteCommentCommandRequest = request;

  return invokeTauriCommand<
    DeleteCommentCommandResponse,
    DeleteCommentCommandRequest,
    DeleteCommentCommandError
  >(
    DELETE_COMMENT_COMMAND,
    commandRequest,
    DeleteCommentCommandError.fromUnknown,
  );
}
