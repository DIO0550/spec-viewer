import { expect, test } from "vitest";

import type { FileDiff } from "@/features/diff/domain/fileDiff";
import { Hunk } from "@/features/diff/domain/fileDiff";
import { buildDiffViewModel } from "@/features/diff/lib/diffViewModel";

test("paired removed・addedを文字単位segmentへ変換する", () => {
  const model = buildDiffViewModel(createFileDiff().review);
  const changedRow = model.sideBySideRows.find(
    (row) => row.kind === "content" && row.changeId !== null,
  );

  expect(changedRow?.kind).toBe("content");
  const contentRow = changedRow as Extract<
    (typeof model.sideBySideRows)[number],
    { kind: "content" }
  >;
  expect(contentRow.old?.segments.map((segment) => segment.text).join("")).toBe(
    "const value = before;",
  );
  expect(
    contentRow.next?.segments.map((segment) => segment.text).join(""),
  ).toBe("const value = after;");
  expect(
    contentRow.old?.segments.some((segment) => segment.kind === "removed"),
  ).toBe(true);
  expect(
    contentRow.next?.segments.some((segment) => segment.kind === "added"),
  ).toBe(true);
  expect(
    contentRow.old?.segments.some((segment) => segment.kind === "unchanged"),
  ).toBe(true);
});

function createFileDiff(): FileDiff {
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
          Hunk.fromLines("@@ -1,1 +1,1 @@", [
            { kind: "removed", text: "const value = before;" },
            { kind: "added", text: "const value = after;" },
          ]),
        ],
        reason: null,
      },
      submodule: null,
    },
  };
}
