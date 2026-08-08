import type { FileDiff } from "@/features/diff/domain/fileDiff";

import { InvalidDiffResponseError } from "./diffPayloadDecoder";
import { invokeTauriCommand } from "./invokeTauriCommand";
import { isRecord } from "./isRecord";
import {
  ListChangedSpecFilesCommandError,
  type SpecDiffBackendErrorCode,
} from "./listChangedSpecFiles";
import { decodeSpecFileDiff } from "./specDiffDecoder";

export const GET_SPEC_FILE_DIFF_COMMAND = "get_spec_file_diff" as const;

export type GetSpecFileDiffCommandRequest = Readonly<{
  workspacePath: string;
  currentSnapshotId: string;
  resolvedBaseSha?: string;
  specId: string;
  fileKey: string;
  path: string;
}>;
export type GetSpecFileDiffCommandResponse = FileDiff;
export type GetSpecFileDiffCommandErrorCode =
  | SpecDiffBackendErrorCode
  | "invalidResponse"
  | "unknown";
export type GetSpecFileDiffCommandError = Readonly<{
  command: typeof GET_SPEC_FILE_DIFF_COMMAND;
  code: GetSpecFileDiffCommandErrorCode;
  message: string;
  raw: unknown;
}>;
export type GetSpecFileDiffCommandContract = Readonly<{
  name: typeof GET_SPEC_FILE_DIFF_COMMAND;
  request: GetSpecFileDiffCommandRequest;
  response: GetSpecFileDiffCommandResponse;
  error: GetSpecFileDiffCommandError;
}>;

export const GetSpecFileDiffCommandError = {
  /**
   * @param error - Unknown rejected IPC payload.
   * @returns A normalized get_spec_file_diff error.
   */
  fromUnknown(error: unknown): GetSpecFileDiffCommandError {
    if (
      isRecord(error) &&
      error.command === GET_SPEC_FILE_DIFF_COMMAND &&
      GetSpecFileDiffCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: GET_SPEC_FILE_DIFF_COMMAND,
        code: error.code,
        message: error.message,
        raw: error.raw,
      };
    }

    if (
      isRecord(error) &&
      GetSpecFileDiffCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: GET_SPEC_FILE_DIFF_COMMAND,
        code: error.code,
        message: error.message,
        raw: error,
      };
    }

    if (error instanceof Error) {
      return GetSpecFileDiffCommandError.unknown(error.message, error);
    }
    if (typeof error === "string") {
      return GetSpecFileDiffCommandError.unknown(error, error);
    }

    return GetSpecFileDiffCommandError.unknown(
      "Unknown get_spec_file_diff failure",
      error,
    );
  },

  /**
   * @param error - Runtime response validation error.
   * @returns A command-local invalidResponse error.
   */
  invalidResponse(
    error: InvalidDiffResponseError,
  ): GetSpecFileDiffCommandError {
    return {
      command: GET_SPEC_FILE_DIFF_COMMAND,
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
  unknown(message: string, raw: unknown): GetSpecFileDiffCommandError {
    return {
      command: GET_SPEC_FILE_DIFF_COMMAND,
      code: "unknown",
      message,
      raw,
    };
  },

  /**
   * @param value - Value to test.
   * @returns True for every command-local error code.
   */
  isCommandErrorCode(value: unknown): value is GetSpecFileDiffCommandErrorCode {
    return (
      GetSpecFileDiffCommandError.isCode(value) ||
      value === "invalidResponse" ||
      value === "unknown"
    );
  },

  /**
   * @param value - Value to test.
   * @returns True for Backend #165 error codes.
   */
  isCode(value: unknown): value is SpecDiffBackendErrorCode {
    return ListChangedSpecFilesCommandError.isCode(value);
  },
} as const;

/**
 * @param request - Snapshot and target spec file to diff.
 * @returns A validated readonly file diff.
 * @throws GetSpecFileDiffCommandError for command or response failures.
 */
export async function getSpecFileDiff(
  request: GetSpecFileDiffCommandRequest,
): Promise<GetSpecFileDiffCommandResponse> {
  const response = await invokeTauriCommand<
    unknown,
    GetSpecFileDiffCommandRequest,
    GetSpecFileDiffCommandError
  >(
    GET_SPEC_FILE_DIFF_COMMAND,
    request,
    GetSpecFileDiffCommandError.fromUnknown,
  );

  try {
    return decodeSpecFileDiff(response);
  } catch (error) {
    if (error instanceof InvalidDiffResponseError) {
      throw GetSpecFileDiffCommandError.invalidResponse(error);
    }
    throw error;
  }
}
