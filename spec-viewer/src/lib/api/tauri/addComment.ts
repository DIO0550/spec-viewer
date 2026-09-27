import type { Comment } from "@/features/comments/domain/comment";
import type { AddCommentRequest } from "@/features/comments/types/comment";

import { invokeTauriCommand } from "./invokeTauriCommand";
import { isRecord } from "./isRecord";

export const AddCommentCommand = "add_comment" as const;

export type AddCommentCommandName = typeof AddCommentCommand;
export type AddCommentCommandRequest = AddCommentRequest;
export type AddCommentCommandResponse = Comment;
export type AddCommentCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "invalidComment"
  | "commentRepository"
  | "unexpected"
  | "unknown";

export type AddCommentCommandError = Readonly<{
  command: AddCommentCommandName;
  code: AddCommentCommandErrorCode;
  message: string;
  raw: unknown;
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
      error.command === AddCommentCommand &&
      AddCommentCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: AddCommentCommand,
        code: error.code,
        message: error.message,
        raw: error.raw,
      };
    }

    if (
      isRecord(error) &&
      AddCommentCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: AddCommentCommand,
        code: error.code,
        message: error.message,
        raw: error,
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

  /** @returns An unknown add_comment command error preserving the raw payload. */
  unknown(message: string, raw: unknown): AddCommentCommandError {
    return {
      command: AddCommentCommand,
      code: "unknown",
      message,
      raw,
    };
  },

  /** @returns True when the value is an add_comment command error code. */
  isCommandErrorCode(value: unknown): value is AddCommentCommandErrorCode {
    return AddCommentCommandError.isCode(value) || value === "unknown";
  },

  /** @returns True when the value is a known add_comment backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<AddCommentCommandErrorCode, "unknown"> {
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
    AddCommentCommandRequest,
    AddCommentCommandError
  >(AddCommentCommand, request, AddCommentCommandError.fromUnknown);
}
