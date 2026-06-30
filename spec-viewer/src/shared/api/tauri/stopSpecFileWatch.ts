import type {
  StopSpecFileWatchRequest,
  StopSpecFileWatchResponse,
} from "@/features/specs/types/watch";

import { invokeTauriCommand } from "./invokeTauriCommand";
import { isRecord } from "./isRecord";

export const STOP_SPEC_FILE_WATCH_COMMAND = "stop_spec_file_watch" as const;

export type StopSpecFileWatchCommandName = typeof STOP_SPEC_FILE_WATCH_COMMAND;
export type StopSpecFileWatchCommandRequest = StopSpecFileWatchRequest;
export type StopSpecFileWatchCommandResponse = StopSpecFileWatchResponse;
export type StopSpecFileWatchCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "invalidSpec"
  | "fileWatch"
  | "unexpected"
  | "unknown";

export type StopSpecFileWatchCommandError = Readonly<{
  command: StopSpecFileWatchCommandName;
  code: StopSpecFileWatchCommandErrorCode;
  message: string;
  raw: unknown;
}>;

export type StopSpecFileWatchCommandContract = Readonly<{
  name: StopSpecFileWatchCommandName;
  request: StopSpecFileWatchCommandRequest;
  response: StopSpecFileWatchCommandResponse;
  error: StopSpecFileWatchCommandError;
}>;

export const StopSpecFileWatchCommandError = {
  /** @returns A command-specific stop_spec_file_watch error parsed from an unknown value. */
  fromUnknown(error: unknown): StopSpecFileWatchCommandError {
    if (
      isRecord(error) &&
      StopSpecFileWatchCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: STOP_SPEC_FILE_WATCH_COMMAND,
        code: error.code,
        message: error.message,
        raw: error,
      };
    }

    if (error instanceof Error) {
      return StopSpecFileWatchCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return StopSpecFileWatchCommandError.unknown(error, error);
    }

    return StopSpecFileWatchCommandError.unknown(
      "Unknown stop_spec_file_watch failure",
      error,
    );
  },

  /** @returns An unknown stop_spec_file_watch command error preserving the raw payload. */
  unknown(message: string, raw: unknown): StopSpecFileWatchCommandError {
    return {
      command: STOP_SPEC_FILE_WATCH_COMMAND,
      code: "unknown",
      message,
      raw,
    };
  },

  /** @returns True when the value is a known stop_spec_file_watch backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<StopSpecFileWatchCommandErrorCode, "unknown"> {
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

/** @returns Confirmation that the active backend watcher was stopped. */
export async function stopSpecFileWatch(): Promise<StopSpecFileWatchCommandResponse> {
  const commandRequest: StopSpecFileWatchCommandRequest = {};

  return invokeTauriCommand<
    StopSpecFileWatchCommandResponse,
    StopSpecFileWatchCommandRequest,
    StopSpecFileWatchCommandError
  >(
    STOP_SPEC_FILE_WATCH_COMMAND,
    commandRequest,
    StopSpecFileWatchCommandError.fromUnknown,
  );
}
