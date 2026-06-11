import { invoke } from "@tauri-apps/api/core";

import type {
  CommandError,
  CommandName,
  CommandRequest,
  CommandResponse,
  NormalizedCommandError,
} from "@/shared/types/ipc";

const UNKNOWN_COMMAND_ERROR_MESSAGE = "Unknown IPC command failure";

/**
 * @param error - Unknown failure raised by an IPC command or dialog.
 * @returns A stable command error shape for UI state and messages.
 */
export function normalizeCommandError(error: unknown): NormalizedCommandError {
  if (isCommandError(error)) {
    return {
      code: error.code,
      message: error.message,
      raw: error,
    };
  }

  if (error instanceof Error) {
    return {
      code: "unknown",
      message: error.message,
      raw: error,
    };
  }

  if (typeof error === "string") {
    return {
      code: "unknown",
      message: error,
      raw: error,
    };
  }

  return {
    code: "unknown",
    message: UNKNOWN_COMMAND_ERROR_MESSAGE,
    raw: error,
  };
}

/**
 * @param name - Backend command name registered in the IPC contract.
 * @param request - Typed request payload for the command.
 * @returns The typed response from the named Tauri command.
 * @throws NormalizedCommandError when the backend command fails.
 */
export async function invokeCommand<Name extends CommandName>(
  name: Name,
  request: CommandRequest<Name>,
): Promise<CommandResponse<Name>> {
  try {
    return await invoke<CommandResponse<Name>>(name, { request });
  } catch (error) {
    throw normalizeCommandError(error);
  }
}

/**
 * @param error - Unknown failure value.
 * @returns True when an unknown value matches the backend CommandError DTO.
 */
function isCommandError(error: unknown): error is CommandError {
  if (!isRecord(error)) {
    return false;
  }

  return isCommandErrorCode(error.code) && typeof error.message === "string";
}

/**
 * @param value - Unknown value to inspect.
 * @returns True when an unknown value is a non-null object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * @param value - Unknown value to inspect.
 * @returns True when an unknown value is a known backend command error code.
 */
function isCommandErrorCode(value: unknown): value is CommandError["code"] {
  return (
    value === "invalidRequest" ||
    value === "workspaceDetection" ||
    value === "configLoad" ||
    value === "specTreeScan" ||
    value === "specArchive" ||
    value === "markdownRead" ||
    value === "invalidSpec" ||
    value === "invalidComment" ||
    value === "commentRepository" ||
    value === "userReviewExport" ||
    value === "fileWatch"
  );
}
