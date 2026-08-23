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

test("content=22px・hunk/gap/annotation=30pxのprefix offsetsを返す", () => {
  const rows: readonly DiffViewRow[] = [
    { kind: "hunk", id: "hunk", header: "@@", estimatedHeight: 30 },
    {
      kind: "content",
      id: "content",
      changeId: null,
      inline: null,
      old: null,
      next: null,
      estimatedHeight: 22,
    },
    {
      kind: "gap",
      id: "gap",
      omittedLineCount: 4,
      expandableRows: null,
      estimatedHeight: 30,
    },
    {
      kind: "annotation",
      id: "annotation",
      side: "both",
      text: "note",
      estimatedHeight: 30,
    },
  ];

  expect(calculateRowOffsets(rows)).toEqual([0, 30, 52, 82, 112]);
});
