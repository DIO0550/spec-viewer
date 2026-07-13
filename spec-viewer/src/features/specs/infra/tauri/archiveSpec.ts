import type {
  ArchiveSpecRequest,
  ArchiveSpecResponse,
} from "@/features/specs/types/spec";
import {
  decodeArchiveSpecResponse,
  encodeArchiveSpecRequest,
} from "@/features/specs/infra/tauri/specIpcCodec";

import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";
import { isRecord } from "@/shared/lib/isRecord";

export const ARCHIVE_SPEC_COMMAND = "archive_spec" as const;

export type ArchiveSpecCommandName = typeof ARCHIVE_SPEC_COMMAND;
export type ArchiveSpecCommandRequest = ArchiveSpecRequest;
export type ArchiveSpecCommandResponse = ArchiveSpecResponse;
export type ArchiveSpecCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "specArchive"
  | "invalidSpec"
  | "unexpected"
  | "invalidResponse"
  | "unknown";

export type ArchiveSpecCommandError = Readonly<{
  command: ArchiveSpecCommandName;
  code: ArchiveSpecCommandErrorCode;
  message: string;
  cause: unknown;
}>;

export type ArchiveSpecCommandContract = Readonly<{
  name: ArchiveSpecCommandName;
  request: ArchiveSpecCommandRequest;
  response: ArchiveSpecCommandResponse;
  error: ArchiveSpecCommandError;
}>;

export const ArchiveSpecCommandError = {
  /** @returns A command-specific archive_spec error parsed from an unknown value. */
  fromUnknown(error: unknown): ArchiveSpecCommandError {
    if (
      isRecord(error) &&
      error.command === ARCHIVE_SPEC_COMMAND &&
      ArchiveSpecCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: ARCHIVE_SPEC_COMMAND,
        code: error.code,
        message: error.message,
        cause: "cause" in error ? error.cause : error,
      };
    }

    if (
      isRecord(error) &&
      ArchiveSpecCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: ARCHIVE_SPEC_COMMAND,
        code: error.code,
        message: error.message,
        cause: error,
      };
    }

    if (error instanceof Error) {
      return ArchiveSpecCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return ArchiveSpecCommandError.unknown(error, error);
    }

    return ArchiveSpecCommandError.unknown(
      "Unknown archive_spec failure",
      error,
    );
  },

  /** @returns An unknown archive_spec command error preserving the cause payload. */
  unknown(message: string, cause: unknown): ArchiveSpecCommandError {
    return {
      command: ARCHIVE_SPEC_COMMAND,
      code: "unknown",
      message,
      cause,
    };
  },

  /** @returns True when the value is a archive_spec command error code. */
  isCommandErrorCode(value: unknown): value is ArchiveSpecCommandErrorCode {
    return (
      ArchiveSpecCommandError.isCode(value) ||
      value === "invalidResponse" ||
      value === "unknown"
    );
  },

  /** @returns True when the value is a known archive_spec backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<
    ArchiveSpecCommandErrorCode,
    "unknown" | "invalidResponse"
  > {
    return (
      value === "invalidRequest" ||
      value === "workspaceDetection" ||
      value === "configLoad" ||
      value === "specArchive" ||
      value === "invalidSpec" ||
      value === "unexpected"
    );
  },
} as const;

/** @returns Metadata for the spec directory moved into the workspace archive. */
export async function archiveSpec(
  request: ArchiveSpecRequest,
): Promise<ArchiveSpecCommandResponse> {
  const commandRequest: ArchiveSpecCommandRequest = request;

  return invokeTauriCommand<
    ArchiveSpecCommandResponse,
    ArchiveSpecCommandRequest,
    ArchiveSpecCommandError
  >(
    ARCHIVE_SPEC_COMMAND,
    encodeArchiveSpecRequest(commandRequest),
    ArchiveSpecCommandError.fromUnknown,
    decodeArchiveSpecResponse,
  );
}
