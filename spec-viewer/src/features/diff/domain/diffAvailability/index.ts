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
} as const;
