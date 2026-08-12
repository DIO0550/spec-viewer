import { expect, test } from "vitest";
import type {
  IgnoredPage,
  RepositoryDiffOverview,
  RepositoryDiffSelection,
  RepositoryFileReview,
  RepositoryTreeNode,
} from "@/features/repositoryDiff/domain/repositoryDiff";
import {
  deriveRepositoryDiffSummary,
  projectChangedFiles,
  projectFileReview,
  projectIgnoredPage,
  projectRepositoryDiffTree,
  projectRepositoryTree,
  toDiffViewerFileDiff,
} from "@/features/repositoryDiff/lib/projectRepositoryDiff";

const snapshotId = `rs1_${"a".repeat(64)}`;
const overviewBase: RepositoryDiffOverview["base"] = {
  state: "resolved",
  source: "main",
  branchRef: "refs/heads/main",
  mergeBaseSha: "b".repeat(40),
  headSha: "c".repeat(40),
};

function createOverview(
  changed: RepositoryDiffOverview["changed"],
): RepositoryDiffOverview {
  return {
    repositoryId: `rr1_${"d".repeat(64)}`,
    base: overviewBase,
    currentSnapshotId: snapshotId,
    changed,
    changedTree: [],
    allRoot: [],
    allPaths: [],
    ignoredDirectories: [],
    warnings: [],
  };
}

const added = {
  oldPath: null,
  newPath: "src/new.ts",
  change: "added",
  entryKind: "regular",
  contentClassification: "text",
  similarity: null,
  oldMode: null,
  newMode: null,
} as const;
const deleted = {
  oldPath: "src/old.ts",
  newPath: null,
  change: "deleted",
  entryKind: "regular",
  contentClassification: "text",
  similarity: null,
  oldMode: null,
  newMode: null,
} as const;
const renamed = {
  oldPath: "src/before.ts",
  newPath: "src/after.ts",
  change: "renamed",
  entryKind: "regular",
  contentClassification: "text",
  similarity: 80,
  oldMode: null,
  newMode: null,
} as const;

const ignoredDirectory: RepositoryTreeNode = {
  path: "vendor",
  name: "vendor",
  kind: "directory",
  entryKind: null,
  change: null,
  ignored: true,
  children: { state: "deferred", nodeId: `in1_${"e".repeat(64)}` },
};

const review = (
  change: "modified" | "deleted" | null,
  classification: "text" | "binary",
): RepositoryFileReview => ({
  file: {
    oldPath:
      change === "deleted"
        ? "src/old.ts"
        : change === null
          ? null
          : "src/file.ts",
    newPath: change === "deleted" ? null : "src/file.ts",
    change,
    entryKind: "regular",
    contentClassification: classification,
    similarity: null,
    oldMode: null,
    newMode: null,
  },
  oldContent:
    classification === "binary"
      ? { state: "omitted", text: null, reason: "binary", byteLength: 3 }
      : { state: "available", text: "old", reason: null, byteLength: null },
  newContent:
    change === "deleted"
      ? {
          state: "omitted",
          text: null,
          reason: "missingSide",
          byteLength: null,
        }
      : classification === "binary"
        ? { state: "omitted", text: null, reason: "binary", byteLength: 3 }
        : { state: "available", text: "new", reason: null, byteLength: null },
  patch:
    classification === "binary"
      ? { state: "omitted", text: null, reason: "binary", byteLength: 6 }
      : { state: "available", text: "patch", reason: null, byteLength: null },
  structuredDiff:
    classification === "binary"
      ? { state: "omitted", hunks: [], reason: "binary" }
      : { state: "available", hunks: [], reason: null },
  submodule: null,
});

test("changed projection は added/deleted/rename の表示pathと安定idを作る", () => {
  const items = projectChangedFiles(
    createOverview([added, deleted, renamed]),
    "/workspace",
  );

  expect(items.map((item) => item.path)).toEqual([
    "src/new.ts",
    "src/old.ts",
    "src/after.ts",
  ]);
  expect(items.map((item) => item.change)).toEqual([
    "added",
    "deleted",
    "renamed",
  ]);
  expect(new Set(items.map((item) => item.id)).size).toBe(3);
  expect(Object.keys(items[0] ?? {})).not.toContain("specId");
  expect(Object.keys(items[0] ?? {})).not.toContain("fileKey");
});

test("projection id は worktree/base/snapshot/path の変更で衝突しない", () => {
  const file = projectChangedFiles(createOverview([added]), "/workspace")[0];
  const otherWorktree = projectChangedFiles(
    createOverview([added]),
    "/other",
  )[0];
  const otherSnapshot = projectChangedFiles(
    { ...createOverview([added]), currentSnapshotId: `rs1_${"f".repeat(64)}` },
    "/workspace",
  )[0];
  const otherBase = projectChangedFiles(
    {
      ...createOverview([added]),
      base: { ...overviewBase, mergeBaseSha: "1".repeat(40) },
    },
    "/workspace",
  )[0];

  expect(file?.id).not.toBe(otherWorktree?.id);
  expect(file?.id).not.toBe(otherSnapshot?.id);
  expect(file?.id).not.toBe(otherBase?.id);
});

test("ignored/deferred tree と ignored page は change status と分離して投影する", () => {
  const overview = createOverview([]);
  const treeItems = projectRepositoryTree(
    [ignoredDirectory],
    overview,
    "/workspace",
  );
  const pageItems = projectIgnoredPage(
    {
      nodeId: `in1_${"e".repeat(64)}`,
      entries: [{ ...ignoredDirectory, path: "vendor/pkg", name: "pkg" }],
      nextCursor: "cursor-2",
    },
    overview,
    "/workspace",
  );

  expect(treeItems).toEqual([
    expect.objectContaining({
      path: "vendor",
      ignored: true,
      change: null,
      deferredNodeId: `in1_${"e".repeat(64)}`,
    }),
  ]);
  expect(pageItems[0]).toEqual(
    expect.objectContaining({
      path: "vendor/pkg",
      ignored: true,
      change: null,
    }),
  );
});

test("file review projection は binary と deleted の availability を UI-decideable にする", () => {
  const binarySelection: RepositoryDiffSelection = {
    worktreeId: "/workspace",
    snapshotId,
    path: "src/file.bin",
  };
  const deletedSelection: RepositoryDiffSelection = {
    worktreeId: "/workspace",
    snapshotId,
    path: "src/old.ts",
  };

  expect(
    projectFileReview(review("modified", "binary"), binarySelection),
  ).toEqual(
    expect.objectContaining({ path: "src/file.ts", availability: "binary" }),
  );
  expect(
    projectFileReview(review("deleted", "text"), deletedSelection),
  ).toEqual(
    expect.objectContaining({ path: "src/old.ts", availability: "deleted" }),
  );
});

test("toDiffViewerFileDiffはrepository identityとavailabilityをgeneric modelへ変換する", () => {
  const selection: RepositoryDiffSelection = {
    worktreeId: "/workspace",
    snapshotId,
    path: "src/file.ts",
  };
  const result = toDiffViewerFileDiff(review("modified", "text"), selection);

  expect(result.identity).toEqual({
    sourceId: `repository:/workspace:${snapshotId}`,
    path: "src/file.ts",
  });
  expect(result.availability).toEqual({ kind: "empty" });
});

test("Allの未変更fileはnull statusを保ちEditor用current modelへ変換する", () => {
  const selection: RepositoryDiffSelection = {
    worktreeId: "/workspace",
    snapshotId,
    path: "src/file.ts",
  };
  const repositoryReview = review(null, "text");

  expect(
    projectFileReview(repositoryReview, selection).review.file.change,
  ).toBe(null);
  expect(toDiffViewerFileDiff(repositoryReview, selection)).toMatchObject({
    review: {
      file: {
        oldPath: "src/file.ts",
        newPath: "src/file.ts",
        change: "modified",
      },
      oldContent: {
        state: "available",
        text: "new",
      },
      newContent: {
        state: "available",
        text: "new",
      },
    },
    availability: { kind: "empty" },
  });
});

test("toDiffViewerFileDiffはbinary reviewをomitted binaryとして変換する", () => {
  const selection: RepositoryDiffSelection = {
    worktreeId: "/workspace",
    snapshotId,
    path: "src/file.bin",
  };
  const result = toDiffViewerFileDiff(review("modified", "binary"), selection);

  expect(result.availability).toEqual({ kind: "omitted", reason: "binary" });
});

test.each([
  { change: "added", oldPath: null, newPath: "src/added.ts" },
  { change: "modified", oldPath: "src/file.ts", newPath: "src/file.ts" },
  { change: "deleted", oldPath: "src/deleted.ts", newPath: null },
  { change: "renamed", oldPath: "src/before.ts", newPath: "src/after.ts" },
  { change: "copied", oldPath: "src/source.ts", newPath: "src/copy.ts" },
  { change: "typeChanged", oldPath: "src/file.ts", newPath: "src/file.ts" },
  { change: "untracked", oldPath: null, newPath: "src/untracked.ts" },
] as const)("projectChangedFilesはstatus=%sを保持する", ({
  change,
  oldPath,
  newPath,
}) => {
  const item = projectChangedFiles(
    createOverview([
      {
        ...added,
        change,
        oldPath,
        newPath,
      },
    ]),
    "/workspace",
  )[0];

  expect(item?.change).toBe(change);
});

test("summaryはChangedとAllでlogical totalを切り替え、ignored directoryを別集計する", () => {
  const overview = {
    ...createOverview([added, deleted]),
    allPaths: ["src/new.ts", "src/old.ts", "vendor/package.json"],
    ignoredDirectories: ["vendor"],
  };

  expect(deriveRepositoryDiffSummary(overview, "changed")).toEqual({
    filter: "changed",
    totalPaths: 2,
    changedPaths: 2,
    statusCounts: { added: 1, deleted: 1 },
    ignoredDirectoryCount: 1,
  });
  expect(deriveRepositoryDiffSummary(overview, "all")).toEqual({
    filter: "all",
    totalPaths: 3,
    changedPaths: 2,
    statusCounts: { added: 1, deleted: 1 },
    ignoredDirectoryCount: 1,
  });
});

test("summaryは全FileChangeStatusをstage bucketなしで集計する", () => {
  const statuses = [
    "added",
    "modified",
    "deleted",
    "renamed",
    "copied",
    "typeChanged",
    "untracked",
  ] as const;
  const overview = createOverview(
    statuses.map((change) => ({ ...added, change })),
  );

  expect(deriveRepositoryDiffSummary(overview, "changed").statusCounts).toEqual(
    Object.fromEntries(statuses.map((change) => [change, 1])),
  );
});

test("nested projectionはChangedのloaded treeとAllのdeferred treeを区別する", () => {
  const file: RepositoryTreeNode = {
    path: "src/main.ts",
    name: "main.ts",
    kind: "file",
    entryKind: "regular",
    change: "modified",
    ignored: false,
    children: { state: "loaded", items: [] },
  };
  const source: RepositoryTreeNode = {
    path: "src",
    name: "src",
    kind: "directory",
    entryKind: null,
    change: null,
    ignored: false,
    children: { state: "loaded", items: [file] },
  };
  const ignored: RepositoryTreeNode = {
    ...ignoredDirectory,
    path: "vendor",
    name: "vendor",
  };
  const overview = {
    ...createOverview([added]),
    changedTree: [source],
    allRoot: [source, ignored],
    allPaths: ["src/main.ts", "vendor/package.json"],
  };
  const common = {
    overview,
    worktreeId: "/workspace",
    ignoredPages: {},
    ignoredPageStates: {},
  };
  const changed = projectRepositoryDiffTree({
    ...common,
    filter: "changed",
    nodes: overview.changedTree,
  });
  const all = projectRepositoryDiffTree({
    ...common,
    filter: "all",
    nodes: overview.allRoot,
  });

  expect(changed[0]?.children.items[0]).toEqual(
    expect.objectContaining({ path: "src/main.ts", deferredNodeId: null }),
  );
  expect(all[1]).toEqual(
    expect.objectContaining({
      path: "vendor",
      deferredNodeId: `in1_${"e".repeat(64)}`,
      children: expect.objectContaining({ state: "deferred" }),
    }),
  );
  expect(all[1]?.id).not.toBe(all[1]?.deferredNodeId);
});

test("ignored pageは親nodeのchildrenへappendし、page件数をsummaryへ加算しない", () => {
  const pageNode: RepositoryTreeNode = {
    path: "vendor/package.json",
    name: "package.json",
    kind: "file",
    entryKind: "regular",
    change: null,
    ignored: true,
    children: { state: "loaded", items: [] },
  };
  const overview = {
    ...createOverview([]),
    allRoot: [ignoredDirectory],
    allPaths: ["vendor/package.json"],
  };
  const projected = projectRepositoryDiffTree({
    nodes: overview.allRoot,
    overview,
    worktreeId: "/workspace",
    filter: "all",
    ignoredPages: {
      [ignoredDirectory.children.state === "deferred"
        ? ignoredDirectory.children.nodeId
        : ""]: {
        nodeId: `in1_${"e".repeat(64)}`,
        entries: [pageNode, { ...pageNode }],
        nextCursor: "cursor-2",
      },
    },
    ignoredPageStates: {},
  });

  expect(projected[0]?.children).toEqual(
    expect.objectContaining({
      state: "loaded",
      nextCursor: "cursor-2",
      items: [expect.objectContaining({ path: "vendor/package.json" })],
    }),
  );
  expect(deriveRepositoryDiffSummary(overview, "all").totalPaths).toBe(1);
});

test("ignored pageのloading・failed stateは既存rowを残して状態を投影する", () => {
  const overview = { ...createOverview([]), allRoot: [ignoredDirectory] };
  const nodeId =
    ignoredDirectory.children.state === "deferred"
      ? ignoredDirectory.children.nodeId
      : "";
  const page: IgnoredPage = {
    nodeId,
    entries: [],
    nextCursor: null,
  };
  const identity = {
    request: {
      workspacePath: "/workspace",
      worktreeId: "/workspace",
      baseOverride: null,
      cycleId: 1,
      requestGeneration: 1,
    },
    snapshotId,
    nodeId,
    cursor: null,
    pageGeneration: 1,
  };

  const loading = projectRepositoryDiffTree({
    nodes: overview.allRoot,
    overview,
    worktreeId: "/workspace",
    filter: "all",
    ignoredPages: { [nodeId]: page },
    ignoredPageStates: { [nodeId]: { status: "loading", identity } },
  });
  const failed = projectRepositoryDiffTree({
    nodes: overview.allRoot,
    overview,
    worktreeId: "/workspace",
    filter: "all",
    ignoredPages: { [nodeId]: page },
    ignoredPageStates: {
      [nodeId]: {
        status: "failed",
        identity,
        error: { code: "staleCursor", message: "retry", retryable: true },
      },
    },
  });

  expect(loading[0]?.children.state).toBe("loading");
  expect(failed[0]?.children).toEqual(
    expect.objectContaining({ state: "failed", message: "retry" }),
  );
});
