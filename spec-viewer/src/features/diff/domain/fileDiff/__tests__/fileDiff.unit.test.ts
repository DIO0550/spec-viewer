import { expect, test } from "vitest";

import { Hunk } from "@/features/diff/domain/fileDiff";

test("Hunk.fromLinesはline kindごとに旧行番号と新行番号を導出する", () => {
  const hunk = Hunk.fromLines("@@ -1,3 +1,4 @@", [
    { kind: "context", text: "same" },
    { kind: "removed", text: "old" },
    { kind: "added", text: "new" },
    { kind: "noNewline", text: "\\ No newline at end of file" },
    { kind: "context", text: "after" },
  ]);

  expect(hunk.lines).toEqual([
    {
      kind: "context",
      text: "same",
      oldLineNumber: 1,
      newLineNumber: 1,
    },
    {
      kind: "removed",
      text: "old",
      oldLineNumber: 2,
      newLineNumber: null,
    },
    {
      kind: "added",
      text: "new",
      oldLineNumber: null,
      newLineNumber: 2,
    },
    {
      kind: "noNewline",
      text: "\\ No newline at end of file",
      oldLineNumber: null,
      newLineNumber: null,
    },
    {
      kind: "context",
      text: "after",
      oldLineNumber: 3,
      newLineNumber: 3,
    },
  ]);
});

test.each([
  {
    header: "@@ -7 +9 @@ function name",
    line: { kind: "context", text: "same" } as const,
    oldLineNumber: 7,
    newLineNumber: 9,
  },
  {
    header: "@@ -0,0 +1,2 @@",
    line: { kind: "added", text: "new" } as const,
    oldLineNumber: null,
    newLineNumber: 1,
  },
  {
    header: "@@ -5,2 +0,0 @@",
    line: { kind: "removed", text: "old" } as const,
    oldLineNumber: 5,
    newLineNumber: null,
  },
] as const)("Hunk.fromLinesは許可header $header の開始行を導出する", ({
  header,
  line,
  oldLineNumber,
  newLineNumber,
}) => {
  const hunk = Hunk.fromLines(header, [line]);

  expect(hunk.lines[0]).toEqual({
    ...line,
    oldLineNumber,
    newLineNumber,
  });
});

test("Hunk.fromLinesは空linesとsafe integer上限を受理する", () => {
  expect(Hunk.fromLines("@@ -9007199254740991,1 +1,1 @@", [])).toEqual({
    header: "@@ -9007199254740991,1 +1,1 @@",
    lines: [],
  });
});

test.each([
  "@@ --1,2 +1,2 @@",
  "@@ -1.5,2 +1,2 @@",
  "@@ -9007199254740992,1 +1,1 @@",
  "@@ -1,2  +1,2 @@",
  "@@ -1,2 +1,2  @@",
  "@@ -1,2 +1,2 @@section",
])("Hunk.fromLinesは不正header %s を拒否する", (header) => {
  expect(() => Hunk.fromLines(header, [])).toThrow(
    "Invalid unified diff hunk header",
  );
});
