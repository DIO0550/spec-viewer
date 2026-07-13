import type {
  StartSpecFileWatchRequest,
  StartSpecFileWatchResponse,
} from "@/features/specs/types/watch";
import {
  decodeStartSpecFileWatchResponse,
  encodeStartSpecFileWatchRequest,
} from "@/features/specs/infra/tauri/specIpcCodec";

import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";
import { isRecord } from "@/shared/lib/isRecord";

export const START_SPEC_FILE_WATCH_COMMAND = "start_spec_file_watch" as const;

export type StartSpecFileWatchCommandName =
  typeof START_SPEC_FILE_WATCH_COMMAND;
export type StartSpecFileWatchCommandRequest = StartSpecFileWatchRequest;
export type StartSpecFileWatchCommandResponse = StartSpecFileWatchResponse;
export type StartSpecFileWatchCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "invalidSpec"
  | "fileWatch"
  | "unexpected"
  | "invalidResponse"
  | "unknown";

export type StartSpecFileWatchCommandError = Readonly<{
  command: StartSpecFileWatchCommandName;
  code: StartSpecFileWatchCommandErrorCode;
  message: string;
  raw: unknown;
}>;

export type StartSpecFileWatchCommandContract = Readonly<{
  name: StartSpecFileWatchCommandName;
  request: StartSpecFileWatchCommandRequest;
  response: StartSpecFileWatchCommandResponse;
  error: StartSpecFileWatchCommandError;
}>;

export const StartSpecFileWatchCommandError = {
  /** @returns A command-specific start_spec_file_watch error parsed from an unknown value. */
  fromUnknown(error: unknown): StartSpecFileWatchCommandError {
    if (
      isRecord(error) &&
      error.command === START_SPEC_FILE_WATCH_COMMAND &&
      StartSpecFileWatchCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: START_SPEC_FILE_WATCH_COMMAND,
        code: error.code,
        message: error.message,
        raw: "raw" in error ? error.raw : error,
      };
    }

    if (
      isRecord(error) &&
      StartSpecFileWatchCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: START_SPEC_FILE_WATCH_COMMAND,
        code: error.code,
        message: error.message,
        raw: error,
      };
    }

    if (error instanceof Error) {
      return StartSpecFileWatchCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return StartSpecFileWatchCommandError.unknown(error, error);
    }

    return StartSpecFileWatchCommandError.unknown(
      "Unknown start_spec_file_watch failure",
      error,
    );
  },

  /** @returns An unknown start_spec_file_watch command error preserving the raw payload. */
  unknown(message: string, raw: unknown): StartSpecFileWatchCommandError {
    return {
      command: START_SPEC_FILE_WATCH_COMMAND,
      code: "unknown",
      message,
      raw,
    };
  },

  /** @returns True when the value is a start_spec_file_watch command error code. */
  isCommandErrorCode(
    value: unknown,
  ): value is StartSpecFileWatchCommandErrorCode {
    return (
      StartSpecFileWatchCommandError.isCode(value) ||
      value === "invalidResponse" ||
      value === "unknown"
    );
  },

  /** @returns True when the value is a known start_spec_file_watch backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<
    StartSpecFileWatchCommandErrorCode,
    "unknown" | "invalidResponse"
  > {
    return (
      value === "invalidRequest" ||
      value === "workspaceDetection" ||
      value === "configLoad" ||
      value === "invalidSpec" ||
      value === "fileWatch" ||
      value === "unexpected"
    );
  },
} as const;

/** @returns Backend watcher registration metadata for the selected spec file. */
export async function startSpecFileWatch(
  request: StartSpecFileWatchRequest,
): Promise<StartSpecFileWatchCommandResponse> {
  const commandRequest: StartSpecFileWatchCommandRequest = request;

  return invokeTauriCommand<
    StartSpecFileWatchCommandResponse,
    ReturnType<typeof encodeStartSpecFileWatchRequest>,
    StartSpecFileWatchCommandError
  >(
    START_SPEC_FILE_WATCH_COMMAND,
    encodeStartSpecFileWatchRequest(commandRequest),
    StartSpecFileWatchCommandError.fromUnknown,
    decodeStartSpecFileWatchResponse,
  );
}
