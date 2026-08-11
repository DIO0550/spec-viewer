import { expect, test } from "vitest";

import type {
  DiffLineSource,
  FileChangeStatus,
  FileDiff,
  OmissionReason,
} from "@/features/diff/domain/fileDiff";
import { deriveDiffAvailability, Hunk } from "@/features/diff/domain/fileDiff";
import {
  buildEditorViewModel,
  materializeEditorRows,
  splitCanonicalLines,
} from "@/features/diff/lib/editorViewModel";

test.each([
  ["", [], false],
  ["first", ["first"], false],
  ["first\n", ["first"], true],
  ["first\r\nsecond\r\n", ["first", "second"], true],
  ["first\rsecond", ["first", "second"], false],
] as const)("%jをcanonical logical linesへ分割する", (text, lines, finalNewline) => {
  expect(splitCanonicalLines(text)).toEqual({
    lines,
    hasFinalNewline: finalNewline,
  });
});

test("current全文を正本にしadded gutterと型安全なcurrent anchorを投影する", () => {
  const model = buildEditorViewModel(
    createFileDiff({
      status: "added",
      oldContent: null,
      newContent: "first\nsecond\n",
      header: "@@ -0,0 +1,2 @@",
      lines: [
        { kind: "added", text: "first" },
        { kind: "added", text: "second" },
      ],
    }),
  );

  expect(model.state).toBe("ready");
  expect(model.currentLines).toEqual([
    expect.objectContaining({
      id: "current-line-1",
      lineNumber: 1,
      text: "first",
      gutterKind: "added",
      changeId: "hunk-0-change-0",
      commentability: "current",
      anchor: {
        side: "current",
        newPath: "file.ts",
        line: 1,
        lineText: "first",
      },
    }),
    expect.objectContaining({ id: "current-line-2", lineNumber: 2 }),
  ]);
  expect(model.orderedChangeIds).toEqual(["hunk-0-change-0"]);
});

test("replacementはcurrent行をmodifiedにして直前へprevious peekを置く", () => {
  const model = buildEditorViewModel(
    createFileDiff({
      oldContent: "before\nold\nafter",
      newContent: "before\nnew\nafter",
      header: "@@ -1,3 +1,3 @@",
      lines: [
        { kind: "context", text: "before" },
        { kind: "removed", text: "old" },
        { kind: "added", text: "new" },
        { kind: "context", text: "after" },
      ],
    }),
  );

  expect(model.currentLines[1]).toMatchObject({
    gutterKind: "modified",
    changeId: "hunk-0-change-0",
  });
  expect(model.peeks).toEqual([
    expect.objectContaining({
      id: "hunk-0-change-0-peek",
      kind: "previous",
      commentability: "none",
      boundary: { kind: "beforeLine", lineNumber: 2 },
      oldLines: [{ lineNumber: 2, text: "old" }],
    }),
  ]);
  expect(materializeEditorRows(model, new Set()).map((row) => row.id)).toEqual([
    "current-line-1",
    "hunk-0-change-0-peek-summary",
    "current-line-2",
    "current-line-3",
  ]);
});

test.each([
  [
    "@@ -1,2 +1 @@",
    "deleted\nremaining",
    "remaining",
    { kind: "beforeLine", lineNumber: 1 },
  ],
  ["@@ -1,2 +1 @@", "remaining\ndeleted", "remaining", { kind: "eof" }],
] as const)("removed-onlyを正しいcurrent境界へdeleted peekとして置く", (header, oldContent, newContent, boundary) => {
  const removedFirst = oldContent.startsWith("deleted");
  const lines: readonly DiffLineSource[] = removedFirst
    ? [
        { kind: "removed", text: "deleted" },
        { kind: "context", text: "remaining" },
      ]
    : [
        { kind: "context", text: "remaining" },
        { kind: "removed", text: "deleted" },
      ];
  const model = buildEditorViewModel(
    createFileDiff({ oldContent, newContent, header, lines }),
  );

  expect(model.state).toBe("ready");
  expect(model.peeks[0]).toMatchObject({ kind: "deleted", boundary });
});

test("modified-to-emptyはcurrent行なしでもremoved hunkを削除peekへ投影する", () => {
  const model = buildEditorViewModel(
    createFileDiff({
      status: "modified",
      oldContent: "removed",
      newContent: "",
      header: "@@ -1 +0,0 @@",
      lines: [{ kind: "removed", text: "removed" }],
    }),
  );

  expect(model.state).toBe("ready");
  expect(model.currentLines).toEqual([]);
  expect(model.peeks).toEqual([
    expect.objectContaining({
      kind: "deleted",
      boundary: { kind: "eof" },
      oldLines: [{ lineNumber: 1, text: "removed" }],
    }),
  ]);
  expect(model.orderedChangeIds).toEqual(["hunk-0-change-0"]);
});

test("deleted fileはcurrent行なしでold全文を非comment対象peekにする", () => {
  const model = buildEditorViewModel(
    createFileDiff({
      status: "deleted",
      oldContent: "first\nsecond\n",
      newContent: null,
      header: "@@ -1,2 +0,0 @@",
      lines: [
        { kind: "removed", text: "first" },
        { kind: "removed", text: "second" },
      ],
    }),
  );

  expect(model.state).toBe("ready");
  expect(model.currentLines).toEqual([]);
  expect(model.peeks[0]).toMatchObject({
    kind: "deleted",
    boundary: { kind: "eof" },
    commentability: "none",
  });
  expect(
    materializeEditorRows(model, new Set(["hunk-0-change-0-peek"])),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "hunk-0-change-0-peek-old-line-1",
        commentability: "none",
      }),
      expect.objectContaining({
        id: "hunk-0-change-0-peek-old-line-2",
        commentability: "none",
      }),
    ]),
  );
});

test("structured diff omittedはcurrent全文をdegradedで表示してchange identityを公開しない", () => {
  const fileDiff = createFileDiff({ oldContent: "old", newContent: "current" });
  const omitted = {
    ...fileDiff,
    review: {
      ...fileDiff.review,
      structuredDiff: {
        state: "omitted" as const,
        hunks: [] as const,
        reason: "diffLimit" as const,
      },
    },
    availability: { kind: "omitted" as const, reason: "diffLimit" as const },
  };

  const model = buildEditorViewModel(omitted);

  expect(model.state).toBe("degraded");
  expect(model.currentLines).toEqual([
    expect.objectContaining({
      text: "current",
      gutterKind: "unchanged",
      changeId: null,
    }),
  ]);
  expect(model.orderedChangeIds).toEqual([]);
  expect(model.peeks).toEqual([]);
});

test("availability emptyでも非空current全文をunchangedとして表示する", () => {
  const fileDiff = createFileDiff({
    oldContent: "same",
    newContent: "same",
    lines: [],
  });
  const model = buildEditorViewModel({
    ...fileDiff,
    availability: { kind: "empty" },
  });

  expect(model.state).toBe("ready");
  expect(model.currentLines).toEqual([
    expect.objectContaining({ text: "same", gutterKind: "unchanged" }),
  ]);
});

test("availableな空fileは0 logical linesのemptyFileにする", () => {
  const model = buildEditorViewModel(
    createFileDiff({ oldContent: "", newContent: "", lines: [] }),
  );

  expect(model.state).toBe("emptyFile");
  expect(model.currentLines).toEqual([]);
});

test.each([
  ["binary", "binary"],
  ["largeFile", "largeFile"],
  ["diffLimit", "diffLimit"],
  ["unsupportedEntryKind", "unsupportedEntryKind"],
] as const)("current omitted %sはcurrentUnavailableにする", (reason, _expected) => {
  const base = createFileDiff({ oldContent: "old", newContent: "new" });
  const unavailable = {
    ...base,
    review: {
      ...base.review,
      newContent: {
        state: "omitted" as const,
        text: null,
        reason,
        byteLength: null,
      },
    },
  };

  expect(buildEditorViewModel(unavailable)).toMatchObject({
    state: "currentUnavailable",
    omissionReason: reason,
    currentLines: [],
    orderedChangeIds: [],
  });
});

test.each([
  [
    "old text mismatch",
    "different",
    "new",
    "@@ -1 +1 @@",
    [
      { kind: "removed", text: "old" },
      { kind: "added", text: "new" },
    ],
  ],
  [
    "new text mismatch",
    "old",
    "different",
    "@@ -1 +1 @@",
    [
      { kind: "removed", text: "old" },
      { kind: "added", text: "new" },
    ],
  ],
  [
    "new range overflow",
    "old",
    "new",
    "@@ -1 +2 @@",
    [
      { kind: "removed", text: "old" },
      { kind: "added", text: "new" },
    ],
  ],
] as const)("%sをinconsistentへ落としてchange targetを公開しない", (_label, oldContent, newContent, header, lines) => {
  const model = buildEditorViewModel(
    createFileDiff({ oldContent, newContent, header, lines }),
  );

  expect(model.state).toBe("inconsistent");
  expect(model.orderedChangeIds).toEqual([]);
  expect(model.peeks).toEqual([]);
  expect(model.currentLines.every((line) => line.changeId === null)).toBe(true);
  expect(model.inconsistencyReason).not.toBeNull();
});

function createFileDiff(
  input: Readonly<{
    status?: FileChangeStatus;
    oldContent: string | null;
    newContent: string | null;
    header?: string;
    lines?: readonly DiffLineSource[];
  }>,
): FileDiff {
  const status = input.status ?? "modified";
  const lines = input.lines ?? [];
  const review = {
    file: {
      oldPath: status === "added" || status === "untracked" ? null : "file.ts",
      newPath: status === "deleted" ? null : "file.ts",
      change: status,
      entryKind: "regular" as const,
      contentClassification: "text" as const,
      similarity: null,
      oldMode: status === "added" || status === "untracked" ? null : "100644",
      newMode: status === "deleted" ? null : "100644",
    },
    oldContent: toContent(input.oldContent),
    newContent: toContent(input.newContent),
    patch: toContent(""),
    structuredDiff: {
      state: "available" as const,
      hunks:
        lines.length === 0
          ? []
          : [Hunk.fromLines(input.header ?? "@@ -1 +1 @@", lines)],
      reason: null,
    },
    submodule: null,
  };
  return {
    identity: { sourceId: "worktree:snapshot", path: "file.ts" },
    review,
    availability: deriveDiffAvailability(review),
  };
}

function toContent(text: string | null) {
  if (text === null) {
    return {
      state: "omitted" as const,
      text: null,
      reason: "missingSide" as OmissionReason,
      byteLength: null,
    };
  }
  return { state: "available" as const, text, reason: null, byteLength: null };
}
