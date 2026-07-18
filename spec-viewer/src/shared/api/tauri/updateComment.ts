import type { Comment } from "@/features/comments/domain/comment";
import type { UpdateCommentRequest } from "@/features/comments/types/comment";

import { invokeTauriCommand } from "./invokeTauriCommand";
import { isRecord } from "./isRecord";

export const UPDATE_COMMENT_COMMAND = "update_comment" as const;

export type UpdateCommentCommandName = typeof UPDATE_COMMENT_COMMAND;
export type UpdateCommentCommandRequest = UpdateCommentRequest;
export type UpdateCommentCommandResponse = Comment;
export type UpdateCommentCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "markdownRead"
  | "invalidComment"
  | "commentRepository"
  | "unexpected"
  | "unknown";

export type UpdateCommentCommandError = Readonly<{
  command: UpdateCommentCommandName;
  code: UpdateCommentCommandErrorCode;
  message: string;
  raw: unknown;
}>;

export type UpdateCommentCommandContract = Readonly<{
  name: UpdateCommentCommandName;
  request: UpdateCommentCommandRequest;
  response: UpdateCommentCommandResponse;
  error: UpdateCommentCommandError;
}>;

export const UpdateCommentCommandError = {
  /** @returns A command-specific update_comment error parsed from an unknown value. */
  fromUnknown(error: unknown): UpdateCommentCommandError {
    if (
      isRecord(error) &&
      error.command === UPDATE_COMMENT_COMMAND &&
      UpdateCommentCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: UPDATE_COMMENT_COMMAND,
        code: error.code,
        message: error.message,
        raw: error.raw,
      };
    }

    if (
      isRecord(error) &&
      UpdateCommentCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: UPDATE_COMMENT_COMMAND,
        code: error.code,
        message: error.message,
        raw: error,
      };
    }

    if (error instanceof Error) {
      return UpdateCommentCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return UpdateCommentCommandError.unknown(error, error);
    }

    return UpdateCommentCommandError.unknown(
      "Unknown update_comment failure",
      error,
    );
  },

  /** @returns An unknown update_comment command error preserving the raw payload. */
  unknown(message: string, raw: unknown): UpdateCommentCommandError {
    return {
      command: UPDATE_COMMENT_COMMAND,
      code: "unknown",
      message,
      raw,
    };
  },

  /** @returns True when the value is a update_comment command error code. */
  isCommandErrorCode(value: unknown): value is UpdateCommentCommandErrorCode {
    return UpdateCommentCommandError.isCode(value) || value === "unknown";
  },

  /** @returns True when the value is a known update_comment backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<UpdateCommentCommandErrorCode, "unknown"> {
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

/** @returns The updated comment after replacing its body. */
export async function updateComment(
  request: UpdateCommentRequest,
): Promise<UpdateCommentCommandResponse> {
  const commandRequest: UpdateCommentCommandRequest = request;

  return invokeTauriCommand<
    UpdateCommentCommandResponse,
    UpdateCommentCommandRequest,
    UpdateCommentCommandError
  >(
    UPDATE_COMMENT_COMMAND,
    commandRequest,
    UpdateCommentCommandError.fromUnknown,
  );
}
