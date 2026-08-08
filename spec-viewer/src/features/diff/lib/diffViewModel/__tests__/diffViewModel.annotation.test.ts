import { expect, test } from "vitest";

import type { DiffLineSource, FileDiff } from "@/features/diff/domain/fileDiff";
import { Hunk } from "@/features/diff/domain/fileDiff";
import { buildDiffViewModel } from "@/features/diff/lib/diffViewModel";

test.each([
  {
    name: "removed直後",
    lines: [
      { kind: "removed", text: "old" },
      { kind: "noNewline", text: "\\ No newline at end of file" },
    ] satisfies readonly DiffLineSource[],
    side: "old",
  },
  {
    name: "added直後",
    lines: [
      { kind: "added", text: "new" },
      { kind: "noNewline", text: "\\ No newline at end of file" },
    ] satisfies readonly DiffLineSource[],
    side: "new",
  },
  {
    name: "context直後",
    lines: [
      { kind: "context", text: "same" },
      { kind: "noNewline", text: "\\ No newline at end of file" },
    ] satisfies readonly DiffLineSource[],
    side: "both",
  },
  {
    name: "先頭",
    lines: [
      { kind: "noNewline", text: "\\ No newline at end of file" },
    ] satisfies readonly DiffLineSource[],
    side: "both",
  },
])("$nameのnoNewlineを$side側annotationにする", ({ lines, side }) => {
  const model = buildDiffViewModel(createFileDiff(lines).review);
  const annotations = model.inlineRows.filter(
    (row) => row.kind === "annotation",
  );

  expect(annotations).toHaveLength(1);
  expect(annotations[0]?.side).toBe(side);
  expect(annotations[0]?.text).toBe("\\ No newline at end of file");
  expect(model.changeIds).toHaveLength(
    lines.some((line) => line.kind === "added" || line.kind === "removed")
      ? 1
      : 0,
  );
});

test("noNewlineを挟むchanged linesで表示mode間のchange IDを維持する", () => {
  const model = buildDiffViewModel(
    createFileDiff([
      { kind: "removed", text: "old" },
      { kind: "noNewline", text: "\\ No newline at end of file" },
      { kind: "added", text: "new" },
    ]).review,
  );
  const inlineChangeIds = model.inlineRows
    .filter((row) => row.kind === "content")
    .map((row) => row.changeId)
    .filter((changeId) => changeId !== null);
  const sideBySideChangeIds = model.sideBySideRows
    .filter((row) => row.kind === "content")
    .map((row) => row.changeId)
    .filter((changeId) => changeId !== null);

  expect(model.changeIds).toEqual(["hunk-0-change-0"]);
  expect(inlineChangeIds).toEqual(["hunk-0-change-0", "hunk-0-change-0"]);
  expect(sideBySideChangeIds).toEqual(["hunk-0-change-0", "hunk-0-change-0"]);
});

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
        hunks: [Hunk.fromLines("@@ -1,1 +1,1 @@", lines)],
        reason: null,
      },
      submodule: null,
    },
  };
}
