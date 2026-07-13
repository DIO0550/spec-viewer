import type {
  ReadSpecFileRequest,
  SpecDocument,
} from "@/features/specs/types/spec";
import {
  decodeReadSpecFileResponse,
  encodeReadSpecFileRequest,
} from "@/features/specs/infra/tauri/specIpcCodec";

import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";
import { isRecord } from "@/shared/lib/isRecord";

export const READ_SPEC_FILE_COMMAND = "read_spec_file" as const;

export type ReadSpecFileCommandName = typeof READ_SPEC_FILE_COMMAND;
export type ReadSpecFileCommandRequest = ReadSpecFileRequest;
export type ReadSpecFileCommandResponse = SpecDocument;
export type ReadSpecFileCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "markdownRead"
  | "invalidSpec"
  | "unexpected"
  | "invalidResponse"
  | "unknown";

export type ReadSpecFileCommandError = Readonly<{
  command: ReadSpecFileCommandName;
  code: ReadSpecFileCommandErrorCode;
  message: string;
  cause: unknown;
}>;

export type ReadSpecFileCommandContract = Readonly<{
  name: ReadSpecFileCommandName;
  request: ReadSpecFileCommandRequest;
  response: ReadSpecFileCommandResponse;
  error: ReadSpecFileCommandError;
}>;

export const ReadSpecFileCommandError = {
  /** @returns A command-specific read_spec_file error parsed from an unknown value. */
  fromUnknown(error: unknown): ReadSpecFileCommandError {
    if (
      isRecord(error) &&
      error.command === READ_SPEC_FILE_COMMAND &&
      ReadSpecFileCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: READ_SPEC_FILE_COMMAND,
        code: error.code,
        message: error.message,
        cause: "cause" in error ? error.cause : error,
      };
    }

    if (
      isRecord(error) &&
      ReadSpecFileCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: READ_SPEC_FILE_COMMAND,
        code: error.code,
        message: error.message,
        cause: error,
      };
    }

    if (error instanceof Error) {
      return ReadSpecFileCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return ReadSpecFileCommandError.unknown(error, error);
    }

    return ReadSpecFileCommandError.unknown(
      "Unknown read_spec_file failure",
      error,
    );
  },

  /** @returns An unknown read_spec_file command error preserving the cause payload. */
  unknown(message: string, cause: unknown): ReadSpecFileCommandError {
    return {
      command: READ_SPEC_FILE_COMMAND,
      code: "unknown",
      message,
      cause,
    };
  },

  /** @returns True when the value is a read_spec_file command error code. */
  isCommandErrorCode(value: unknown): value is ReadSpecFileCommandErrorCode {
    return (
      ReadSpecFileCommandError.isCode(value) ||
      value === "invalidResponse" ||
      value === "unknown"
    );
  },

  /** @returns True when the value is a known read_spec_file backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<
    ReadSpecFileCommandErrorCode,
    "unknown" | "invalidResponse"
  > {
    return (
      value === "invalidRequest" ||
      value === "workspaceDetection" ||
      value === "configLoad" ||
      value === "markdownRead" ||
      value === "invalidSpec" ||
      value === "unexpected"
    );
  },
} as const;

/** @returns Markdown contents or missing-file metadata for a spec file. */
export async function readSpecFile(
  request: ReadSpecFileRequest,
): Promise<ReadSpecFileCommandResponse> {
  const commandRequest: ReadSpecFileCommandRequest = request;

  return invokeTauriCommand<
    ReadSpecFileCommandResponse,
    ReturnType<typeof encodeReadSpecFileRequest>,
    ReadSpecFileCommandError
  >(
    READ_SPEC_FILE_COMMAND,
    encodeReadSpecFileRequest(commandRequest),
    ReadSpecFileCommandError.fromUnknown,
    decodeReadSpecFileResponse,
  );
}
