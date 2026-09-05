import { expect, test } from "vitest";

import type { DiffLineSource, FileDiff } from "@/features/diff/domain/fileDiff";
import { Hunk } from "@/features/diff/domain/fileDiff";
import { buildDiffViewModel } from "@/features/diff/lib/diffViewModel";

test("1 hunkのcontext・removed・addedをsource orderと行番号を保ってinline化する", () => {
  const fileDiff = createFileDiff([
    { kind: "context", text: "const before = 1;" },
    { kind: "removed", text: "const value = before;" },
    { kind: "added", text: "const value = after;" },
  ]);

  const model = buildDiffViewModel(fileDiff);

  expect(model.state).toBe("ready");
  expect(model.inlineRows[0]?.kind).toBe("hunk");
  expect(
    model.inlineRows
      .filter(
        (
          row,
        ): row is Extract<
          (typeof model.inlineRows)[number],
          { kind: "content" }
        > => row.kind === "content",
      )
      .map((row) => ({
        kind: row.inline?.line.kind,
        oldLineNumber: row.inline?.line.oldLineNumber,
        newLineNumber: row.inline?.line.newLineNumber,
      })),
  ).toEqual([
    { kind: "context", oldLineNumber: 1, newLineNumber: 1 },
    { kind: "removed", oldLineNumber: 2, newLineNumber: null },
    { kind: "added", oldLineNumber: null, newLineNumber: 2 },
  ]);
});

function createFileDiff(lines: readonly DiffLineSource[]): FileDiff {
  return {
    identity: {
      sourceId: "spec:078-issue-167",
      path: "implementation-plan",
    },
    availability: { kind: "ready" },
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
        text: "const before = 1;\nconst value = before;",
        reason: null,
        byteLength: null,
      },
      newContent: {
        state: "available",
        text: "const before = 1;\nconst value = after;",
        reason: null,
        byteLength: null,
      },
      patch: {
        state: "available",
        text: "",
        reason: null,
        byteLength: null,
      },
      structuredDiff: {
        state: "available",
        hunks: [Hunk.fromLines("@@ -1,2 +1,2 @@", lines)],
        reason: null,
      },
      submodule: null,
    },
  };
}
