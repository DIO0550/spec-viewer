import {
  createMinimalDetailResponse,
  type DetailResponseFixture,
} from "./specDiffTestFixtures";

export type BaseResponseFixture = {
  state: string;
  source: string | null;
  branchRef: string | null;
  mergeBaseSha: string | null;
  headSha: string | null;
  reason: string | null;
  candidates: string[];
  overrideRef: string | null;
};

export type TreeChildrenFixture =
  | { state: string; items: TreeNodeFixture[] }
  | { state: string; nodeId: string };

export type TreeNodeFixture = {
  path: string;
  name: string;
  kind: string;
  entryKind: string | null;
  change: string | null;
  ignored: boolean;
  children: TreeChildrenFixture;
};

export type FileChangeFixture = {
  oldPath: string | null;
  newPath: string | null;
  change: string;
  entryKind: string;
  contentClassification: string;
  similarity: number | null;
  oldMode: string | null;
  newMode: string | null;
};

export type OverviewResponseFixture = {
  repositoryId: string | null;
  base: BaseResponseFixture;
  currentSnapshotId: string | null;
  changed: FileChangeFixture[];
  changedTree: TreeNodeFixture[];
  allRoot: TreeNodeFixture[];
  all: string[];
  ignoredDirectories: string[];
  warnings: string[];
};

export type IgnoredPageResponseFixture = {
  nodeId: string;
  entries: TreeNodeFixture[];
  nextCursor: string | null;
};

export const SAMPLE_REPOSITORY_ID = `rr1_${"a".repeat(64)}`;
export const SAMPLE_SNAPSHOT_ID = `rs1_${"b".repeat(64)}`;
export const SAMPLE_NODE_ID = `in1_${"c".repeat(64)}`;

/** @returns A resolved base response with every optional field populated. */
export const createResolvedBaseResponse = (): BaseResponseFixture => ({
  state: "resolved",
  source: "originHead",
  branchRef: "refs/remotes/origin/main",
  mergeBaseSha: "1".repeat(40),
  headSha: "2".repeat(40),
  reason: null,
  candidates: [],
  overrideRef: null,
});

/** @returns A needsSelection base response whose reason is an unborn HEAD. */
export const createNeedsSelectionBaseResponse = (): BaseResponseFixture => ({
  state: "needsSelection",
  source: null,
  branchRef: null,
  mergeBaseSha: null,
  headSha: null,
  reason: "unbornHead",
  candidates: ["refs/heads/main"],
  overrideRef: null,
});

/** @returns An invalidOverride base response returned as a success payload. */
export const createInvalidOverrideBaseResponse = (): BaseResponseFixture => ({
  state: "invalidOverride",
  source: null,
  branchRef: null,
  mergeBaseSha: null,
  headSha: null,
  reason: "invalidRef",
  candidates: [],
  overrideRef: "refs/heads/missing",
});

/** @returns A minimal modified regular-file change entry. */
export const createFileChangeFixture = (): FileChangeFixture => ({
  oldPath: "src/main.ts",
  newPath: "src/main.ts",
  change: "modified",
  entryKind: "regular",
  contentClassification: "text",
  similarity: null,
  oldMode: "100644",
  newMode: "100644",
});

/** @returns A directory node whose children are already loaded and empty. */
export const createLoadedTreeNodeFixture = (): TreeNodeFixture => ({
  path: "src",
  name: "src",
  kind: "directory",
  entryKind: null,
  change: null,
  ignored: false,
  children: { state: "loaded", items: [] },
});

/** @returns An ignored directory node whose children must be fetched lazily. */
export const createDeferredTreeNodeFixture = (): TreeNodeFixture => ({
  path: "generated",
  name: "generated",
  kind: "directory",
  entryKind: null,
  change: null,
  ignored: true,
  children: { state: "deferred", nodeId: SAMPLE_NODE_ID },
});

/** @returns A regular file node with an untracked change. */
export const createFileTreeNodeFixture = (): TreeNodeFixture => ({
  path: "src/main.ts",
  name: "main.ts",
  kind: "file",
  entryKind: "regular",
  change: "untracked",
  ignored: false,
  children: { state: "loaded", items: [] },
});

/** @returns A minimal valid `load_repository_diff` response with a resolved base. */
export const createMinimalOverviewResponse = (): OverviewResponseFixture => ({
  repositoryId: SAMPLE_REPOSITORY_ID,
  base: createResolvedBaseResponse(),
  currentSnapshotId: SAMPLE_SNAPSHOT_ID,
  changed: [],
  changedTree: [],
  allRoot: [],
  all: [],
  ignoredDirectories: [],
  warnings: [],
});

/** @returns A minimal valid `traverse_repository_ignored` terminal page. */
export const createMinimalIgnoredPageResponse =
  (): IgnoredPageResponseFixture => ({
    nodeId: SAMPLE_NODE_ID,
    entries: [],
    nextCursor: null,
  });

/**
 * Reuses the Spec detail fixture's review payload so the transport contract is
 * described in exactly one place.
 *
 * @returns A minimal valid `load_repository_file` response.
 */
export const createMinimalFileReviewResponse =
  (): DetailResponseFixture["review"] =>
    structuredClone(createMinimalDetailResponse().review);
