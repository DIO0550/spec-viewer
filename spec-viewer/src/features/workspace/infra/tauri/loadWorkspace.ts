import type { Workspace as WorkspaceAggregate } from "@/features/workspace/domain/workspace";
import {
  decodeLoadWorkspaceResponse,
  encodeLoadWorkspaceRequest,
} from "@/features/workspace/infra/tauri/workspaceIpcCodec";
import type { LoadWorkspaceRequest } from "@/features/workspace/types/workspace";

import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";
import { isRecord } from "@/shared/lib/isRecord";

export const LOAD_WORKSPACE_COMMAND = "load_workspace" as const;
export type LoadWorkspaceCommandName = typeof LOAD_WORKSPACE_COMMAND;
export type LoadWorkspaceCommandRequest = ReturnType<
  typeof encodeLoadWorkspaceRequest
>;

export type LoadWorkspaceCommandResponse = WorkspaceAggregate;
export type LoadWorkspaceCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "unexpected"
  | "invalidResponse"
  | "unknown";

export type LoadWorkspaceCommandError = Readonly<{
  command: LoadWorkspaceCommandName;
  code: LoadWorkspaceCommandErrorCode;
  message: string;
  cause: unknown;
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
      error.command === LOAD_WORKSPACE_COMMAND &&
      LoadWorkspaceCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: LOAD_WORKSPACE_COMMAND,
        code: error.code,
        message: error.message,
        cause: "cause" in error ? error.cause : error,
      };
    }

    if (
      isRecord(error) &&
      LoadWorkspaceCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: LOAD_WORKSPACE_COMMAND,
        code: error.code,
        message: error.message,
        cause: error,
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

  /** @returns An unknown load_workspace command error preserving the cause payload. */
  unknown(message: string, cause: unknown): LoadWorkspaceCommandError {
    return {
      command: LOAD_WORKSPACE_COMMAND,
      code: "unknown",
      message,
      cause,
    };
  },

  /** @returns True when the value is a load_workspace command error code. */
  isCommandErrorCode(value: unknown): value is LoadWorkspaceCommandErrorCode {
    return (
      LoadWorkspaceCommandError.isCode(value) ||
      value === "invalidResponse" ||
      value === "unknown"
    );
  },

  /** @returns True when the value is a known load_workspace backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<
    LoadWorkspaceCommandErrorCode,
    "unknown" | "invalidResponse"
  > {
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
): Promise<WorkspaceAggregate> {
  const request: LoadWorkspaceRequest = { selectedDirectory };
  const commandRequest = encodeLoadWorkspaceRequest(request);
  return invokeTauriCommand<
    LoadWorkspaceCommandResponse,
    LoadWorkspaceCommandRequest,
    LoadWorkspaceCommandError
  >(
    LOAD_WORKSPACE_COMMAND,
    commandRequest,
    LoadWorkspaceCommandError.fromUnknown,
    decodeLoadWorkspaceResponse,
  );
}
