export type ComparisonRevision =
  | Readonly<{ kind: "head" }>
  | Readonly<{ kind: "commit"; sha: string }>
  | Readonly<{ kind: "localBranch"; name: string }>
  | Readonly<{ kind: "tag"; name: string }>;

export type RevisionOption = Readonly<{
  id: string;
  revision: ComparisonRevision;
  label: string;
  resolvedCommitSha: string;
}>;

export type SpecFileCommit = Readonly<{
  sha: string;
  committedAt: string;
  message: string;
}>;

export type SpecFileHistory = Readonly<{
  items: readonly SpecFileCommit[];
  truncated: boolean;
}>;

/**
 * Extracts the comparable, kind-specific value used for revision equality.
 *
 * @param revision - The comparison revision to extract a value from.
 * @returns "head" for HEAD, the SHA for a commit, or the ref name for a
 *   branch/tag.
 */
const valueOf = (revision: ComparisonRevision): string => {
  if (revision.kind === "head") {
    return "head";
  }
  if (revision.kind === "commit") {
    return revision.sha;
  }
  return revision.name;
};

export const ComparisonRevision = {
  head(): ComparisonRevision {
    return { kind: "head" };
  },

  equals(left: ComparisonRevision, right: ComparisonRevision): boolean {
    return left.kind === right.kind && valueOf(left) === valueOf(right);
  },

  idOf(revision: ComparisonRevision): string {
    return revision.kind === "head"
      ? "head"
      : `${revision.kind}:${valueOf(revision)}`;
  },
} as const;
