import { expect, test } from "vitest";

import type { DiffLineSource, FileDiff } from "@/features/diff/domain/fileDiff";
import { Hunk } from "@/features/diff/domain/fileDiff";
import {
  buildDiffViewModel,
  type DiffViewRow,
} from "@/features/diff/lib/diffViewModel";

test.each([
  [4_096, true],
  [4_097, false],
] as const)("1 pair合計%s code unitsの文字差分実行可否は%s", (totalLength, expected) => {
  const oldLength = Math.floor(totalLength / 2);
  const newLength = totalLength - oldLength;
  const model = buildDiffViewModel(
    createFileDiff([
      { kind: "removed", text: `${"a".repeat(oldLength - 1)}x` },
      { kind: "added", text: `${"a".repeat(newLength - 1)}y` },
    ]).review,
  );
  const row = findChangedRows(model)[0];

  expect(
    row?.old?.segments.some((segment) => segment.kind === "unchanged"),
  ).toBe(expected);
});

test("251 pair目は既定pair budgetを超えてwhole-lineへfallbackする", () => {
  const lines = Array.from(
    { length: 251 },
    (_, index): readonly DiffLineSource[] => [
      { kind: "removed", text: `before-${index}` },
      { kind: "added", text: `after-${index}` },
    ],
  ).flat();
  const rows = findChangedRows(
    buildDiffViewModel(createFileDiff(lines).review),
  );

  expect(
    rows[249]?.old?.segments.some((segment) => segment.kind === "unchanged"),
  ).toBe(true);
  expect(rows[250]?.old?.segments).toEqual([
    { kind: "removed", text: "before-250" },
  ]);
});

test("累積100,000 code units超過pairはwhole-lineへfallbackする", () => {
  const model = buildDiffViewModel(
    createFileDiff([
      { kind: "removed", text: `${"a".repeat(49_999)}x` },
      { kind: "added", text: `${"a".repeat(49_999)}y` },
      { kind: "removed", text: "before" },
      { kind: "added", text: "after" },
    ]).review,
    { maxCodeUnitsPerPair: 100_000 },
  );
  const rows = findChangedRows(model);

  expect(
    rows[0]?.old?.segments.some((segment) => segment.kind === "unchanged"),
  ).toBe(true);
  expect(rows[1]?.old?.segments).toEqual([{ kind: "removed", text: "before" }]);
});

function findChangedRows(
  model: ReturnType<typeof buildDiffViewModel>,
): readonly Extract<DiffViewRow, { kind: "content" }>[] {
  return model.sideBySideRows.filter(
    (row): row is Extract<DiffViewRow, { kind: "content" }> =>
      row.kind === "content" && row.changeId !== null,
  );
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
        hunks: [Hunk.fromLines("@@ -1,251 +1,251 @@", lines)],
        reason: null,
      },
      submodule: null,
    },
  };
}
