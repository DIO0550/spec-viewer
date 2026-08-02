import { expect, test } from "vitest";

import type { DiffLineSource, FileDiff } from "@/features/diff/domain/fileDiff";
import { Hunk } from "@/features/diff/domain/fileDiff";
import {
  buildDiffViewModel,
  materializeRows,
} from "@/features/diff/lib/diffViewModel";

test("7行contextはすべて表示する", () => {
  const model = buildDiffViewModel(createFileDiff(createContextLines(7)));

  expect(model.inlineRows.filter((row) => row.kind === "content")).toHaveLength(
    7,
  );
  expect(model.inlineRows.some((row) => row.kind === "gap")).toBe(false);
});

test("8行contextは先頭3・gap・末尾3へ折りたたむ", () => {
  const model = buildDiffViewModel(createFileDiff(createContextLines(8)));
  const gap = model.inlineRows.find((row) => row.kind === "gap");

  expect(model.inlineRows.filter((row) => row.kind === "content")).toHaveLength(
    6,
  );
  expect(gap?.kind).toBe("gap");
  expect(gap?.omittedLineCount).toBe(2);
  expect(gap?.id).toBe("hunk-0-context-3-4");
});

test("選択したcontext gapだけを元の全行へ展開する", () => {
  const model = buildDiffViewModel(createFileDiff(createContextLines(8)));
  const gap = model.inlineRows.find((row) => row.kind === "gap");
  expect(gap?.kind).toBe("gap");

  const rows = materializeRows(model, "inline", new Set([gap?.id ?? ""]));

  expect(rows.filter((row) => row.kind === "content")).toHaveLength(8);
  expect(rows.some((row) => row.kind === "gap")).toBe(false);
});

function createContextLines(count: number): readonly DiffLineSource[] {
  return Array.from({ length: count }, (_, index) => ({
    kind: "context" as const,
    text: `line ${index + 1}`,
  }));
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
        hunks: [
          Hunk.fromLines(`@@ -1,${lines.length} +1,${lines.length} @@`, lines),
        ],
        reason: null,
      },
      submodule: null,
    },
  };
}
