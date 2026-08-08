export type RepositoryUnavailableCode =
  | "notRepository"
  | "bareRepository"
  | "worktreeUnavailable"
  | "gitUnavailable"
  | "unbornHead";

const REPOSITORY_UNAVAILABLE_CODES = [
  "notRepository",
  "bareRepository",
  "worktreeUnavailable",
  "gitUnavailable",
  "unbornHead",
] as const satisfies readonly RepositoryUnavailableCode[];

/**
 * Codes that make a repository-wide diff unusable but must not change how the
 * Spec-scoped diff classifies a failure.
 *
 * `commonDirBoundaryEscape` is deliberately absent from
 * {@link RepositoryUnavailableCode}: promoting it there would flip the Spec
 * diff from `failed` to `unavailable`, which forces the app out of Diff mode
 * and removes the retry affordance.
 */
export type RepositoryWideOnlyUnavailableCode = "commonDirBoundaryEscape";

export type RepositoryWideUnavailableCode =
  | RepositoryUnavailableCode
  | RepositoryWideOnlyUnavailableCode;

const REPOSITORY_WIDE_ONLY_UNAVAILABLE_CODES = [
  "commonDirBoundaryEscape",
] as const satisfies readonly RepositoryWideOnlyUnavailableCode[];

const REPOSITORY_WIDE_UNAVAILABLE_CODES = [
  ...REPOSITORY_UNAVAILABLE_CODES,
  ...REPOSITORY_WIDE_ONLY_UNAVAILABLE_CODES,
] as const satisfies readonly RepositoryWideUnavailableCode[];

/** Codes meaning the snapshot, base or cursor a request was scoped to expired. */
export type DiffStaleCode =
  | "staleSnapshot"
  | "headChangedDuringRead"
  | "staleBase"
  | "entryChangedDuringRead"
  | "staleCursor"
  | "invalidCursor";

const DIFF_STALE_CODES = [
  "staleSnapshot",
  "headChangedDuringRead",
  "staleBase",
  "entryChangedDuringRead",
  "staleCursor",
  "invalidCursor",
] as const satisfies readonly DiffStaleCode[];

export const DiffAvailability = {
  /**
   * @param code - Command error code to classify.
   * @returns True only when repository diff is unavailable at its source.
   */
  isRepositoryUnavailable(code: string): code is RepositoryUnavailableCode {
    return REPOSITORY_UNAVAILABLE_CODES.includes(
      code as RepositoryUnavailableCode,
    );
  },

  /**
   * @param code - Command error code to classify.
   * @returns True when a repository-wide diff cannot be produced at all.
   */
  isRepositoryWideUnavailable(
    code: string,
  ): code is RepositoryWideUnavailableCode {
    return REPOSITORY_WIDE_UNAVAILABLE_CODES.includes(
      code as RepositoryWideUnavailableCode,
    );
  },

  /**
   * @param code - Command error code to classify.
   * @returns True when the request was scoped to an expired snapshot, base or cursor.
   */
  isStale(code: string): code is DiffStaleCode {
    return DIFF_STALE_CODES.includes(code as DiffStaleCode);
  },
} as const;
