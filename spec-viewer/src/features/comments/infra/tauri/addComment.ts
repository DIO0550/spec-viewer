import {
  decodeAddCommentResponse,
  encodeAddCommentRequest,
} from "@/features/comments/infra/tauri/commentIpcCodec";
import type {
  AddCommentRequest,
  Comment,
} from "@/features/comments/types/comment";

import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";
import { isRecord } from "@/shared/lib/isRecord";

export const ADD_COMMENT_COMMAND = "add_comment" as const;

export type AddCommentCommandName = typeof ADD_COMMENT_COMMAND;
export type AddCommentCommandRequest = AddCommentRequest;
export type AddCommentCommandResponse = Comment;
export type AddCommentCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "invalidComment"
  | "commentRepository"
  | "unexpected"
  | "invalidResponse"
  | "unknown";

export type AddCommentCommandError = Readonly<{
  command: AddCommentCommandName;
  code: AddCommentCommandErrorCode;
  message: string;
  cause: unknown;
}>;

export type AddCommentCommandContract = Readonly<{
  name: AddCommentCommandName;
  request: AddCommentCommandRequest;
  response: AddCommentCommandResponse;
  error: AddCommentCommandError;
}>;

export const AddCommentCommandError = {
  /** @returns A command-specific add_comment error parsed from an unknown value. */
  fromUnknown(error: unknown): AddCommentCommandError {
    if (
      isRecord(error) &&
      error.command === ADD_COMMENT_COMMAND &&
      AddCommentCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: ADD_COMMENT_COMMAND,
        code: error.code,
        message: error.message,
        cause: "cause" in error ? error.cause : error,
      };
    }

    if (
      isRecord(error) &&
      AddCommentCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: ADD_COMMENT_COMMAND,
        code: error.code,
        message: error.message,
        cause: error,
      };
    }

    if (error instanceof Error) {
      return AddCommentCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return AddCommentCommandError.unknown(error, error);
    }

    return AddCommentCommandError.unknown("Unknown add_comment failure", error);
  },

  /** @returns An unknown add_comment command error preserving the cause payload. */
  unknown(message: string, cause: unknown): AddCommentCommandError {
    return {
      command: ADD_COMMENT_COMMAND,
      code: "unknown",
      message,
      cause,
    };
  },

  /** @returns True when the value is an add_comment command error code. */
  isCommandErrorCode(value: unknown): value is AddCommentCommandErrorCode {
    return (
      AddCommentCommandError.isCode(value) ||
      value === "invalidResponse" ||
      value === "unknown"
    );
  },

  /** @returns True when the value is a known add_comment backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<
    AddCommentCommandErrorCode,
    "unknown" | "invalidResponse"
  > {
    return (
      value === "invalidRequest" ||
      value === "workspaceDetection" ||
      value === "configLoad" ||
      value === "invalidComment" ||
      value === "commentRepository" ||
      value === "unexpected"
    );
  },
} as const;

/** @returns The newly persisted comment. */
export async function addComment(
  request: AddCommentCommandRequest,
): Promise<AddCommentCommandResponse> {
  return invokeTauriCommand<
    AddCommentCommandResponse,
    ReturnType<typeof encodeAddCommentRequest>,
    AddCommentCommandError
  >(
    ADD_COMMENT_COMMAND,
    encodeAddCommentRequest(request),
    AddCommentCommandError.fromUnknown,
    decodeAddCommentResponse,
  );
}
