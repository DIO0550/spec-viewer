import type {
  Comment,
  CommentStatusRequest,
} from "@/features/comments/types/comment";

import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";
import { isRecord } from "@/shared/lib/isRecord";

export const TOGGLE_COMMENT_RESOLVED_COMMAND =
  "toggle_comment_resolved" as const;

export type ToggleCommentResolvedCommandName =
  typeof TOGGLE_COMMENT_RESOLVED_COMMAND;
export type ToggleCommentResolvedCommandRequest = CommentStatusRequest;
export type ToggleCommentResolvedCommandResponse = Comment;
export type ToggleCommentResolvedCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "markdownRead"
  | "invalidComment"
  | "commentRepository"
  | "unexpected"
  | "unknown";

export type ToggleCommentResolvedCommandError = Readonly<{
  command: ToggleCommentResolvedCommandName;
  code: ToggleCommentResolvedCommandErrorCode;
  message: string;
  raw: unknown;
}>;

export type ToggleCommentResolvedCommandContract = Readonly<{
  name: ToggleCommentResolvedCommandName;
  request: ToggleCommentResolvedCommandRequest;
  response: ToggleCommentResolvedCommandResponse;
  error: ToggleCommentResolvedCommandError;
}>;

export const ToggleCommentResolvedCommandError = {
  /** @returns A command-specific toggle_comment_resolved error parsed from an unknown value. */
  fromUnknown(error: unknown): ToggleCommentResolvedCommandError {
    if (
      isRecord(error) &&
      error.command === TOGGLE_COMMENT_RESOLVED_COMMAND &&
      ToggleCommentResolvedCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: TOGGLE_COMMENT_RESOLVED_COMMAND,
        code: error.code,
        message: error.message,
        raw: error.raw,
      };
    }

    if (
      isRecord(error) &&
      ToggleCommentResolvedCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: TOGGLE_COMMENT_RESOLVED_COMMAND,
        code: error.code,
        message: error.message,
        raw: error,
      };
    }

    if (error instanceof Error) {
      return ToggleCommentResolvedCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return ToggleCommentResolvedCommandError.unknown(error, error);
    }

    return ToggleCommentResolvedCommandError.unknown(
      "Unknown toggle_comment_resolved failure",
      error,
    );
  },

  /** @returns An unknown toggle_comment_resolved command error preserving the raw payload. */
  unknown(message: string, raw: unknown): ToggleCommentResolvedCommandError {
    return {
      command: TOGGLE_COMMENT_RESOLVED_COMMAND,
      code: "unknown",
      message,
      raw,
    };
  },

  /** @returns True when the value is a toggle_comment_resolved command error code. */
  isCommandErrorCode(
    value: unknown,
  ): value is ToggleCommentResolvedCommandErrorCode {
    return (
      ToggleCommentResolvedCommandError.isCode(value) || value === "unknown"
    );
  },

  /** @returns True when the value is a known toggle_comment_resolved backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<ToggleCommentResolvedCommandErrorCode, "unknown"> {
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

/** @returns The comment after toggling its resolved status. */
export async function toggleCommentResolved(
  request: CommentStatusRequest,
): Promise<ToggleCommentResolvedCommandResponse> {
  const commandRequest: ToggleCommentResolvedCommandRequest = request;

  return invokeTauriCommand<
    ToggleCommentResolvedCommandResponse,
    ToggleCommentResolvedCommandRequest,
    ToggleCommentResolvedCommandError
  >(
    TOGGLE_COMMENT_RESOLVED_COMMAND,
    commandRequest,
    ToggleCommentResolvedCommandError.fromUnknown,
  );
}
