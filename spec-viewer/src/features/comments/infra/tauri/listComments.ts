import type {
  ListCommentsRequest,
  ListCommentsResponse,
} from "@/features/comments/types/comment";
import {
  decodeListCommentsResponse,
  encodeListCommentsRequest,
} from "@/features/comments/infra/tauri/commentIpcCodec";

import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";
import { isRecord } from "@/shared/lib/isRecord";

export const LIST_COMMENTS_COMMAND = "list_comments" as const;

export type ListCommentsCommandName = typeof LIST_COMMENTS_COMMAND;
export type ListCommentsCommandRequest = ListCommentsRequest;
export type ListCommentsCommandResponse = ListCommentsResponse;
export type ListCommentsCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "markdownRead"
  | "invalidComment"
  | "commentRepository"
  | "unexpected"
  | "invalidResponse"
  | "unknown";

export type ListCommentsCommandError = Readonly<{
  command: ListCommentsCommandName;
  code: ListCommentsCommandErrorCode;
  message: string;
  cause: unknown;
}>;

export type ListCommentsCommandContract = Readonly<{
  name: ListCommentsCommandName;
  request: ListCommentsCommandRequest;
  response: ListCommentsCommandResponse;
  error: ListCommentsCommandError;
}>;

export const ListCommentsCommandError = {
  /** @returns A command-specific list_comments error parsed from an unknown value. */
  fromUnknown(error: unknown): ListCommentsCommandError {
    if (
      isRecord(error) &&
      error.command === LIST_COMMENTS_COMMAND &&
      ListCommentsCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: LIST_COMMENTS_COMMAND,
        code: error.code,
        message: error.message,
        cause: "cause" in error ? error.cause : error,
      };
    }

    if (
      isRecord(error) &&
      ListCommentsCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: LIST_COMMENTS_COMMAND,
        code: error.code,
        message: error.message,
        cause: error,
      };
    }

    if (error instanceof Error) {
      return ListCommentsCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return ListCommentsCommandError.unknown(error, error);
    }

    return ListCommentsCommandError.unknown(
      "Unknown list_comments failure",
      error,
    );
  },

  /** @returns An unknown list_comments command error preserving the cause payload. */
  unknown(message: string, cause: unknown): ListCommentsCommandError {
    return {
      command: LIST_COMMENTS_COMMAND,
      code: "unknown",
      message,
      cause,
    };
  },

  /** @returns True when the value is a list_comments command error code. */
  isCommandErrorCode(value: unknown): value is ListCommentsCommandErrorCode {
    return (
      ListCommentsCommandError.isCode(value) ||
      value === "invalidResponse" ||
      value === "unknown"
    );
  },

  /** @returns True when the value is a known list_comments backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<
    ListCommentsCommandErrorCode,
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

/** @returns Comment threads for the requested spec file and status filter. */
export async function listComments(
  request: ListCommentsRequest,
): Promise<ListCommentsCommandResponse> {
  const commandRequest: ListCommentsCommandRequest = request;

  return invokeTauriCommand<
    ListCommentsCommandResponse,
    ReturnType<typeof encodeListCommentsRequest>,
    ListCommentsCommandError
  >(
    LIST_COMMENTS_COMMAND,
    encodeListCommentsRequest(commandRequest),
    ListCommentsCommandError.fromUnknown,
    decodeListCommentsResponse,
  );
}
