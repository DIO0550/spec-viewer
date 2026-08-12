import { expect, test } from "vitest";
import type { FileDiff } from "@/features/diff/domain/fileDiff";
import type {
  RepositoryChangedFile,
  RepositoryDiffOverview,
  RepositoryDiffTreeProjectionNode,
} from "@/features/repositoryDiff/domain/repositoryDiff";
import {
  collectValidRepositoryFilePaths,
  findRepositoryDiffFile,
  formatRevisionIdentifier,
  getRepositoryDiffLogicalPath,
  summarizeFileDiff,
} from "@/features/repositoryDiff/lib/repositoryDiffFilePresentation";

const file = (
  change: RepositoryChangedFile["change"],
  oldPath: string | null,
  newPath: string | null,
): RepositoryChangedFile => ({
  oldPath,
  newPath,
  change,
  entryKind: "regular",
  contentClassification: "text",
  similarity: null,
  oldMode: null,
  newMode: null,
});

const renamed = file("renamed", "src/old.ts", "src/new.ts");
const deleted = file("deleted", "src/deleted.ts", null);

const overview: RepositoryDiffOverview = {
  repositoryId: null,
  base: {
    state: "resolved",
    source: "main",
    branchRef: "refs/heads/main",
    mergeBaseSha: "a".repeat(40),
    headSha: "b".repeat(40),
  },
  currentSnapshotId: `rs1_${"c".repeat(64)}`,
  changed: [renamed, deleted],
  changedTree: [],
  allRoot: [],
  allPaths: ["README.md"],
  ignoredDirectories: [],
  warnings: [],
};

test.each([
  [renamed, "src/new.ts"],
  [deleted, "src/deleted.ts"],
] as const)("rename/deleteのlogical pathを返す", (value, expected) => {
  expect(getRepositoryDiffLogicalPath(value)).toBe(expected);
});

test("logical pathでchanged fileを検索する", () => {
  expect(findRepositoryDiffFile(overview, "src/new.ts")).toBe(renamed);
  expect(findRepositoryDiffFile(overview, "src/old.ts")).toBeNull();
});

test("allPaths・changed・loaded ignored fileのvalid unionを作る", () => {
  const loadedFile: RepositoryDiffTreeProjectionNode = {
    id: "ignored",
    path: "vendor/loaded.log",
    name: "loaded.log",
    kind: "file",
    entryKind: "regular",
    contentClassification: null,
    oldPath: null,
    change: null,
    ignored: true,
    deferredNodeId: null,
    children: {
      state: "loaded",
      items: [],
      nextCursor: null,
      message: null,
    },
  };

  expect(collectValidRepositoryFilePaths(overview, [loadedFile])).toEqual([
    "README.md",
    "src/new.ts",
    "src/deleted.ts",
    "vendor/loaded.log",
  ]);
});

test("available diffの追加・削除行を合算しomittedはnullにする", () => {
  const available = createFileDiff({
    state: "available",
    reason: null,
    hunks: [
      {
        header: "@@ -1,2 +1,2 @@",
        lines: [
          {
            kind: "removed",
            text: "old",
            oldLineNumber: 1,
            newLineNumber: null,
          },
          { kind: "added", text: "new", oldLineNumber: null, newLineNumber: 1 },
          {
            kind: "added",
            text: "next",
            oldLineNumber: null,
            newLineNumber: 2,
          },
        ],
      },
    ],
  });
  const omitted = createFileDiff({
    state: "omitted",
    reason: "binary",
    hunks: [],
  });

  expect(summarizeFileDiff(available)).toEqual({ additions: 2, deletions: 1 });
  expect(summarizeFileDiff(omitted)).toBeNull();
});

test.each([
  ["abcdef0123456789abcdef0123456789abcdef01", "abcdef0"],
  [`rs1_${"a".repeat(64)}`, `rs1_${"a".repeat(8)}`],
  [null, "未解決"],
  ["working-tree", "working-tree"],
] as const)("revision identifierを短縮する", (value, expected) => {
  expect(formatRevisionIdentifier(value)).toBe(expected);
});

function createFileDiff(
  structuredDiff: FileDiff["review"]["structuredDiff"],
): FileDiff {
  return {
    identity: { sourceId: "source", path: "src/file.ts" },
    availability:
      structuredDiff.state === "omitted"
        ? { kind: "omitted", reason: structuredDiff.reason }
        : { kind: "ready" },
    review: {
      file: {
        oldPath: "src/file.ts",
        newPath: "src/file.ts",
        change: "modified",
        entryKind: "regular",
        contentClassification: "text",
        similarity: null,
        oldMode: null,
        newMode: null,
      },
      oldContent: {
        state: "available",
        text: "old",
        reason: null,
        byteLength: null,
      },
      newContent: {
        state: "available",
        text: "new",
        reason: null,
        byteLength: null,
      },
      patch: { state: "available", text: "", reason: null, byteLength: null },
      structuredDiff,
      submodule: null,
    },
  };
}
