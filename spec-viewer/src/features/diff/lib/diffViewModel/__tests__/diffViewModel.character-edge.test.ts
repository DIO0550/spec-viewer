import { expect, test } from "vitest";

import type { DiffLineSource, FileDiff } from "@/features/diff/domain/fileDiff";
import { Hunk } from "@/features/diff/domain/fileDiff";
import { buildDiffViewModel } from "@/features/diff/lib/diffViewModel";

test("空textのpaired変更でも両sideに表示segmentを残す", () => {
  const model = buildDiffViewModel(
    createFileDiff([
      { kind: "removed", text: "" },
      { kind: "added", text: "" },
    ]).review,
  );
  const row = findChangedRow(model.sideBySideRows);

  expect(row.old?.segments).toEqual([{ kind: "removed", text: "" }]);
  expect(row.next?.segments).toEqual([{ kind: "added", text: "" }]);
});

test("空白とemojiの変更を文字列破損なく再構成する", () => {
  const model = buildDiffViewModel(
    createFileDiff([
      { kind: "removed", text: "hello  👋" },
      { kind: "added", text: "hello 👋🏻" },
    ]).review,
  );
  const row = findChangedRow(model.sideBySideRows);

  expect(row.old?.segments.map((segment) => segment.text).join("")).toBe(
    "hello  👋",
  );
  expect(row.next?.segments.map((segment) => segment.text).join("")).toBe(
    "hello 👋🏻",
  );
});

test.each([
  [
    [{ kind: "added", text: "new" }] satisfies readonly DiffLineSource[],
    "added",
    "next",
  ],
  [
    [{ kind: "removed", text: "old" }] satisfies readonly DiffLineSource[],
    "removed",
    "old",
  ],
] as const)("片側だけの変更は行全体を%s表示する", (lines, expectedKind, cellSide) => {
  const model = buildDiffViewModel(createFileDiff(lines).review);
  const row = findChangedRow(model.sideBySideRows);
  const cell = row[cellSide];

  expect(cell?.segments).toEqual([
    { kind: expectedKind, text: cell?.line.text },
  ]);
});

function findChangedRow(
  rows: ReturnType<typeof buildDiffViewModel>["sideBySideRows"],
) {
  const row = rows.find(
    (candidate) => candidate.kind === "content" && candidate.changeId !== null,
  );
  expect(row?.kind).toBe("content");
  return row as Extract<(typeof rows)[number], { kind: "content" }>;
}

function createFileDiff(lines: readonly DiffLineSource[]): FileDiff {
  return {
    specId: "078-issue-167",
    fileKey: "implementation-plan",
    review: {
      file: {
        oldPath: "implementation-plan.md",
        newPath: "implementation-plan.md",
        change: "modified",
        entryKind: "regular",
        contentClassification: "text",
        similarity: null,
        oldMode: "100644",
        newMode: "100644",
      },
      oldContent: {
        state: "available",
        text: "",
        reason: null,
        byteLength: null,
      },
      newContent: {
        state: "available",
        text: "",
        reason: null,
        byteLength: null,
      },
      patch: { state: "available", text: "", reason: null, byteLength: null },
      structuredDiff: {
        state: "available",
        hunks: [Hunk.fromLines("@@ -1,2 +1,2 @@", lines)],
        reason: null,
      },
      submodule: null,
    },
  };
}
