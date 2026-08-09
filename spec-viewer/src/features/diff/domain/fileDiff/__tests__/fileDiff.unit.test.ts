import { expect, test } from "vitest";

import {
  deriveDiffAvailability,
  Hunk,
  type FileChangeStatus,
  type FileContent,
  type FileReview,
  type StructuredDiff,
} from "@/features/diff/domain/fileDiff";

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
  "@@ -0,1 +1,1 @@",
  "@@ -1,1 +0,1 @@",
  "@@ -1,2  +1,2 @@",
  "@@ -1,2 +1,2  @@",
  "@@ -1,2 +1,2 @@section",
])("Hunk.fromLinesは不正header %s を拒否する", (header) => {
  expect(() => Hunk.fromLines(header, [])).toThrow(
    "Invalid unified diff hunk header",
  );
});

test("deriveDiffAvailabilityはhunkを持つtext reviewをreadyにする", () => {
  const availability = deriveDiffAvailability(
    createReview({
      structuredDiff: {
        state: "available",
        hunks: [
          Hunk.fromLines("@@ -1 +1 @@", [
            { kind: "removed", text: "old" },
            { kind: "added", text: "new" },
          ]),
        ],
        reason: null,
      },
    }),
  );

  expect(availability).toEqual({ kind: "ready" });
});

test("deriveDiffAvailabilityはhunkがないavailable reviewをemptyにする", () => {
  const availability = deriveDiffAvailability(createReview());

  expect(availability).toEqual({ kind: "empty" });
});

test("deriveDiffAvailabilityはbinary classificationをhunkより優先してomittedにする", () => {
  const review = createReview({
    structuredDiff: {
      state: "available",
      hunks: [
        Hunk.fromLines("@@ -1 +1 @@", [
          { kind: "removed", text: "old" },
          { kind: "added", text: "new" },
        ]),
      ],
      reason: null,
    },
  });
  const binaryReview = {
    ...review,
    file: { ...review.file, contentClassification: "binary" as const },
  };

  expect(deriveDiffAvailability(binaryReview)).toEqual({
    kind: "omitted",
    reason: "binary",
  });
});

test.each([
  "binary",
  "largeFile",
  "diffLimit",
  "unsupportedEntryKind",
] as const)("deriveDiffAvailabilityはstructured diff omission=%sをomittedにする", (reason) => {
  const availability = deriveDiffAvailability(
    createReview({
      structuredDiff: { state: "omitted", hunks: [], reason },
    }),
  );

  expect(availability).toEqual({ kind: "omitted", reason });
});

test.each([
  "added",
  "deleted",
] as const)("deriveDiffAvailabilityは%sのmissingSideをreadyとして扱う", (change) => {
  const availability = deriveDiffAvailability(
    createReview({
      change,
      oldContent:
        change === "added"
          ? omittedContent("missingSide")
          : availableContent("old"),
      newContent:
        change === "deleted"
          ? omittedContent("missingSide")
          : availableContent("new"),
      structuredDiff: {
        state: "available",
        hunks: [
          Hunk.fromLines("@@ -1,1 +1,1 @@", [
            { kind: change === "added" ? "added" : "removed", text: "line" },
          ]),
        ],
        reason: null,
      },
    }),
  );

  expect(availability).toEqual({ kind: "ready" });
});

test("deriveDiffAvailabilityは予期しないmissingSideをmissingとして返す", () => {
  const availability = deriveDiffAvailability(
    createReview({
      oldContent: omittedContent("missingSide"),
      structuredDiff: {
        state: "available",
        hunks: [
          Hunk.fromLines("@@ -1,1 +1,1 @@", [
            { kind: "removed", text: "old" },
            { kind: "added", text: "new" },
          ]),
        ],
        reason: null,
      },
    }),
  );

  expect(availability).toEqual({ kind: "missing", side: "old" });
});

function createReview(
  overrides: Readonly<{
    change?: FileChangeStatus;
    oldContent?: FileContent;
    newContent?: FileContent;
    structuredDiff?: StructuredDiff;
  }> = {},
): FileReview {
  return {
    file: {
      oldPath: "src/file.ts",
      newPath: "src/file.ts",
      change: overrides.change ?? "modified",
      entryKind: "regular",
      contentClassification: "text",
      similarity: null,
      oldMode: null,
      newMode: null,
    },
    oldContent: overrides.oldContent ?? availableContent("old"),
    newContent: overrides.newContent ?? availableContent("new"),
    patch: availableContent("patch"),
    structuredDiff:
      overrides.structuredDiff ??
      ({
        state: "available",
        hunks: [],
        reason: null,
      } satisfies StructuredDiff),
    submodule: null,
  };
}

function availableContent(text: string): FileContent {
  return { state: "available", text, reason: null, byteLength: null };
}

function omittedContent(
  reason: Extract<FileContent, { state: "omitted" }>["reason"],
): FileContent {
  return { state: "omitted", text: null, reason, byteLength: null };
}
