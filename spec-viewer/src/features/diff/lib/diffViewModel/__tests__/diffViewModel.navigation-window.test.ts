import { expect, test } from "vitest";

import type { DiffViewRow } from "@/features/diff/lib/diffViewModel";
import {
  calculateRowOffsets,
  findAdjacentChangeIndex,
} from "@/features/diff/lib/diffViewModel";

test.each([
  [[], null, "next", null],
  [["first", "second", "third"], "first", "previous", null],
  [["first", "second", "third"], "first", "next", 1],
  [["first", "second", "third"], "second", "previous", 0],
  [["first", "second", "third"], "second", "next", 2],
  [["first", "second", "third"], "third", "next", null],
] as const)("changeIds=%j active=%s direction=%sならindex=%s", (changeIds, activeChangeId, direction, expected) => {
  expect(findAdjacentChangeIndex(changeIds, activeChangeId, direction)).toBe(
    expected,
  );
});

test("content=20px・hunk/gap/annotation=28pxのprefix offsetsを返す", () => {
  const rows: readonly DiffViewRow[] = [
    { kind: "hunk", id: "hunk", header: "@@", estimatedHeight: 28 },
    {
      kind: "content",
      id: "content",
      changeId: null,
      inline: null,
      old: null,
      next: null,
      estimatedHeight: 20,
    },
    {
      kind: "gap",
      id: "gap",
      omittedLineCount: 4,
      expandableRows: null,
      estimatedHeight: 28,
    },
    {
      kind: "annotation",
      id: "annotation",
      side: "both",
      text: "note",
      estimatedHeight: 28,
    },
  ];

  expect(calculateRowOffsets(rows)).toEqual([0, 28, 48, 76, 104]);
});
