import type {
  Comment,
  CommentStatusRequest,
} from "@/features/comments/types/comment";

import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";
import { isRecord } from "@/shared/lib/isRecord";

export const RESOLVE_COMMENT_COMMAND = "resolve_comment" as const;

export type ResolveCommentCommandName = typeof RESOLVE_COMMENT_COMMAND;
export type ResolveCommentCommandRequest = CommentStatusRequest;
export type ResolveCommentCommandResponse = Comment;
export type ResolveCommentCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "markdownRead"
  | "invalidComment"
  | "commentRepository"
  | "unexpected"
  | "unknown";

export type ResolveCommentCommandError = Readonly<{
  command: ResolveCommentCommandName;
  code: ResolveCommentCommandErrorCode;
  message: string;
  cause: unknown;
}>;

export type ResolveCommentCommandContract = Readonly<{
  name: ResolveCommentCommandName;
  request: ResolveCommentCommandRequest;
  response: ResolveCommentCommandResponse;
  error: ResolveCommentCommandError;
}>;

export const ResolveCommentCommandError = {
  /** @returns A command-specific resolve_comment error parsed from an unknown value. */
  fromUnknown(error: unknown): ResolveCommentCommandError {
    if (
      isRecord(error) &&
      error.command === RESOLVE_COMMENT_COMMAND &&
      ResolveCommentCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: RESOLVE_COMMENT_COMMAND,
        code: error.code,
        message: error.message,
        cause: error.cause,
      };
    }

    if (
      isRecord(error) &&
      ResolveCommentCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: RESOLVE_COMMENT_COMMAND,
        code: error.code,
        message: error.message,
        cause: error,
      };
    }

    if (error instanceof Error) {
      return ResolveCommentCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return ResolveCommentCommandError.unknown(error, error);
    }

    return ResolveCommentCommandError.unknown(
      "Unknown resolve_comment failure",
      error,
    );
  },

  /** @returns An unknown resolve_comment command error preserving the cause payload. */
  unknown(message: string, cause: unknown): ResolveCommentCommandError {
    return {
      command: RESOLVE_COMMENT_COMMAND,
      code: "unknown",
      message,
      cause,
    };
  },

  /** @returns True when the value is a resolve_comment command error code. */
  isCommandErrorCode(value: unknown): value is ResolveCommentCommandErrorCode {
    return ResolveCommentCommandError.isCode(value) || value === "unknown";
  },

  /** @returns True when the value is a known resolve_comment backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<ResolveCommentCommandErrorCode, "unknown"> {
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

/** @returns The comment after marking it resolved. */
export async function resolveComment(
  request: CommentStatusRequest,
): Promise<ResolveCommentCommandResponse> {
  const commandRequest: ResolveCommentCommandRequest = request;

  return invokeTauriCommand<
    ResolveCommentCommandResponse,
    ResolveCommentCommandRequest,
    ResolveCommentCommandError
  >(
    RESOLVE_COMMENT_COMMAND,
    commandRequest,
    ResolveCommentCommandError.fromUnknown,
  );
}
