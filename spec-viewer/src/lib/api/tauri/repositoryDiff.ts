import { invokeTauriCommand } from "./invokeTauriCommand";
import { isRecord } from "./isRecord";
import {
  decodeIgnoredPage,
  decodeRepositoryFileReview,
  decodeRepositoryOverview,
  InvalidRepositoryDiffResponseError,
  type DiffAnchor,
  type IgnoredPage,
  type RepositoryDiffOverview,
  type RepositoryFileReview,
} from "./repositoryDiffDecoder";

export const LoadRepositoryDiffCommand = "load_repository_diff" as const;
export const TraverseRepositoryIgnoredCommand =
  "traverse_repository_ignored" as const;
export const LoadRepositoryFileCommand = "load_repository_file" as const;

export type LoadRepositoryDiffRequest = Readonly<{
  worktreeId: string;
  baseOverride?: string;
}>;

export type TraverseRepositoryIgnoredRequest = Readonly<{
  worktreeId: string;
  currentSnapshotId: string;
  nodeId: string;
  cursor?: string;
}>;

export type LoadRepositoryFileRequest = Readonly<{
  worktreeId: string;
  currentSnapshotId: string;
  path: string;
}>;

export type RepositoryDiffBackendErrorCode =
  | "invalidInput"
  | "invalidOverride"
  | "unbornHead"
  | "headChangedDuringRead"
  | "notRepository"
  | "bareRepository"
  | "worktreeUnavailable"
  | "commonDirBoundaryEscape"
  | "gitUnavailable"
  | "gitTimedOut"
  | "gitOutputLimitExceeded"
  | "gitFailed"
  | "unsupportedPathEncoding"
  | "revisionNotFound"
  | "revisionNotCommit"
  | "invalidHistoryOutput"
  | "invalidRepositoryPath"
  | "staleBase"
  | "staleSnapshot"
  | "staleCursor"
  | "invalidCursor"
  | "entryChangedDuringRead"
  | "permissionDenied"
  | "io";

export type RepositoryDiffCommandErrorCode =
  | RepositoryDiffBackendErrorCode
  | "invalidResponse"
  | "invalidRevision"
  | "unknown";

export type RepositoryDiffCommandName =
  | typeof LoadRepositoryDiffCommand
  | typeof TraverseRepositoryIgnoredCommand
  | typeof LoadRepositoryFileCommand;

export type RepositoryDiffCommandError = Readonly<{
  command: RepositoryDiffCommandName;
  code: RepositoryDiffCommandErrorCode;
  message: string;
  raw: unknown;
}>;

export type RepositoryDiffAnchor = DiffAnchor;
export type LoadRepositoryDiffResponse = RepositoryDiffOverview;
export type TraverseRepositoryIgnoredResponse = IgnoredPage;
export type LoadRepositoryFileResponse = RepositoryFileReview;

const BackendErrorCodes = [
  "invalidInput",
  "invalidOverride",
  "unbornHead",
  "headChangedDuringRead",
  "notRepository",
  "bareRepository",
  "worktreeUnavailable",
  "commonDirBoundaryEscape",
  "gitUnavailable",
  "gitTimedOut",
  "gitOutputLimitExceeded",
  "gitFailed",
  "unsupportedPathEncoding",
  "revisionNotFound",
  "revisionNotCommit",
  "invalidHistoryOutput",
  "invalidRepositoryPath",
  "staleBase",
  "staleSnapshot",
  "staleCursor",
  "invalidCursor",
  "entryChangedDuringRead",
  "permissionDenied",
  "io",
] as const satisfies readonly RepositoryDiffBackendErrorCode[];

/**
 * @param value - Candidate backend error code.
 * @returns True when the value is a repository backend error code.
 */
const isBackendErrorCode = (
  value: unknown,
): value is RepositoryDiffBackendErrorCode =>
  typeof value === "string" &&
  BackendErrorCodes.includes(value as RepositoryDiffBackendErrorCode);

/**
 * @param value - Candidate command error code.
 * @returns True when the value is a complete command error code.
 */
const isCommandErrorCode = (
  value: unknown,
): value is RepositoryDiffCommandErrorCode =>
  isBackendErrorCode(value) ||
  value === "invalidResponse" ||
  value === "invalidRevision" ||
  value === "unknown";

/**
 * @param command - Invoked repository command.
 * @param error - Unknown rejected IPC payload.
 * @returns A normalized repository command error.
 */
const fromUnknown = (
  command: RepositoryDiffCommandName,
  error: unknown,
): RepositoryDiffCommandError => {
  if (
    isRecord(error) &&
    error.command === command &&
    isCommandErrorCode(error.code) &&
    typeof error.message === "string"
  ) {
    return {
      command,
      code: error.code,
      message: error.message,
      raw: error.raw,
    };
  }

  if (
    isRecord(error) &&
    isCommandErrorCode(error.code) &&
    typeof error.message === "string"
  ) {
    return {
      command,
      code: error.code,
      message: error.message,
      raw: error,
    };
  }

  if (error instanceof Error) {
    return {
      command,
      code: "unknown",
      message: error.message,
      raw: error,
    };
  }

  if (typeof error === "string") {
    return {
      command,
      code: "unknown",
      message: error,
      raw: error,
    };
  }

  return {
    command,
    code: "unknown",
    message: "Unknown " + command + " failure",
    raw: error,
  };
};

/**
 * @param command - Invoked repository command.
 * @param error - Runtime response validation error.
 * @returns A command-local validation error.
 */
const invalidResponse = (
  command: RepositoryDiffCommandName,
  error: InvalidRepositoryDiffResponseError,
): RepositoryDiffCommandError => ({
  command,
  code: error.code,
  message: error.message,
  raw: error.raw,
});

export const RepositoryDiffCommandError = {
  fromUnknown,
  invalidResponse,
  isBackendErrorCode,
  isCommandErrorCode,
} as const;

/**
 * @param request - Worktree and optional base override.
 * @returns A validated repository overview.
 * @throws RepositoryDiffCommandError for IPC or response failures.
 */
export async function loadRepositoryDiff(
  request: LoadRepositoryDiffRequest,
): Promise<LoadRepositoryDiffResponse> {
  const response = await invokeTauriCommand<
    unknown,
    LoadRepositoryDiffRequest,
    RepositoryDiffCommandError
  >(LoadRepositoryDiffCommand, request, (error) =>
    fromUnknown(LoadRepositoryDiffCommand, error),
  );

  try {
    return decodeRepositoryOverview(response);
  } catch (error) {
    if (error instanceof InvalidRepositoryDiffResponseError) {
      throw invalidResponse(LoadRepositoryDiffCommand, error);
    }

    throw error;
  }
}

/**
 * @param request - Snapshot-scoped ignored directory page request.
 * @returns A validated ignored page.
 * @throws RepositoryDiffCommandError for IPC or response failures.
 */
export async function traverseRepositoryIgnored(
  request: TraverseRepositoryIgnoredRequest,
): Promise<TraverseRepositoryIgnoredResponse> {
  const response = await invokeTauriCommand<
    unknown,
    TraverseRepositoryIgnoredRequest,
    RepositoryDiffCommandError
  >(TraverseRepositoryIgnoredCommand, request, (error) =>
    fromUnknown(TraverseRepositoryIgnoredCommand, error),
  );

  try {
    return decodeIgnoredPage(response);
  } catch (error) {
    if (error instanceof InvalidRepositoryDiffResponseError) {
      throw invalidResponse(TraverseRepositoryIgnoredCommand, error);
    }

    throw error;
  }
}

/**
 * @param request - Snapshot-scoped repository file request.
 * @returns A validated repository file review.
 * @throws RepositoryDiffCommandError for IPC or response failures.
 */
export async function loadRepositoryFile(
  request: LoadRepositoryFileRequest,
): Promise<LoadRepositoryFileResponse> {
  const response = await invokeTauriCommand<
    unknown,
    LoadRepositoryFileRequest,
    RepositoryDiffCommandError
  >(LoadRepositoryFileCommand, request, (error) =>
    fromUnknown(LoadRepositoryFileCommand, error),
  );

  try {
    return decodeRepositoryFileReview(response);
  } catch (error) {
    if (error instanceof InvalidRepositoryDiffResponseError) {
      throw invalidResponse(LoadRepositoryFileCommand, error);
    }

    throw error;
  }
}
