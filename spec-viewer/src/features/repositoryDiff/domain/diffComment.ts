export type DiffCommentStatus = "open" | "resolved";
export type DiffCommentAnchorSide = "base" | "current";

export type DiffCommentAnchor = Readonly<{
  repositoryId: string;
  worktreeId: string;
  side: DiffCommentAnchorSide;
  oldPath: string | null;
  newPath: string | null;
  line: number;
  baseSha: string;
  currentSnapshotId: string;
  lineHash: string;
  snippet: string;
  context: string;
}>;

export type DiffCommentAnchorResolutionStatus = "exact" | "relocated" | "stale";

export type DiffCommentAnchorResolution = Readonly<{
  status: DiffCommentAnchorResolutionStatus;
  reason: string;
  details: string | null;
}>;

export type StoredDiffCommentDto = Readonly<{
  id: string;
  repositoryId: string;
  worktreeId: string;
  anchor: DiffCommentAnchor;
  body: string;
  status: DiffCommentStatus;
  revision: string;
  createdAt: string;
  updatedAt: string;
}>;

export type DiffCommentDto = Readonly<
  StoredDiffCommentDto & {
    anchorResolution: DiffCommentAnchorResolution | null;
  }
>;

const MAX_U64_DECIMAL = "18446744073709551615";

/**
 * @param revision - Candidate revision string.
 * @returns True when revision is canonical unsigned u64 decimal.
 */
export function isCanonicalDiffCommentRevision(revision: string): boolean {
  const isCanonical = revision === "0" || /^[1-9][0-9]*$/.test(revision);
  const exceedsU64 =
    revision.length > MAX_U64_DECIMAL.length ||
    (revision.length === MAX_U64_DECIMAL.length && revision > MAX_U64_DECIMAL);

  return isCanonical && !exceedsU64;
}

export const DiffCommentAnchor = {
  /**
   * @param input - Candidate Diff anchor.
   * @returns An immutable validated Diff anchor.
   * @throws Error when side/path or line invariants are invalid.
   */
  create(input: DiffCommentAnchor): DiffCommentAnchor {
    const hasRequiredSidePath =
      (input.side === "base" && input.oldPath !== null) ||
      (input.side === "current" && input.newPath !== null);

    if (!hasRequiredSidePath) {
      throw new Error("Diff comment anchor side/path invariant failed");
    }

    if (!Number.isSafeInteger(input.line) || input.line < 1) {
      throw new Error("Diff comment anchor line must be positive");
    }

    return { ...input };
  },
} as const;
