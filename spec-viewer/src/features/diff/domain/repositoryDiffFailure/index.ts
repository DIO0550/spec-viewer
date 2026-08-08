import {
  DiffAvailability,
  type DiffStaleCode,
  type RepositoryWideUnavailableCode,
} from "@/features/diff/domain/diffAvailability";
import type { LoadRepositoryDiffCommandError } from "@/lib/api/tauri/loadRepositoryDiff";
import type { LoadRepositoryFileCommandError } from "@/lib/api/tauri/loadRepositoryFile";
import type { TraverseRepositoryIgnoredCommandError } from "@/lib/api/tauri/traverseRepositoryIgnored";

/** The union of the three repository command error objects. */
export type RepositoryCommandError =
  | LoadRepositoryDiffCommandError
  | LoadRepositoryFileCommandError
  | TraverseRepositoryIgnoredCommandError;

/**
 * Repository-only input failures.
 *
 * The `unavailable` and `stale` code sets are NOT redefined here: they live in
 * `diffAvailability`, which classifies both the Spec-scoped and the
 * repository-wide diff.
 */
export const REPOSITORY_INVALID_INPUT_CODES = [
  "invalidInput",
  "invalidOverride",
] as const;
export type RepositoryInvalidInputCode =
  (typeof REPOSITORY_INVALID_INPUT_CODES)[number];

export const REPOSITORY_TRANSIENT_CODES = [
  "gitTimedOut",
  "gitOutputLimitExceeded",
  "gitFailed",
  "unsupportedPathEncoding",
  "revisionNotFound",
  "revisionNotCommit",
  "invalidHistoryOutput",
  "invalidRepositoryPath",
  "permissionDenied",
  "io",
] as const;
export type RepositoryTransientCode =
  (typeof REPOSITORY_TRANSIENT_CODES)[number];

export type RepositoryDiffFailure =
  /** The repository itself cannot produce a diff; retrying will not help. */
  | Readonly<{
      feature: "diff";
      kind: "unavailable";
      code: RepositoryWideUnavailableCode;
      message: string;
      cause: RepositoryCommandError;
    }>
  /** The base, snapshot or cursor expired; a fresh overview can recover. */
  | Readonly<{
      feature: "diff";
      kind: "stale";
      code: DiffStaleCode;
      message: string;
      cause: RepositoryCommandError;
    }>
  /** The request was malformed; `invalidOverride` only reaches the overview path. */
  | Readonly<{
      feature: "diff";
      kind: "invalidInput";
      code: RepositoryInvalidInputCode;
      message: string;
      cause: RepositoryCommandError;
    }>
  /** A transient I/O or git failure; a user-driven retry is worthwhile. */
  | Readonly<{
      feature: "diff";
      kind: "transient";
      code: RepositoryTransientCode;
      message: string;
      cause: RepositoryCommandError;
    }>
  /** The backend response violated the contract; treat as a bug, do not retry. */
  | Readonly<{
      feature: "diff";
      kind: "invalidResponse";
      message: string;
      cause: RepositoryCommandError;
    }>
  /** Unclassifiable; non-Error thrown values land here, so `cause` stays unknown. */
  | Readonly<{
      feature: "diff";
      kind: "unknown";
      message: string;
      cause: unknown;
    }>;

/**
 * @param code - Command error code to test.
 * @returns True for the two repository-only invalid-input codes.
 */
const isInvalidInput = (code: string): code is RepositoryInvalidInputCode =>
  REPOSITORY_INVALID_INPUT_CODES.includes(code as RepositoryInvalidInputCode);

/**
 * @param code - Command error code to test.
 * @returns True for the ten transient git and I/O codes.
 */
const isTransient = (code: string): code is RepositoryTransientCode =>
  REPOSITORY_TRANSIENT_CODES.includes(code as RepositoryTransientCode);

/**
 * @param value - Value thrown by a repository command.
 * @returns True when the value has the shape of a normalized command error.
 */
const isCommandError = (value: unknown): value is RepositoryCommandError => {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RepositoryCommandError).code === "string" &&
    typeof (value as RepositoryCommandError).message === "string"
  );
};

export const RepositoryDiffFailure = {
  /**
   * Converts a thrown IPC command error into an exhaustively matchable state.
   *
   * The `unavailable` and `stale` decisions delegate to `DiffAvailability`, so
   * the code sets stay defined in exactly one place.
   *
   * @param error - The value thrown by a repository command.
   * @returns A tagged failure the UI can match exhaustively.
   */
  fromCommandError(error: unknown): RepositoryDiffFailure {
    if (!isCommandError(error)) {
      return {
        feature: "diff",
        kind: "unknown",
        message: "Unknown repository diff failure",
        cause: error,
      };
    }

    const { code, message } = error;

    if (DiffAvailability.isRepositoryWideUnavailable(code)) {
      return {
        feature: "diff",
        kind: "unavailable",
        code,
        message,
        cause: error,
      };
    }

    if (DiffAvailability.isStale(code)) {
      return { feature: "diff", kind: "stale", code, message, cause: error };
    }

    if (isInvalidInput(code)) {
      return {
        feature: "diff",
        kind: "invalidInput",
        code,
        message,
        cause: error,
      };
    }

    if (isTransient(code)) {
      return {
        feature: "diff",
        kind: "transient",
        code,
        message,
        cause: error,
      };
    }

    if (code === "invalidResponse") {
      return {
        feature: "diff",
        kind: "invalidResponse",
        message,
        cause: error,
      };
    }

    return { feature: "diff", kind: "unknown", message, cause: error };
  },

  /**
   * @param failure - Classified failure to inspect.
   * @returns True when re-running the overview can clear the failure.
   */
  isRecoverableByReload(failure: RepositoryDiffFailure): boolean {
    return failure.kind === "stale";
  },
} as const;
