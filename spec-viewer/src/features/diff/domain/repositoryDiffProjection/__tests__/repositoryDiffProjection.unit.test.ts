import { expect, test } from "vitest";

import type {
  DiffLineSource,
  FileChange,
  StructuredDiff,
} from "@/features/diff/domain/fileDiff";
import { Hunk } from "@/features/diff/domain/fileDiff";
import type { RepositoryTreeNode } from "@/features/diff/domain/repositoryDiff";
import {
  classifyTreeEntry,
  countLineChanges,
  projectChangedEntries,
} from "@/features/diff/domain/repositoryDiffProjection";

/**
 * Builds an available structured diff from the given per-hunk line groups.
 *
 * @param hunks - Line groups, one per hunk.
 * @returns An available structured diff.
 */
function createStructuredDiff(
  hunks: readonly (readonly DiffLineSource[])[],
): StructuredDiff {
  return {
    state: "available",
    hunks: hunks.map((lines) => Hunk.fromLines("@@ -1,3 +1,3 @@", lines)),
    reason: null,
  };
}

/**
 * Builds a file change with the given overrides applied.
 *
 * @param overrides - Fields to override on the default modified entry.
 * @returns A complete readonly file change.
 */
function createFileChange(overrides: Partial<FileChange> = {}): FileChange {
  return {
    oldPath: "src/main.ts",
    newPath: "src/main.ts",
    change: "modified",
    entryKind: "regular",
    contentClassification: "text",
    similarity: null,
    oldMode: "100644",
    newMode: "100644",
    ...overrides,
  };
}

/**
 * Builds a tree node with the given overrides applied.
 *
 * @param overrides - Fields to override on the default file node.
 * @returns A complete readonly tree node.
 */
function createTreeNode(
  overrides: Partial<RepositoryTreeNode> = {},
): RepositoryTreeNode {
  return {
    path: "src/main.ts",
    name: "main.ts",
    kind: "file",
    entryKind: "regular",
    change: null,
    ignored: false,
    children: { state: "loaded", items: [] },
    ...overrides,
  };
}

test("単一hunkの増減行数を数える", () => {
  const structuredDiff = createStructuredDiff([
    [
      { kind: "context", text: "a" },
      { kind: "removed", text: "b" },
      { kind: "added", text: "c" },
    ],
  ]);

  expect(countLineChanges(structuredDiff)).toEqual({
    additions: 1,
    deletions: 1,
  });
});

test("複数hunkの増減行数を合算する", () => {
  const structuredDiff = createStructuredDiff([
    [
      { kind: "added", text: "a" },
      { kind: "added", text: "b" },
    ],
    [
      { kind: "removed", text: "c" },
      { kind: "added", text: "d" },
    ],
  ]);

  expect(countLineChanges(structuredDiff)).toEqual({
    additions: 3,
    deletions: 1,
  });
});

test("contextとnoNewlineは増減に数えない", () => {
  const structuredDiff = createStructuredDiff([
    [
      { kind: "context", text: "a" },
      { kind: "context", text: "b" },
      { kind: "noNewline", text: "\\ No newline at end of file" },
    ],
  ]);

  expect(countLineChanges(structuredDiff)).toEqual({
    additions: 0,
    deletions: 0,
  });
});

test("hunksが空なら0件として数える", () => {
  expect(countLineChanges(createStructuredDiff([]))).toEqual({
    additions: 0,
    deletions: 0,
  });
});

test("omittedなstructuredDiffは0ではなくnullを返す", () => {
  expect(
    countLineChanges({ state: "omitted", hunks: [], reason: "binary" }),
  ).toBeNull();
});

test("ignored:trueかつchange:untrackedはignoredへ分類する", () => {
  expect(
    classifyTreeEntry(createTreeNode({ ignored: true, change: "untracked" })),
  ).toBe("ignored");
});

test.each([
  [{ ignored: false, change: "untracked" }, "untracked"],
  [{ ignored: false, change: "modified" }, "changed"],
  [{ ignored: false, change: null }, "unchanged"],
] as const)("tree entryを%oから分類する", (overrides, expected) => {
  expect(classifyTreeEntry(createTreeNode(overrides))).toBe(expected);
});

test("ignoredはchangeがnullでも優先される", () => {
  expect(
    classifyTreeEntry(createTreeNode({ ignored: true, change: null })),
  ).toBe("ignored");
});

test("projectChangedEntriesはbackendの順序を保つ", () => {
  const changed = [
    createFileChange({ newPath: "src/a.ts", oldPath: "src/a.ts" }),
    createFileChange({ newPath: "src/b.ts", oldPath: "src/b.ts" }),
    createFileChange({ newPath: "src/c.ts", oldPath: "src/c.ts" }),
  ];

  expect(projectChangedEntries(changed).map((entry) => entry.path)).toEqual([
    "src/a.ts",
    "src/b.ts",
    "src/c.ts",
  ]);
});

test("contentClassification=binaryはisBinary=trueになる", () => {
  const [entry] = projectChangedEntries([
    createFileChange({ contentClassification: "binary" }),
  ]);

  expect(entry?.isBinary).toBe(true);
});

test("contentClassification=textはisBinary=falseになる", () => {
  const [entry] = projectChangedEntries([createFileChange()]);

  expect(entry?.isBinary).toBe(false);
});

test("空配列は空配列を返す", () => {
  expect(projectChangedEntries([])).toEqual([]);
});

test("path内の区切り文字を含んでもidが衝突しない", () => {
  const entries = projectChangedEntries([
    createFileChange({ newPath: "a:b/c", oldPath: "a:b/c" }),
    createFileChange({ newPath: "a%3Ab/c", oldPath: "a%3Ab/c" }),
  ]);

  expect(entries[0]?.id).not.toBe(entries[1]?.id);
});

test("deletedはoldPathをpathとして採用する", () => {
  const [entry] = projectChangedEntries([
    createFileChange({
      change: "deleted",
      oldPath: "src/gone.ts",
      newPath: null,
    }),
  ]);

  expect(entry?.path).toBe("src/gone.ts");
});

test("同じoverviewを2回投影しても結果が一致し入力は変異しない", () => {
  const changed = [createFileChange(), createFileChange({ change: "added" })];
  const snapshot = structuredClone(changed);

  expect(projectChangedEntries(changed)).toEqual(
    projectChangedEntries(changed),
  );
  expect(changed).toEqual(snapshot);
});
