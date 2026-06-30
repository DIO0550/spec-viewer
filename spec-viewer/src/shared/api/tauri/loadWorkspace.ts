import type {
  LoadWorkspaceRequest,
  Workspace,
} from "@/features/workspace/types/workspace";

import { invokeTauriCommand } from "./invokeTauriCommand";
import { isRecord } from "./isRecord";

export const LOAD_WORKSPACE_COMMAND = "load_workspace" as const;

export type LoadWorkspaceCommandName = typeof LOAD_WORKSPACE_COMMAND;
export type LoadWorkspaceCommandRequest = LoadWorkspaceRequest;
export type LoadWorkspaceCommandResponse = Workspace;
export type LoadWorkspaceCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "unexpected"
  | "unknown";

export type LoadWorkspaceCommandError = Readonly<{
  command: LoadWorkspaceCommandName;
  code: LoadWorkspaceCommandErrorCode;
  message: string;
  raw: unknown;
}>;

export type LoadWorkspaceCommandContract = Readonly<{
  name: LoadWorkspaceCommandName;
  request: LoadWorkspaceCommandRequest;
  response: LoadWorkspaceCommandResponse;
  error: LoadWorkspaceCommandError;
}>;

export const LoadWorkspaceCommandError = {
  /** @returns A command-specific load_workspace error parsed from an unknown value. */
  fromUnknown(error: unknown): LoadWorkspaceCommandError {
    if (
      isRecord(error) &&
      LoadWorkspaceCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: LOAD_WORKSPACE_COMMAND,
        code: error.code,
        message: error.message,
        raw: error,
      };
    }

    if (error instanceof Error) {
      return LoadWorkspaceCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return LoadWorkspaceCommandError.unknown(error, error);
    }

    return LoadWorkspaceCommandError.unknown(
      "Unknown load_workspace failure",
      error,
    );
  },

  /** @returns An unknown load_workspace command error preserving the raw payload. */
  unknown(message: string, raw: unknown): LoadWorkspaceCommandError {
    return {
      command: LOAD_WORKSPACE_COMMAND,
      code: "unknown",
      message,
      raw,
    };
  },

  /** @returns True when the value is a known load_workspace backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<LoadWorkspaceCommandErrorCode, "unknown"> {
    return (
      value === "invalidRequest" ||
      value === "workspaceDetection" ||
      value === "configLoad" ||
      value === "unexpected"
    );
  },
} as const;

/** @returns Loaded workspace metadata for the selected directory. */
export async function loadWorkspace(
  selectedDirectory: string,
): Promise<LoadWorkspaceCommandResponse> {
  const commandRequest: LoadWorkspaceCommandRequest = { selectedDirectory };

  return invokeTauriCommand<
    LoadWorkspaceCommandResponse,
    LoadWorkspaceCommandRequest,
    LoadWorkspaceCommandError
  >(
    LOAD_WORKSPACE_COMMAND,
    commandRequest,
    LoadWorkspaceCommandError.fromUnknown,
  );
}
