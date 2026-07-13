import type {
  Comment,
  UpdateCommentRequest,
} from "@/features/comments/types/comment";
import {
  decodeUpdateCommentResponse,
  encodeUpdateCommentRequest,
} from "@/features/comments/infra/tauri/commentIpcCodec";

import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";
import { isRecord } from "@/shared/lib/isRecord";

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
  | "invalidResponse"
  | "unknown";

export type UpdateCommentCommandError = Readonly<{
  command: UpdateCommentCommandName;
  code: UpdateCommentCommandErrorCode;
  message: string;
  cause: unknown;
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
        cause: "cause" in error ? error.cause : error,
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
        cause: error,
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

  /** @returns An unknown update_comment command error preserving the cause payload. */
  unknown(message: string, cause: unknown): UpdateCommentCommandError {
    return {
      command: UPDATE_COMMENT_COMMAND,
      code: "unknown",
      message,
      cause,
    };
  },

  /** @returns True when the value is a update_comment command error code. */
  isCommandErrorCode(value: unknown): value is UpdateCommentCommandErrorCode {
    return (
      UpdateCommentCommandError.isCode(value) ||
      value === "invalidResponse" ||
      value === "unknown"
    );
  },

  /** @returns True when the value is a known update_comment backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<
    UpdateCommentCommandErrorCode,
    "unknown" | "invalidResponse"
  > {
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
    ReturnType<typeof encodeUpdateCommentRequest>,
    UpdateCommentCommandError
  >(
    UPDATE_COMMENT_COMMAND,
    encodeUpdateCommentRequest(commandRequest),
    UpdateCommentCommandError.fromUnknown,
    decodeUpdateCommentResponse,
  );
}
