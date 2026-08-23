export type DiffCommentSide = "base" | "current";

export type DiffReviewIdentity = Readonly<{
  repositoryId: string;
  worktreeId: string;
  baseSha: string;
  currentSnapshotId: string;
}>;

export type DiffCommentDocumentScope = Readonly<
  Pick<DiffReviewIdentity, "repositoryId" | "worktreeId">
>;

type DiffAnchorCommon = Readonly<
  DiffReviewIdentity & {
    line: number;
    endLine?: number;
    lineHash: string;
    snippet: string;
    contextBefore: readonly string[];
    contextAfter: readonly string[];
  }
>;

export type BaseDiffLineAnchor = Readonly<
  DiffAnchorCommon & {
    side: "base";
    oldPath: string;
    newPath?: string;
  }
>;

export type CurrentDiffLineAnchor = Readonly<
  DiffAnchorCommon & {
    side: "current";
    newPath: string;
    oldPath?: string;
  }
>;

export type DiffLineAnchor = BaseDiffLineAnchor | CurrentDiffLineAnchor;

export type DiffAnchorTarget =
  | Readonly<{
      side: "base";
      oldPath: string;
      newPath?: string;
      line: number;
      endLine?: number;
    }>
  | Readonly<{
      side: "current";
      newPath: string;
      oldPath?: string;
      line: number;
      endLine?: number;
    }>;

export type StaleAnchorReason =
  | "snapshotChanged"
  | "pathMissing"
  | "ambiguousRename"
  | "contextNotFound"
  | "ambiguousContext"
  | "deleted"
  | "binary"
  | "unsupported";

export type UnavailableReason =
  | "io"
  | "permission"
  | "budgetExceeded"
  | "cancelled"
  | "repositoryChanged";

export type DiffAnchorResolution =
  | Readonly<{
      status: "exact" | "relocated";
      selectionPath: string;
      sidePath: string;
      side: DiffCommentSide;
      line: number;
    }>
  | Readonly<{
      status: "stale";
      reason: StaleAnchorReason;
      candidateCount: number;
    }>
  | Readonly<{
      status: "unavailable";
      reason: UnavailableReason;
      canJump: false;
    }>;

export type DiffCommentReply = Readonly<{
  id: string;
  body: string;
  createdAt: string;
}>;

export type StoredDiffComment = Readonly<{
  id: string;
  body: string;
  resolved: boolean;
  createdAt: string;
  anchor: DiffLineAnchor;
  replies?: readonly DiffCommentReply[];
}>;

export type ResolvedDiffComment = Readonly<
  StoredDiffComment & {
    anchorResolution: DiffAnchorResolution;
  }
>;

export type ResolutionWarningCode = UnavailableReason | "durabilityUncertain";

export type ResolutionWarning = Readonly<{
  code: ResolutionWarningCode;
  message: string;
}>;

export type ResolvedDiffComments = Readonly<
  DiffCommentDocumentScope & {
    version: 1;
    revision: string;
    comments: readonly ResolvedDiffComment[];
    resolutionWarnings: readonly ResolutionWarning[];
  }
>;

export type DiffCommentMutationOutcome =
  | Readonly<{
      kind: "committed";
      document: ResolvedDiffComments;
      revision: string;
      resolutionWarnings: readonly ResolutionWarning[];
      durability: "durable" | "uncertain";
    }>
  | Readonly<{
      kind: "conflict";
      latestDocument: ResolvedDiffComments;
      latestRevision: string;
      resolutionWarnings: readonly ResolutionWarning[];
    }>
  | Readonly<{
      kind: "preCommitFailure";
      code: "revisionOverflow";
      currentDocument: ResolvedDiffComments;
      currentRevision: string;
      retryable: false;
    }>
  | Readonly<{
      kind: "preCommitFailure";
      code: "storeBusy" | "io";
      retryable: true;
    }>
  | Readonly<{
      kind: "preCommitFailure";
      code: "permission" | "invalidStore";
      retryable: false;
    }>;

export type DiffCommentStatusFilter = "open" | "resolved" | "all";

const MAX_U64_DECIMAL = "18446744073709551615";

/**
 * @param revision - Candidate document revision.
 * @returns Whether the value is canonical unsigned u64 decimal.
 */
export function isCanonicalDiffCommentRevision(revision: string): boolean {
  const isCanonical = revision === "0" || /^[1-9][0-9]*$/.test(revision);
  if (!isCanonical) {
    return false;
  }

  if (revision.length !== MAX_U64_DECIMAL.length) {
    return revision.length < MAX_U64_DECIMAL.length;
  }

  return revision <= MAX_U64_DECIMAL;
}

/**
 * @param identity - Complete repository Diff identity.
 * @returns A collision-safe in-memory key containing all identity values.
 */
export function diffCommentIdentityKey(identity: DiffReviewIdentity): string {
  return [
    identity.repositoryId,
    identity.worktreeId,
    identity.baseSha,
    identity.currentSnapshotId,
  ]
    .map((value) => `${value.length}:${value}`)
    .join("|");
}
