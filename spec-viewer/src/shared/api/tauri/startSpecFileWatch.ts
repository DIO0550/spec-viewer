import type {
  StartSpecFileWatchRequest,
  StartSpecFileWatchResponse,
} from "@/features/specs/types/watch";

import { invokeTauriCommand } from "./invokeTauriCommand";
import { isRecord } from "./isRecord";

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

  /** @returns True when the value is a known start_spec_file_watch backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<StartSpecFileWatchCommandErrorCode, "unknown"> {
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
    StartSpecFileWatchCommandRequest,
    StartSpecFileWatchCommandError
  >(
    START_SPEC_FILE_WATCH_COMMAND,
    commandRequest,
    StartSpecFileWatchCommandError.fromUnknown,
  );
}
