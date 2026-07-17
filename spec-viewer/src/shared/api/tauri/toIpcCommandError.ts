import type { CommandErrorDto, IpcCommandError } from "@/shared/types/ipc";

const UNKNOWN_COMMAND_ERROR_MESSAGE = "Unknown IPC command failure";

/**
 * @deprecated Use each command file's command-specific error companion instead.
 * @param error - Unknown value thrown by an IPC command invocation.
 * @returns A stable IPC command error shape for existing compatibility callers.
 */
export function toIpcCommandError(error: unknown): IpcCommandError {
  if (isCommandErrorDto(error)) {
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
 * @param error - Unknown value to test against the command error DTO shape.
 * @returns True when an unknown value matches the backend command error DTO.
 */
function isCommandErrorDto(error: unknown): error is CommandErrorDto {
  if (!isRecord(error)) {
    return false;
  }

  return isCommandErrorCode(error.code) && typeof error.message === "string";
}

/**
 * @param value - Unknown value to test.
 * @returns True when an unknown value is a non-null object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * @param value - Unknown value to test against known error codes.
 * @returns True when an unknown value is a known backend command error code.
 */
function isCommandErrorCode(value: unknown): value is CommandErrorDto["code"] {
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
    value === "fileWatch" ||
    value === "unexpected"
  );
}
