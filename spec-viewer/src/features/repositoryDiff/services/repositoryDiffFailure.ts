import {
  LoadRepositoryDiffCommand,
  LoadRepositoryFileCommand,
  RepositoryDiffCommandError,
  TraverseRepositoryIgnoredCommand,
  type RepositoryDiffCommandName,
} from "@/lib/api/tauri";
import type { RepositoryDiffFailure } from "@/features/repositoryDiff/domain/repositoryDiffWorkspaceState";

const NonRetryableCodes = new Set([
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
    retryable: !NonRetryableCodes.has(normalized.code),
  };
}

/** @param error - Unknown overview command rejection. @returns Normalized overview failure. */
export function normalizeRepositoryDiffOverviewFailure(
  error: unknown,
): RepositoryDiffFailure {
  return normalizeRepositoryDiffFailure(LoadRepositoryDiffCommand, error);
}

/** @param error - Unknown file command rejection. @returns Normalized file failure. */
export function normalizeRepositoryDiffFileFailure(
  error: unknown,
): RepositoryDiffFailure {
  return normalizeRepositoryDiffFailure(LoadRepositoryFileCommand, error);
}

/** @param error - Unknown ignored-page command rejection. @returns Normalized page failure. */
export function normalizeRepositoryDiffIgnoredPageFailure(
  error: unknown,
): RepositoryDiffFailure {
  return normalizeRepositoryDiffFailure(
    TraverseRepositoryIgnoredCommand,
    error,
  );
}
