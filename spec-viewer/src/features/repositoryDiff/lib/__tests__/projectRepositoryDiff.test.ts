import { expect, test } from "vitest";
import type {
  RepositoryDiffOverview,
  RepositoryDiffSelection,
  RepositoryFileReview,
  RepositoryTreeNode,
} from "@/features/repositoryDiff/domain/repositoryDiff";
import {
  projectChangedFiles,
  projectFileReview,
  projectIgnoredPage,
  projectRepositoryTree,
  toDiffViewerFileDiff,
} from "@/features/repositoryDiff/lib/projectRepositoryDiff";

const snapshotId = "rs1_" + "a".repeat(64);
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
    repositoryId: "rr1_" + "d".repeat(64),
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
  children: { state: "deferred", nodeId: "in1_" + "e".repeat(64) },
};

const review = (
  change: "modified" | "deleted",
  classification: "text" | "binary",
): RepositoryFileReview => ({
  file: {
    oldPath: change === "deleted" ? "src/old.ts" : "src/file.ts",
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
    { ...createOverview([added]), currentSnapshotId: "rs1_" + "f".repeat(64) },
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
      nodeId: "in1_" + "e".repeat(64),
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
      deferredNodeId: "in1_" + "e".repeat(64),
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
    sourceId: "repository:/workspace",
    path: "src/file.ts",
  });
  expect(result.availability).toEqual({ kind: "empty" });
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
