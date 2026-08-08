/**
 * Error codes emitted by every Git-backed Backend command, regardless of
 * whether the command is Spec-scoped or repository-scoped.
 *
 * Spec-only codes (`workspaceDetection` / `configLoad` / `specTreeScan`) and
 * repository-only codes (`invalidOverride` / `staleCursor` / `invalidCursor`)
 * live with their own command modules and compose with this set.
 */
export type GitBackendErrorCode =
  | "invalidInput"
  | "notRepository"
  | "bareRepository"
  | "worktreeUnavailable"
  | "commonDirBoundaryEscape"
  | "unbornHead"
  | "headChangedDuringRead"
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
  | "entryChangedDuringRead"
  | "permissionDenied"
  | "io";

export const GIT_BACKEND_ERROR_CODES = [
  "invalidInput",
  "notRepository",
  "bareRepository",
  "worktreeUnavailable",
  "commonDirBoundaryEscape",
  "unbornHead",
  "headChangedDuringRead",
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
  "entryChangedDuringRead",
  "permissionDenied",
  "io",
] as const satisfies readonly GitBackendErrorCode[];

/**
 * @param value - Value to test.
 * @returns True for every error code shared by all Git-backed commands.
 */
export function isGitBackendErrorCode(
  value: unknown,
): value is GitBackendErrorCode {
  return (
    typeof value === "string" &&
    GIT_BACKEND_ERROR_CODES.includes(value as GitBackendErrorCode)
  );
}
