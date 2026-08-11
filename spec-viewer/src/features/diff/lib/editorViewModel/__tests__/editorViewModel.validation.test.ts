import { expect, test } from "vitest";

import type {
  FileDiff,
  Hunk as HunkType,
} from "@/features/diff/domain/fileDiff";
import { deriveDiffAvailability, Hunk } from "@/features/diff/domain/fileDiff";
import { buildEditorViewModel } from "@/features/diff/lib/editorViewModel";

test("非先頭のremoved-only 0行new rangeを有効なEOF境界として扱う", () => {
  const model = buildEditorViewModel(
    createFileDiff({
      oldContent: "remaining\ndeleted",
      newContent: "remaining",
      hunks: [
        Hunk.fromLines("@@ -1,2 +1,1 @@", [
          { kind: "context", text: "remaining" },
          { kind: "removed", text: "deleted" },
        ]),
      ],
    }),
  );

  expect(model.state).toBe("ready");
  expect(model.peeks[0]?.boundary).toEqual({ kind: "eof" });
});

test.each([
  [
    "old line number progression",
    [{ kind: "removed", text: "old", oldLineNumber: 2, newLineNumber: null }],
  ],
  [
    "new line number progression",
    [{ kind: "added", text: "new", oldLineNumber: null, newLineNumber: 2 }],
  ],
] as const)("不正な%sをinconsistentへ落とす", (_label, lines) => {
  const model = buildEditorViewModel(
    createFileDiff({
      oldContent: "old",
      newContent: "new",
      hunks: [{ header: "@@ -1 +1 @@", lines }],
    }),
  );

  expect(model.state).toBe("inconsistent");
  expect(model.orderedChangeIds).toEqual([]);
});

test("hunk間のcurrent line重複をinconsistentへ落とす", () => {
  const model = buildEditorViewModel(
    createFileDiff({
      oldContent: "new",
      newContent: "new",
      hunks: [
        Hunk.fromLines("@@ -1 +1 @@", [{ kind: "context", text: "new" }]),
        Hunk.fromLines("@@ -1 +1 @@", [{ kind: "context", text: "new" }]),
      ],
    }),
  );

  expect(model.state).toBe("inconsistent");
  expect(model.inconsistencyReason).toContain("overlaps");
});

test("同じcurrent境界を持つ別hunkの削除をinconsistentへ落とす", () => {
  const model = buildEditorViewModel(
    createFileDiff({
      oldContent: "first\nsecond\nremaining",
      newContent: "remaining",
      hunks: [
        Hunk.fromLines("@@ -1,1 +1,0 @@", [{ kind: "removed", text: "first" }]),
        Hunk.fromLines("@@ -2,1 +1,0 @@", [
          { kind: "removed", text: "second" },
        ]),
      ],
    }),
  );

  expect(model.state).toBe("inconsistent");
  expect(model.inconsistencyReason).toContain("boundaries");
});

test.each([
  "committed",
  "staged",
  "unstaged",
  "untracked",
])("%s由来でもsource field分岐なしで同じprojectionを返す", (source) => {
  const fileDiff = createFileDiff({
    oldContent: "old",
    newContent: "new",
    hunks: [
      Hunk.fromLines("@@ -1 +1 @@", [
        { kind: "removed", text: "old" },
        { kind: "added", text: "new" },
      ]),
    ],
  });

  const model = buildEditorViewModel({
    ...fileDiff,
    identity: { ...fileDiff.identity, sourceId: `${source}:snapshot` },
  });

  expect(model.state).toBe("ready");
  expect(model.currentLines[0]).toMatchObject({
    gutterKind: "modified",
    changeId: "hunk-0-change-0",
  });
});

function createFileDiff(
  input: Readonly<{
    oldContent: string;
    newContent: string;
    hunks: readonly HunkType[];
  }>,
): FileDiff {
  const available = (text: string) => ({
    state: "available" as const,
    text,
    reason: null,
    byteLength: null,
  });
  const review = {
    file: {
      oldPath: "file.ts",
      newPath: "file.ts",
      change: "modified" as const,
      entryKind: "regular" as const,
      contentClassification: "text" as const,
      similarity: null,
      oldMode: "100644",
      newMode: "100644",
    },
    oldContent: available(input.oldContent),
    newContent: available(input.newContent),
    patch: available(""),
    structuredDiff: {
      state: "available" as const,
      hunks: input.hunks,
      reason: null,
    },
    submodule: null,
  };
  return {
    identity: { sourceId: "source:snapshot", path: "file.ts" },
    review,
    availability: deriveDiffAvailability(review),
  };
}
