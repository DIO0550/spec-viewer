import { expect, test } from "vitest";

import type { DiffLineSource, FileDiff } from "@/features/diff/domain/fileDiff";
import { Hunk } from "@/features/diff/domain/fileDiff";
import {
  buildDiffViewModel,
  type DiffViewRow,
} from "@/features/diff/lib/diffViewModel";

test.each([
  {
    name: "removed余剰",
    lines: [
      { kind: "removed", text: "old one" },
      { kind: "removed", text: "old two" },
      { kind: "added", text: "new one" },
      { kind: "context", text: "after" },
    ] satisfies readonly DiffLineSource[],
    pairs: [
      ["old one", "new one"],
      ["old two", null],
      ["after", "after"],
    ],
  },
  {
    name: "added余剰",
    lines: [
      { kind: "removed", text: "old one" },
      { kind: "added", text: "new one" },
      { kind: "added", text: "new two" },
    ] satisfies readonly DiffLineSource[],
    pairs: [
      ["old one", "new one"],
      [null, "new two"],
    ],
  },
  {
    name: "added-only",
    lines: [
      { kind: "added", text: "new one" },
    ] satisfies readonly DiffLineSource[],
    pairs: [[null, "new one"]],
  },
  {
    name: "removed-only",
    lines: [
      { kind: "removed", text: "old one" },
    ] satisfies readonly DiffLineSource[],
    pairs: [["old one", null]],
  },
])("$name blockは不足側をnull spacerにする", ({ lines, pairs }) => {
  const model = buildDiffViewModel(createFileDiff(lines).review);
  const actualPairs = model.sideBySideRows
    .filter(
      (row): row is Extract<DiffViewRow, { kind: "content" }> =>
        row.kind === "content",
    )
    .map((row) => [row.old?.line.text ?? null, row.next?.line.text ?? null]);

  expect(actualPairs).toEqual(pairs);
  expect(
    model.inlineRows
      .filter(
        (row): row is Extract<DiffViewRow, { kind: "content" }> =>
          row.kind === "content" && row.changeId !== null,
      )
      .map((row) => row.changeId),
  ).not.toHaveLength(0);
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
        hunks: [Hunk.fromLines("@@ -1,4 +1,4 @@", lines)],
        reason: null,
      },
      submodule: null,
    },
  };
}
