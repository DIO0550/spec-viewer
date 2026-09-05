import type {
  WorkspaceWorktrees,
  Worktree,
} from "@/features/workspace/domain/worktree";

import { invokeTauriCommand } from "./invokeTauriCommand";
import { isRecord } from "./isRecord";

export const LIST_WORKTREES_COMMAND = "list_worktrees" as const;

export type ListWorktreesCommandName = typeof LIST_WORKTREES_COMMAND;
export type ListWorktreesCommandRequest = Readonly<{
  workspacePath: string;
}>;
export type ListWorktreesCommandResponse = WorkspaceWorktrees;
export type ListWorktreesCommandErrorCode =
  | "invalidRequest"
  | "notRepository"
  | "gitUnavailable"
  | "gitTimedOut"
  | "gitOutputLimitExceeded"
  | "gitFailed"
  | "unsupportedPathEncoding"
  | "io"
  | "unexpected"
  | "unknown";

export type ListWorktreesCommandError = Readonly<{
  command: ListWorktreesCommandName;
  code: ListWorktreesCommandErrorCode;
  message: string;
  raw: unknown;
}>;

export type ListWorktreesCommandContract = Readonly<{
  name: ListWorktreesCommandName;
  request: ListWorktreesCommandRequest;
  response: ListWorktreesCommandResponse;
  error: ListWorktreesCommandError;
}>;

export class InvalidListWorktreesResponseError extends Error {
  readonly code = "invalidResponse" as const;
  readonly raw: unknown;

  /**
   * @param message - Stable response validation message.
   * @param raw - Complete raw IPC response.
   */
  constructor(message: string, raw: unknown) {
    super(message);
    this.name = "InvalidListWorktreesResponseError";
    this.raw = raw;
  }
}

type RawWorktree = Readonly<{
  id: string;
  name: string;
  categoryPath: readonly string[];
}>;

type RawListWorktreesResponse = Readonly<{
  workspaceId: string;
  worktrees: readonly RawWorktree[];
}>;

export const ListWorktreesCommandError = {
  /** @returns A command-specific list_worktrees error parsed from an unknown value. */
  fromUnknown(error: unknown): ListWorktreesCommandError {
    if (
      isRecord(error) &&
      error.command === LIST_WORKTREES_COMMAND &&
      ListWorktreesCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: LIST_WORKTREES_COMMAND,
        code: error.code,
        message: error.message,
        raw: error.raw,
      };
    }

    if (
      isRecord(error) &&
      ListWorktreesCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: LIST_WORKTREES_COMMAND,
        code: error.code,
        message: error.message,
        raw: error,
      };
    }

    if (error instanceof Error) {
      return ListWorktreesCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return ListWorktreesCommandError.unknown(error, error);
    }

    return ListWorktreesCommandError.unknown(
      "Unknown list_worktrees failure",
      error,
    );
  },

  /** @returns An unknown list_worktrees command error preserving the raw payload. */
  unknown(message: string, raw: unknown): ListWorktreesCommandError {
    return {
      command: LIST_WORKTREES_COMMAND,
      code: "unknown",
      message,
      raw,
    };
  },

  /** @returns True when the value is a list_worktrees command error code. */
  isCommandErrorCode(value: unknown): value is ListWorktreesCommandErrorCode {
    return ListWorktreesCommandError.isCode(value) || value === "unknown";
  },

  /** @returns True when the value is a known list_worktrees backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<ListWorktreesCommandErrorCode, "unknown"> {
    return (
      value === "invalidRequest" ||
      value === "notRepository" ||
      value === "gitUnavailable" ||
      value === "gitTimedOut" ||
      value === "gitOutputLimitExceeded" ||
      value === "gitFailed" ||
      value === "unsupportedPathEncoding" ||
      value === "io" ||
      value === "unexpected"
    );
  },
} as const;

/** @param value - Candidate raw worktree response. @returns A validated raw worktree. */
function decodeRawWorktree(value: unknown, path: string): RawWorktree {
  if (!isRecord(value)) {
    throw new InvalidListWorktreesResponseError(
      path + " must be an object",
      value,
    );
  }
  if (typeof value.id !== "string") {
    throw new InvalidListWorktreesResponseError(
      path + ".id must be a string",
      value,
    );
  }
  if (typeof value.name !== "string") {
    throw new InvalidListWorktreesResponseError(
      path + ".name must be a string",
      value,
    );
  }
  if (
    !Array.isArray(value.categoryPath) ||
    !value.categoryPath.every(
      (part): part is string => typeof part === "string",
    )
  ) {
    throw new InvalidListWorktreesResponseError(
      path + ".categoryPath must be a string array",
      value,
    );
  }

  return {
    id: value.id,
    name: value.name,
    categoryPath: value.categoryPath,
  };
}

/** @param value - Candidate raw command response. @returns A validated response. */
function decodeRawResponse(value: unknown): RawListWorktreesResponse {
  if (!isRecord(value)) {
    throw new InvalidListWorktreesResponseError(
      "list_worktrees response must be an object",
      value,
    );
  }
  if (typeof value.workspaceId !== "string") {
    throw new InvalidListWorktreesResponseError(
      "list_worktrees response.workspaceId must be a string",
      value,
    );
  }
  if (!Array.isArray(value.worktrees)) {
    throw new InvalidListWorktreesResponseError(
      "list_worktrees response.worktrees must be an array",
      value,
    );
  }

  return {
    workspaceId: value.workspaceId,
    worktrees: value.worktrees.map((worktree, index) =>
      decodeRawWorktree(worktree, "worktrees[" + index + "]"),
    ),
  };
}

/** @param response - Raw command response. @returns Frontend worktree snapshot. */
function toWorkspaceWorktrees(
  response: RawListWorktreesResponse,
): WorkspaceWorktrees {
  const worktrees: readonly Worktree[] = response.worktrees.map((worktree) => ({
    id: worktree.id,
    name: worktree.name,
    categoryPath: worktree.categoryPath,
    specs: [],
    changedFiles: [],
  }));

  return {
    workspaceId: response.workspaceId,
    worktrees,
  };
}

/** @param workspacePath - Workspace path passed to Git. @returns Current Git worktrees. */
export async function listWorktrees(
  workspacePath: string,
): Promise<ListWorktreesCommandResponse> {
  const commandRequest: ListWorktreesCommandRequest = { workspacePath };
  const response = await invokeTauriCommand<
    unknown,
    ListWorktreesCommandRequest,
    ListWorktreesCommandError
  >(
    LIST_WORKTREES_COMMAND,
    commandRequest,
    ListWorktreesCommandError.fromUnknown,
  );

  return toWorkspaceWorktrees(decodeRawResponse(response));
}
