import {
  LOAD_REPOSITORY_DIFF_COMMAND,
  LOAD_REPOSITORY_FILE_COMMAND,
  RepositoryDiffCommandError,
  TRAVERSE_REPOSITORY_IGNORED_COMMAND,
  type RepositoryDiffCommandName,
} from "@/lib/api/tauri";
import type { RepositoryDiffFailure } from "@/features/repositoryDiff/domain/repositoryDiffWorkspaceState";

const NON_RETRYABLE_CODES = new Set([
  "invalidInput",
  "invalidOverride",
  "invalidResponse",
  "invalidRevision",
  "invalidRepositoryPath",
  "revisionNotFound",
  "revisionNotCommit",
]);

/**
 * @param command - Repository command that failed.
 * @param error - Unknown command rejection.
 * @returns A UI-safe immutable failure.
 */
export function normalizeRepositoryDiffFailure(
  command: RepositoryDiffCommandName,
  error: unknown,
): RepositoryDiffFailure {
  const normalized = RepositoryDiffCommandError.fromUnknown(command, error);
  return {
    code: normalized.code,
    message: normalized.message,
    retryable: !NON_RETRYABLE_CODES.has(normalized.code),
  };
}

/** @param error - Unknown overview command rejection. @returns Normalized overview failure. */
export function normalizeRepositoryDiffOverviewFailure(
  error: unknown,
): RepositoryDiffFailure {
  return normalizeRepositoryDiffFailure(LOAD_REPOSITORY_DIFF_COMMAND, error);
}

/** @param error - Unknown file command rejection. @returns Normalized file failure. */
export function normalizeRepositoryDiffFileFailure(
  error: unknown,
): RepositoryDiffFailure {
  return normalizeRepositoryDiffFailure(LOAD_REPOSITORY_FILE_COMMAND, error);
}

/** @param error - Unknown ignored-page command rejection. @returns Normalized page failure. */
export function normalizeRepositoryDiffIgnoredPageFailure(
  error: unknown,
): RepositoryDiffFailure {
  return normalizeRepositoryDiffFailure(
    TRAVERSE_REPOSITORY_IGNORED_COMMAND,
    error,
  );
}
