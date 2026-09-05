import type { ListSpecsRequest, SpecTree } from "@/features/specs/types/spec";

import { invokeTauriCommand } from "./invokeTauriCommand";
import { isRecord } from "./isRecord";

export const LIST_SPECS_COMMAND = "list_specs" as const;

export type ListSpecsCommandName = typeof LIST_SPECS_COMMAND;
export type ListSpecsCommandRequest = ListSpecsRequest;
export type ListSpecsCommandResponse = SpecTree;
export type ListSpecsCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "specTreeScan"
  | "unexpected"
  | "unknown";

export type ListSpecsCommandError = Readonly<{
  command: ListSpecsCommandName;
  code: ListSpecsCommandErrorCode;
  message: string;
  raw: unknown;
}>;

export type ListSpecsCommandContract = Readonly<{
  name: ListSpecsCommandName;
  request: ListSpecsCommandRequest;
  response: ListSpecsCommandResponse;
  error: ListSpecsCommandError;
}>;

export const ListSpecsCommandError = {
  /** @returns A command-specific list_specs error parsed from an unknown value. */
  fromUnknown(error: unknown): ListSpecsCommandError {
    if (
      isRecord(error) &&
      error.command === LIST_SPECS_COMMAND &&
      ListSpecsCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: LIST_SPECS_COMMAND,
        code: error.code,
        message: error.message,
        raw: error.raw,
      };
    }

    if (
      isRecord(error) &&
      ListSpecsCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: LIST_SPECS_COMMAND,
        code: error.code,
        message: error.message,
        raw: error,
      };
    }

    if (error instanceof Error) {
      return ListSpecsCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return ListSpecsCommandError.unknown(error, error);
    }

    return ListSpecsCommandError.unknown("Unknown list_specs failure", error);
  },

  /** @returns An unknown list_specs command error preserving the raw payload. */
  unknown(message: string, raw: unknown): ListSpecsCommandError {
    return {
      command: LIST_SPECS_COMMAND,
      code: "unknown",
      message,
      raw,
    };
  },

  /** @returns True when the value is a list_specs command error code. */
  isCommandErrorCode(value: unknown): value is ListSpecsCommandErrorCode {
    return ListSpecsCommandError.isCode(value) || value === "unknown";
  },

  /** @returns True when the value is a known list_specs backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<ListSpecsCommandErrorCode, "unknown"> {
    return (
      value === "invalidRequest" ||
      value === "workspaceDetection" ||
      value === "configLoad" ||
      value === "specTreeScan" ||
      value === "unexpected"
    );
  },
} as const;

/** @returns Spec tree for the workspace path. */
export async function listSpecs(
  workspacePath: string,
): Promise<ListSpecsCommandResponse> {
  const commandRequest: ListSpecsCommandRequest = { workspacePath };

  return invokeTauriCommand<
    ListSpecsCommandResponse,
    ListSpecsCommandRequest,
    ListSpecsCommandError
  >(LIST_SPECS_COMMAND, commandRequest, ListSpecsCommandError.fromUnknown);
}
