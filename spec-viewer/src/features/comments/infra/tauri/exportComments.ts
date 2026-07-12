import type {
  ExportCommentsRequest,
  ExportCommentsResponse,
} from "@/features/comments/types/comment";

import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";
import { isRecord } from "@/shared/lib/isRecord";

export const EXPORT_COMMENTS_COMMAND = "export_comments" as const;

export type ExportCommentsCommandName = typeof EXPORT_COMMENTS_COMMAND;
export type ExportCommentsCommandRequest = ExportCommentsRequest;
export type ExportCommentsCommandResponse = ExportCommentsResponse;
export type ExportCommentsCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "markdownRead"
  | "invalidComment"
  | "commentRepository"
  | "unexpected"
  | "unknown";

export type ExportCommentsCommandError = Readonly<{
  command: ExportCommentsCommandName;
  code: ExportCommentsCommandErrorCode;
  message: string;
  cause: unknown;
}>;

export type ExportCommentsCommandContract = Readonly<{
  name: ExportCommentsCommandName;
  request: ExportCommentsCommandRequest;
  response: ExportCommentsCommandResponse;
  error: ExportCommentsCommandError;
}>;

export const ExportCommentsCommandError = {
  /** @returns A command-specific export_comments error parsed from an unknown value. */
  fromUnknown(error: unknown): ExportCommentsCommandError {
    if (
      isRecord(error) &&
      error.command === EXPORT_COMMENTS_COMMAND &&
      ExportCommentsCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: EXPORT_COMMENTS_COMMAND,
        code: error.code,
        message: error.message,
        cause: error.cause,
      };
    }

    if (
      isRecord(error) &&
      ExportCommentsCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: EXPORT_COMMENTS_COMMAND,
        code: error.code,
        message: error.message,
        cause: error,
      };
    }

    if (error instanceof Error) {
      return ExportCommentsCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return ExportCommentsCommandError.unknown(error, error);
    }

    return ExportCommentsCommandError.unknown(
      "Unknown export_comments failure",
      error,
    );
  },

  /** @returns An unknown export_comments command error preserving the cause payload. */
  unknown(message: string, cause: unknown): ExportCommentsCommandError {
    return {
      command: EXPORT_COMMENTS_COMMAND,
      code: "unknown",
      message,
      cause,
    };
  },

  /** @returns True when the value is a export_comments command error code. */
  isCommandErrorCode(value: unknown): value is ExportCommentsCommandErrorCode {
    return ExportCommentsCommandError.isCode(value) || value === "unknown";
  },

  /** @returns True when the value is a known export_comments backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<ExportCommentsCommandErrorCode, "unknown"> {
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

/** @returns Metadata for the comment export written by the backend. */
export async function exportComments(
  request: ExportCommentsRequest,
): Promise<ExportCommentsCommandResponse> {
  const commandRequest: ExportCommentsCommandRequest = request;

  return invokeTauriCommand<
    ExportCommentsCommandResponse,
    ExportCommentsCommandRequest,
    ExportCommentsCommandError
  >(
    EXPORT_COMMENTS_COMMAND,
    commandRequest,
    ExportCommentsCommandError.fromUnknown,
  );
}
