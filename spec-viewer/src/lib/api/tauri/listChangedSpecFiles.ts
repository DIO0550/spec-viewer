import { invokeTauriCommand } from "./invokeTauriCommand";
import { isRecord } from "./isRecord";
import {
  decodeChangedSpecFiles,
  type ChangedSpecFiles,
  InvalidSpecDiffResponseError,
} from "./specDiffDecoder";

export const LIST_CHANGED_SPEC_FILES_COMMAND =
  "list_changed_spec_files" as const;

export type ListChangedSpecFilesCommandRequest = Readonly<{
  workspacePath: string;
}>;
export type ListChangedSpecFilesCommandResponse = ChangedSpecFiles;
export type SpecDiffBackendErrorCode =
  | "invalidInput"
  | "workspaceDetection"
  | "configLoad"
  | "specTreeScan"
  | "notRepository"
  | "bareRepository"
  | "worktreeUnavailable"
  | "commonDirBoundaryEscape"
  | "unbornHead"
  | "headChangedDuringRead"
  | "gitUnavailable"
  | "gitTimedOut"
  | "gitOutputLimitExceeded"
  | "gitFailed"
  | "unsupportedPathEncoding"
  | "invalidRepositoryPath"
  | "staleBase"
  | "staleSnapshot"
  | "entryChangedDuringRead"
  | "permissionDenied"
  | "io";
export type ListChangedSpecFilesCommandErrorCode =
  | SpecDiffBackendErrorCode
  | "invalidResponse"
  | "unknown";
export type ListChangedSpecFilesCommandError = Readonly<{
  command: typeof LIST_CHANGED_SPEC_FILES_COMMAND;
  code: ListChangedSpecFilesCommandErrorCode;
  message: string;
  raw: unknown;
}>;
export type ListChangedSpecFilesCommandContract = Readonly<{
  name: typeof LIST_CHANGED_SPEC_FILES_COMMAND;
  request: ListChangedSpecFilesCommandRequest;
  response: ListChangedSpecFilesCommandResponse;
  error: ListChangedSpecFilesCommandError;
}>;

const SPEC_DIFF_BACKEND_ERROR_CODES = [
  "invalidInput",
  "workspaceDetection",
  "configLoad",
  "specTreeScan",
  "notRepository",
  "bareRepository",
  "worktreeUnavailable",
  "commonDirBoundaryEscape",
  "unbornHead",
  "headChangedDuringRead",
  "gitUnavailable",
  "gitTimedOut",
  "gitOutputLimitExceeded",
  "gitFailed",
  "unsupportedPathEncoding",
  "invalidRepositoryPath",
  "staleBase",
  "staleSnapshot",
  "entryChangedDuringRead",
  "permissionDenied",
  "io",
] as const satisfies readonly SpecDiffBackendErrorCode[];

export const ListChangedSpecFilesCommandError = {
  /**
   * @param error - Unknown rejected IPC payload.
   * @returns A normalized list_changed_spec_files error.
   */
  fromUnknown(error: unknown): ListChangedSpecFilesCommandError {
    if (
      isRecord(error) &&
      error.command === LIST_CHANGED_SPEC_FILES_COMMAND &&
      ListChangedSpecFilesCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: LIST_CHANGED_SPEC_FILES_COMMAND,
        code: error.code,
        message: error.message,
        raw: error.raw,
      };
    }

    if (
      isRecord(error) &&
      ListChangedSpecFilesCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: LIST_CHANGED_SPEC_FILES_COMMAND,
        code: error.code,
        message: error.message,
        raw: error,
      };
    }

    if (error instanceof Error) {
      return ListChangedSpecFilesCommandError.unknown(error.message, error);
    }
    if (typeof error === "string") {
      return ListChangedSpecFilesCommandError.unknown(error, error);
    }

    return ListChangedSpecFilesCommandError.unknown(
      "Unknown list_changed_spec_files failure",
      error,
    );
  },

  /**
   * @param error - Runtime response validation error.
   * @returns A command-local invalidResponse error.
   */
  invalidResponse(
    error: InvalidSpecDiffResponseError,
  ): ListChangedSpecFilesCommandError {
    return {
      command: LIST_CHANGED_SPEC_FILES_COMMAND,
      code: "invalidResponse",
      message: error.message,
      raw: error.raw,
    };
  },

  /**
   * @param message - Fallback failure message.
   * @param raw - Original rejected value.
   * @returns An unknown command error.
   */
  unknown(message: string, raw: unknown): ListChangedSpecFilesCommandError {
    return {
      command: LIST_CHANGED_SPEC_FILES_COMMAND,
      code: "unknown",
      message,
      raw,
    };
  },

  /**
   * @param value - Value to test.
   * @returns True for every command-local error code.
   */
  isCommandErrorCode(
    value: unknown,
  ): value is ListChangedSpecFilesCommandErrorCode {
    return (
      ListChangedSpecFilesCommandError.isCode(value) ||
      value === "invalidResponse" ||
      value === "unknown"
    );
  },

  /**
   * @param value - Value to test.
   * @returns True for Backend #165 error codes.
   */
  isCode(value: unknown): value is SpecDiffBackendErrorCode {
    return (
      typeof value === "string" &&
      SPEC_DIFF_BACKEND_ERROR_CODES.includes(value as SpecDiffBackendErrorCode)
    );
  },
} as const;

/**
 * @param request - Workspace containing spec planning files.
 * @returns A validated snapshot ID and changed spec-file list.
 * @throws ListChangedSpecFilesCommandError for command or response failures.
 */
export async function listChangedSpecFiles(
  request: ListChangedSpecFilesCommandRequest,
): Promise<ListChangedSpecFilesCommandResponse> {
  const response = await invokeTauriCommand<
    unknown,
    ListChangedSpecFilesCommandRequest,
    ListChangedSpecFilesCommandError
  >(
    LIST_CHANGED_SPEC_FILES_COMMAND,
    request,
    ListChangedSpecFilesCommandError.fromUnknown,
  );

  try {
    return decodeChangedSpecFiles(response);
  } catch (error) {
    if (error instanceof InvalidSpecDiffResponseError) {
      throw ListChangedSpecFilesCommandError.invalidResponse(error);
    }
    throw error;
  }
}
