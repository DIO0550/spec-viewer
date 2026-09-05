import { expect, test } from "vitest";

import { Hunk } from "@/features/diff/domain/fileDiff";
import { createDiffViewerFixture } from "@/features/diff/components/DiffViewer/testFixtures";
import { buildDiffViewModel } from "@/features/diff/lib/diffViewModel";
import { buildEditorViewModel } from "@/features/diff/lib/editorViewModel";

test("Unified Split Editorでordered change IDと両side rangeを共有する", () => {
  const hunk = Hunk.fromLines("@@ -1,4 +1,4 @@", [
    { kind: "context", text: "before" },
    { kind: "removed", text: "old-a" },
    { kind: "added", text: "new-a" },
    { kind: "context", text: "middle" },
    { kind: "removed", text: "old-b" },
    { kind: "added", text: "new-b" },
  ]);
  const fileDiff = createDiffViewerFixture({
    oldContent: "before\nold-a\nmiddle\nold-b",
    newContent: "before\nnew-a\nmiddle\nnew-b",
    hunks: [hunk],
  });

  const diffModel = buildDiffViewModel(fileDiff);
  const editorModel = buildEditorViewModel(fileDiff);
  const inlineIds = diffModel.inlineRows.flatMap((row) =>
    row.kind === "content" && row.changeId !== null ? [row.changeId] : [],
  );
  const splitIds = diffModel.sideBySideRows.flatMap((row) =>
    row.kind === "content" && row.changeId !== null ? [row.changeId] : [],
  );

  expect([...new Set(inlineIds)]).toEqual(editorModel.orderedChangeIds);
  expect([...new Set(splitIds)]).toEqual(editorModel.orderedChangeIds);
  expect(
    diffModel.changeBlocks.map(({ id, oldRange, newRange }) => ({
      id,
      oldRange,
      newRange,
    })),
  ).toEqual([
    {
      id: "hunk-0-change-0",
      oldRange: { start: 2, end: 2 },
      newRange: { start: 2, end: 2 },
    },
    {
      id: "hunk-0-change-1",
      oldRange: { start: 4, end: 4 },
      newRange: { start: 4, end: 4 },
    },
  ]);
});
