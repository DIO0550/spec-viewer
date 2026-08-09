import { expect, test } from "vitest";

import type { DiffLineSource, FileDiff } from "@/features/diff/domain/fileDiff";
import { Hunk } from "@/features/diff/domain/fileDiff";
import { buildDiffViewModel } from "@/features/diff/lib/diffViewModel";

test("side-by-sideではcontextを左右同一row、removedとaddedをindex対応する", () => {
  const model = buildDiffViewModel(
    createFileDiff([
      { kind: "context", text: "const before = 1;" },
      { kind: "removed", text: "const value = before;" },
      { kind: "added", text: "const value = after;" },
    ]),
  );
  const contentRows = model.sideBySideRows.filter(
    (row) => row.kind === "content",
  );

  expect(contentRows).toHaveLength(2);
  expect(contentRows[0]?.old?.line.kind).toBe("context");
  expect(contentRows[0]?.next?.line.kind).toBe("context");
  expect(contentRows[1]?.old?.line.kind).toBe("removed");
  expect(contentRows[1]?.next?.line.kind).toBe("added");
  expect(model.changeIds).toEqual(["hunk-0-change-0"]);
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
