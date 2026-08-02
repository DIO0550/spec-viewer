import { expect, test } from "vitest";

import type { FileContent, FileDiff } from "@/features/diff/domain/fileDiff";
import { Hunk } from "@/features/diff/domain/fileDiff";
import {
  buildDiffViewModel,
  materializeRows,
} from "@/features/diff/lib/diffViewModel";

test("hunk間gapは両contentが利用可能で同一なら展開できる", () => {
  const content = availableContent(
    Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join("\n"),
  );
  const model = buildDiffViewModel(createFileDiff(content, content));
  const gap = model.inlineRows.find((row) => row.kind === "gap");
  expect(gap?.kind).toBe("gap");

  expect(gap?.omittedLineCount).toBe(8);
  expect(gap?.expandableRows).not.toBeNull();
  expect(
    materializeRows(model, "inline", new Set([gap?.id ?? ""])).filter(
      (row) => row.kind === "content",
    ),
  ).toHaveLength(10);
});

test("複数のhunk間gapを順序通りに展開できる", () => {
  const content = availableContent(
    Array.from({ length: 25 }, (_, index) => `line ${index + 1}`).join("\n"),
  );
  const model = buildDiffViewModel(
    createFileDiff(content, content, [1, 10, 20]),
  );
  const expandedTexts = model.inlineRows
    .filter((row) => row.kind === "gap")
    .map((gap) =>
      gap.expandableRows
        ?.filter((row) => row.kind === "content")
        .map((row) => row.inline?.line.text),
    );

  expect(expandedTexts).toEqual([
    Array.from({ length: 8 }, (_, index) => `line ${index + 2}`),
    Array.from({ length: 9 }, (_, index) => `line ${index + 11}`),
  ]);
});

test.each([
  [omittedContent(), availableContent("line 1\nline 2")],
  [availableContent("line 1\nline 2"), omittedContent()],
] as const)("片側content omittedならhunk間gapを展開不可にする", (oldContent, newContent) => {
  const model = buildDiffViewModel(createFileDiff(oldContent, newContent));
  const gap = model.inlineRows.find((row) => row.kind === "gap");

  expect(gap?.kind).toBe("gap");
  expect(gap?.expandableRows).toBeNull();
});

function createFileDiff(
  oldContent: FileContent,
  newContent: FileContent,
  hunkLineNumbers: readonly number[] = [1, 10],
): FileDiff {
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
      oldContent,
      newContent,
      patch: { state: "available", text: "", reason: null, byteLength: null },
      structuredDiff: {
        state: "available",
        hunks: hunkLineNumbers.map((lineNumber) =>
          Hunk.fromLines(`@@ -${lineNumber},1 +${lineNumber},1 @@`, [
            { kind: "context", text: `line ${lineNumber}` },
          ]),
        ),
        reason: null,
      },
      submodule: null,
    },
  };
}

function availableContent(text: string): FileContent {
  return { state: "available", text, reason: null, byteLength: null };
}

function omittedContent(): FileContent {
  return {
    state: "omitted",
    text: null,
    reason: "largeFile",
    byteLength: null,
  };
}
