import { invoke } from "@tauri-apps/api/core";

import type {
  CommandError,
  CommandName,
  CommandRequest,
  CommandResponse,
  NormalizedCommandError,
} from "../types/ipc";
import type {
  ReadSpecFileRequest,
  SpecDocument,
  SpecTree,
} from "../types/spec";
import type { Workspace } from "../types/workspace";

const UNKNOWN_COMMAND_ERROR_MESSAGE = "Unknown IPC command failure";

/** @returns Loaded workspace metadata for the selected directory. */
export async function loadWorkspace(
  selectedDirectory: string,
): Promise<Workspace> {
  return invokeCommand("load_workspace", { selectedDirectory });
}

/** @returns Spec tree for the workspace path. */
export async function listSpecs(workspacePath: string): Promise<SpecTree> {
  return invokeCommand("list_specs", { workspacePath });
}

/** @returns Markdown contents or missing-file metadata for a spec file. */
export async function readSpecFile(
  request: ReadSpecFileRequest,
): Promise<SpecDocument> {
  return invokeCommand("read_spec_file", request);
}

/** @returns A stable command error shape for UI state and messages. */
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

/** @returns The typed response from the named Tauri command. */
async function invokeCommand<Name extends CommandName>(
  name: Name,
  request: CommandRequest<Name>,
): Promise<CommandResponse<Name>> {
  try {
    return await invoke<CommandResponse<Name>>(name, { request });
  } catch (error) {
    throw normalizeCommandError(error);
  }
}

/** @returns True when an unknown value matches the backend CommandError DTO. */
function isCommandError(error: unknown): error is CommandError {
  if (!isRecord(error)) {
    return false;
  }

  return isCommandErrorCode(error.code) && typeof error.message === "string";
}

/** @returns True when an unknown value is a non-null object record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** @returns True when an unknown value is a known backend command error code. */
function isCommandErrorCode(value: unknown): value is CommandError["code"] {
  return (
    value === "invalidRequest" ||
    value === "workspaceDetection" ||
    value === "configLoad" ||
    value === "specTreeScan" ||
    value === "markdownRead"
  );
}
