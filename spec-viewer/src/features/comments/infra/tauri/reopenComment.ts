import type {
  Comment,
  CommentStatusRequest,
} from "@/features/comments/types/comment";
import {
  decodeReopenCommentResponse,
  encodeCommentStatusRequest,
} from "@/features/comments/infra/tauri/commentIpcCodec";

import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";
import { isRecord } from "@/shared/lib/isRecord";

export const REOPEN_COMMENT_COMMAND = "reopen_comment" as const;

export type ReopenCommentCommandName = typeof REOPEN_COMMENT_COMMAND;
export type ReopenCommentCommandRequest = CommentStatusRequest;
export type ReopenCommentCommandResponse = Comment;
export type ReopenCommentCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "markdownRead"
  | "invalidComment"
  | "commentRepository"
  | "unexpected"
  | "invalidResponse"
  | "unknown";

export type ReopenCommentCommandError = Readonly<{
  command: ReopenCommentCommandName;
  code: ReopenCommentCommandErrorCode;
  message: string;
  cause: unknown;
}>;

export type ReopenCommentCommandContract = Readonly<{
  name: ReopenCommentCommandName;
  request: ReopenCommentCommandRequest;
  response: ReopenCommentCommandResponse;
  error: ReopenCommentCommandError;
}>;

export const ReopenCommentCommandError = {
  /** @returns A command-specific reopen_comment error parsed from an unknown value. */
  fromUnknown(error: unknown): ReopenCommentCommandError {
    if (
      isRecord(error) &&
      error.command === REOPEN_COMMENT_COMMAND &&
      ReopenCommentCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: REOPEN_COMMENT_COMMAND,
        code: error.code,
        message: error.message,
        cause: "cause" in error ? error.cause : error,
      };
    }

    if (
      isRecord(error) &&
      ReopenCommentCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: REOPEN_COMMENT_COMMAND,
        code: error.code,
        message: error.message,
        cause: error,
      };
    }

    if (error instanceof Error) {
      return ReopenCommentCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return ReopenCommentCommandError.unknown(error, error);
    }

    return ReopenCommentCommandError.unknown(
      "Unknown reopen_comment failure",
      error,
    );
  },

  /** @returns An unknown reopen_comment command error preserving the cause payload. */
  unknown(message: string, cause: unknown): ReopenCommentCommandError {
    return {
      command: REOPEN_COMMENT_COMMAND,
      code: "unknown",
      message,
      cause,
    };
  },

  /** @returns True when the value is a reopen_comment command error code. */
  isCommandErrorCode(value: unknown): value is ReopenCommentCommandErrorCode {
    return (
      ReopenCommentCommandError.isCode(value) ||
      value === "invalidResponse" ||
      value === "unknown"
    );
  },

  /** @returns True when the value is a known reopen_comment backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<
    ReopenCommentCommandErrorCode,
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

/** @returns The comment after reopening it. */
export async function reopenComment(
  request: CommentStatusRequest,
): Promise<ReopenCommentCommandResponse> {
  const commandRequest: ReopenCommentCommandRequest = request;

  return invokeTauriCommand<
    ReopenCommentCommandResponse,
    ReturnType<typeof encodeCommentStatusRequest>,
    ReopenCommentCommandError
  >(
    REOPEN_COMMENT_COMMAND,
    encodeCommentStatusRequest(commandRequest),
    ReopenCommentCommandError.fromUnknown,
    decodeReopenCommentResponse,
  );
}
