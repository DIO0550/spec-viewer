import {
  RepositoryCurrentSnapshotId,
  type RepositoryDiffOverview,
  type RepositoryFileReview,
  RepositoryId,
  type RepositoryIgnoredPage,
  RepositoryNodeId,
  type RepositoryTreeNode,
  RepositoryWorktreeId,
} from "@/features/diff/domain/repositoryDiff";
import type { RepositoryDiffFailure } from "@/features/diff/domain/repositoryDiffFailure";
import type { RepositoryDiffRequestIdentity } from "@/features/diff/domain/repositoryDiffState";

export const WORKTREE_A = RepositoryWorktreeId.fromString("/repo/a");
export const WORKTREE_B = RepositoryWorktreeId.fromString("/repo/b");
export const SNAPSHOT_1 = RepositoryCurrentSnapshotId.fromString("rs1_one");
export const SNAPSHOT_2 = RepositoryCurrentSnapshotId.fromString("rs1_two");
export const NODE_A = RepositoryNodeId.fromString("in1_a");
export const NODE_B = RepositoryNodeId.fromString("in1_b");

export const identity: RepositoryDiffRequestIdentity = {
  worktreeId: WORKTREE_A,
  baseOverride: null,
  generation: 1,
};

/**
 * Builds an overview scoped to the given snapshot.
 *
 * @param snapshotId - Snapshot the overview belongs to, or null when unusable.
 * @returns A minimal readonly overview with a resolved base.
 */
export function createOverview(
  snapshotId: RepositoryDiffOverview["currentSnapshotId"] = SNAPSHOT_1,
): RepositoryDiffOverview {
  return {
    repositoryId: RepositoryId.fromString("rr1_one"),
    base: {
      state: "resolved",
      source: "originHead",
      branchRef: "refs/remotes/origin/main",
      mergeBaseSha: "a".repeat(40),
      headSha: "b".repeat(40),
    },
    currentSnapshotId: snapshotId,
    changed: [],
    changedTree: [],
    allRoot: [],
    all: [],
    ignoredDirectories: [],
    warnings: [],
  };
}

/**
 * Builds an overview whose base override was rejected, so no snapshot exists.
 *
 * @returns A readonly overview with an `invalidOverride` base.
 */
export function createInvalidOverrideOverview(): RepositoryDiffOverview {
  return {
    ...createOverview(null),
    repositoryId: null,
    base: {
      state: "invalidOverride",
      reason: "invalidRef",
      overrideRef: "refs/heads/missing",
    },
  };
}

/**
 * Builds a tree node under the given path.
 *
 * @param name - File name, also used as the path suffix.
 * @returns A readonly ignored file node.
 */
export function createEntry(name: string): RepositoryTreeNode {
  return {
    path: `generated/${name}`,
    name,
    kind: "file",
    entryKind: "regular",
    change: null,
    ignored: true,
    children: { state: "loaded", items: [] },
  };
}

/**
 * Builds one page of ignored entries.
 *
 * @param nodeId - Node the page belongs to.
 * @param names - Entry names to include.
 * @param nextCursor - Cursor for the next page, or null to terminate.
 * @returns A readonly ignored page.
 */
export function createPage(
  nodeId: RepositoryNodeId,
  names: readonly string[],
  nextCursor: RepositoryIgnoredPage["nextCursor"] = null,
): RepositoryIgnoredPage {
  return { nodeId, entries: names.map(createEntry), nextCursor };
}

export const failure: RepositoryDiffFailure = {
  feature: "diff",
  kind: "transient",
  code: "io",
  message: "io failure",
  cause: {
    command: "load_repository_diff",
    code: "io",
    message: "io failure",
    raw: null,
  },
};

export const review: RepositoryFileReview = {
  file: {
    oldPath: "src/main.ts",
    newPath: "src/main.ts",
    change: "modified",
    entryKind: "regular",
    contentClassification: "text",
    similarity: null,
    oldMode: "100644",
    newMode: "100644",
  },
  oldContent: { state: "available", text: "a", reason: null, byteLength: null },
  newContent: { state: "available", text: "b", reason: null, byteLength: null },
  patch: { state: "available", text: "", reason: null, byteLength: null },
  structuredDiff: { state: "available", hunks: [], reason: null },
  submodule: null,
};
