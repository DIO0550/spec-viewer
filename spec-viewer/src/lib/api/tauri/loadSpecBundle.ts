import type {
  LoadSpecBundleRequest,
  SpecBundle,
} from "@/features/specs/types/spec";

import { invokeTauriCommand } from "./invokeTauriCommand";
import { isRecord } from "./isRecord";

export const LoadSpecBundleCommand = "load_spec_bundle" as const;

export type LoadSpecBundleCommandName = typeof LoadSpecBundleCommand;
export type LoadSpecBundleCommandRequest = LoadSpecBundleRequest;
export type LoadSpecBundleCommandResponse = SpecBundle;
export type LoadSpecBundleCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "specTreeScan"
  | "markdownRead"
  | "invalidSpec"
  | "unexpected"
  | "unknown";

export type LoadSpecBundleCommandError = Readonly<{
  command: LoadSpecBundleCommandName;
  code: LoadSpecBundleCommandErrorCode;
  message: string;
  raw: unknown;
}>;

export type LoadSpecBundleCommandContract = Readonly<{
  name: LoadSpecBundleCommandName;
  request: LoadSpecBundleCommandRequest;
  response: LoadSpecBundleCommandResponse;
  error: LoadSpecBundleCommandError;
}>;

export const LoadSpecBundleCommandError = {
  /** Normalizes an IPC rejection without interpreting artifact-level errors. */
  fromUnknown(error: unknown): LoadSpecBundleCommandError {
    if (
      isRecord(error) &&
      error.command === LoadSpecBundleCommand &&
      LoadSpecBundleCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: LoadSpecBundleCommand,
        code: error.code,
        message: error.message,
        raw: error.raw,
      };
    }

    if (
      isRecord(error) &&
      LoadSpecBundleCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: LoadSpecBundleCommand,
        code: error.code,
        message: error.message,
        raw: error,
      };
    }

    if (error instanceof Error) {
      return LoadSpecBundleCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return LoadSpecBundleCommandError.unknown(error, error);
    }

    return LoadSpecBundleCommandError.unknown(
      "Unknown load_spec_bundle failure",
      error,
    );
  },

  /** Creates a normalized unknown bundle command error. */
  unknown(message: string, raw: unknown): LoadSpecBundleCommandError {
    return {
      command: LoadSpecBundleCommand,
      code: "unknown",
      message,
      raw,
    };
  },

  isCommandErrorCode(value: unknown): value is LoadSpecBundleCommandErrorCode {
    return LoadSpecBundleCommandError.isCode(value) || value === "unknown";
  },

  isCode(
    value: unknown,
  ): value is Exclude<LoadSpecBundleCommandErrorCode, "unknown"> {
    return (
      value === "invalidRequest" ||
      value === "workspaceDetection" ||
      value === "configLoad" ||
      value === "specTreeScan" ||
      value === "markdownRead" ||
      value === "invalidSpec" ||
      value === "unexpected"
    );
  },
} as const;

/** Loads every present artifact for one spec in a single IPC call. */
export async function loadSpecBundle(
  request: LoadSpecBundleRequest,
): Promise<SpecBundle> {
  return invokeTauriCommand<
    SpecBundle,
    LoadSpecBundleRequest,
    LoadSpecBundleCommandError
  >(LoadSpecBundleCommand, request, LoadSpecBundleCommandError.fromUnknown);
}
