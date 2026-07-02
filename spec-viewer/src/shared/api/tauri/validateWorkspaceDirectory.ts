import type {
  ValidateWorkspaceDirectoryRequest,
  ValidateWorkspaceDirectoryResponse,
} from "@/features/workspace/types/workspace";

import { invokeTauriCommand } from "./invokeTauriCommand";
import { isRecord } from "./isRecord";

export const VALIDATE_WORKSPACE_DIRECTORY_COMMAND =
  "validate_workspace_directory" as const;

export type ValidateWorkspaceDirectoryCommandName =
  typeof VALIDATE_WORKSPACE_DIRECTORY_COMMAND;
export type ValidateWorkspaceDirectoryCommandRequest =
  ValidateWorkspaceDirectoryRequest;
export type ValidateWorkspaceDirectoryCommandResponse =
  ValidateWorkspaceDirectoryResponse;
export type ValidateWorkspaceDirectoryCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "unexpected"
  | "unknown";

export type ValidateWorkspaceDirectoryCommandError = Readonly<{
  command: ValidateWorkspaceDirectoryCommandName;
  code: ValidateWorkspaceDirectoryCommandErrorCode;
  message: string;
  raw: unknown;
}>;

export type ValidateWorkspaceDirectoryCommandContract = Readonly<{
  name: ValidateWorkspaceDirectoryCommandName;
  request: ValidateWorkspaceDirectoryCommandRequest;
  response: ValidateWorkspaceDirectoryCommandResponse;
  error: ValidateWorkspaceDirectoryCommandError;
}>;

export const ValidateWorkspaceDirectoryCommandError = {
  /** @returns A command-specific validate_workspace_directory error parsed from an unknown value. */
  fromUnknown(error: unknown): ValidateWorkspaceDirectoryCommandError {
    if (
      isRecord(error) &&
      error.command === VALIDATE_WORKSPACE_DIRECTORY_COMMAND &&
      ValidateWorkspaceDirectoryCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: VALIDATE_WORKSPACE_DIRECTORY_COMMAND,
        code: error.code,
        message: error.message,
        raw: error.raw,
      };
    }

    if (
      isRecord(error) &&
      ValidateWorkspaceDirectoryCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: VALIDATE_WORKSPACE_DIRECTORY_COMMAND,
        code: error.code,
        message: error.message,
        raw: error,
      };
    }

    if (error instanceof Error) {
      return ValidateWorkspaceDirectoryCommandError.unknown(
        error.message,
        error,
      );
    }

    if (typeof error === "string") {
      return ValidateWorkspaceDirectoryCommandError.unknown(error, error);
    }

    return ValidateWorkspaceDirectoryCommandError.unknown(
      "Unknown validate_workspace_directory failure",
      error,
    );
  },

  /** @returns An unknown validate_workspace_directory command error preserving the raw payload. */
  unknown(
    message: string,
    raw: unknown,
  ): ValidateWorkspaceDirectoryCommandError {
    return {
      command: VALIDATE_WORKSPACE_DIRECTORY_COMMAND,
      code: "unknown",
      message,
      raw,
    };
  },

  /** @returns True when the value is a validate_workspace_directory command error code. */
  isCommandErrorCode(
    value: unknown,
  ): value is ValidateWorkspaceDirectoryCommandErrorCode {
    return (
      ValidateWorkspaceDirectoryCommandError.isCode(value) ||
      value === "unknown"
    );
  },

  /** @returns True when the value is a known validate_workspace_directory backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<ValidateWorkspaceDirectoryCommandErrorCode, "unknown"> {
    return (
      value === "invalidRequest" ||
      value === "workspaceDetection" ||
      value === "configLoad" ||
      value === "unexpected"
    );
  },
} as const;

/** @returns Whether the given path points to an existing directory. */
export async function validateWorkspaceDirectory(
  path: string,
): Promise<ValidateWorkspaceDirectoryCommandResponse> {
  const commandRequest: ValidateWorkspaceDirectoryCommandRequest = { path };

  return invokeTauriCommand<
    ValidateWorkspaceDirectoryCommandResponse,
    ValidateWorkspaceDirectoryCommandRequest,
    ValidateWorkspaceDirectoryCommandError
  >(
    VALIDATE_WORKSPACE_DIRECTORY_COMMAND,
    commandRequest,
    ValidateWorkspaceDirectoryCommandError.fromUnknown,
  );
}
