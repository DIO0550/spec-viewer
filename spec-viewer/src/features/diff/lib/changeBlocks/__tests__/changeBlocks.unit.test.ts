import { expect, test } from "vitest";

import { Hunk } from "@/features/diff/domain/fileDiff";
import { projectChangeBlocks } from "@/features/diff/lib/changeBlocks";

test("hunkごとに変更runへview共通の安定IDと両side rangeを割り当てる", () => {
  const hunks = [
    Hunk.fromLines("@@ -1,5 +1,5 @@", [
      { kind: "context", text: "first" },
      { kind: "removed", text: "old-a" },
      { kind: "added", text: "new-a" },
      { kind: "context", text: "middle" },
      { kind: "removed", text: "old-b" },
      { kind: "added", text: "new-b" },
    ]),
  ];

  expect(projectChangeBlocks(hunks)).toEqual([
    expect.objectContaining({
      id: "hunk-0-change-0",
      hunkIndex: 0,
      changeIndex: 0,
      oldRange: { start: 2, end: 2 },
      newRange: { start: 2, end: 2 },
      insertionLine: 2,
    }),
    expect.objectContaining({
      id: "hunk-0-change-1",
      hunkIndex: 0,
      changeIndex: 1,
      oldRange: { start: 4, end: 4 },
      newRange: { start: 4, end: 4 },
      insertionLine: 4,
    }),
  ]);
});

test("noNewline注釈を変更runの実在行やrangeへ数えない", () => {
  const hunk = Hunk.fromLines("@@ -1 +1 @@", [
    { kind: "removed", text: "old" },
    { kind: "noNewline", text: "\\ No newline at end of file" },
    { kind: "added", text: "new" },
  ]);

  const [block] = projectChangeBlocks([hunk]);

  expect(block).toMatchObject({
    oldRange: { start: 1, end: 1 },
    newRange: { start: 1, end: 1 },
    annotations: ["\\ No newline at end of file"],
  });
});

test("removed-only changeはcurrent上の挿入境界を保持する", () => {
  const hunk = Hunk.fromLines("@@ -1,2 +1 @@", [
    { kind: "removed", text: "deleted" },
    { kind: "context", text: "remaining" },
  ]);

  expect(projectChangeBlocks([hunk])[0]).toMatchObject({
    oldRange: { start: 1, end: 1 },
    newRange: null,
    insertionLine: 1,
  });
});
