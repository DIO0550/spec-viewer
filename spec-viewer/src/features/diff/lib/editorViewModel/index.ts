import type {
  DiffLine,
  FileContent,
  FileDiff,
  OmissionReason,
} from "@/features/diff/domain/fileDiff";
import {
  type ChangeBlock,
  projectChangeBlocks,
} from "@/features/diff/lib/changeBlocks";

export type CanonicalLines = Readonly<{
  lines: readonly string[];
  hasFinalNewline: boolean;
}>;

export type CurrentLineAnchor = Readonly<{
  side: "current";
  newPath: string;
  line: number;
  lineText: string;
}>;

export type EditorCurrentLine = Readonly<{
  kind: "currentLine";
  id: string;
  lineNumber: number;
  text: string;
  gutterKind: "unchanged" | "added" | "modified";
  changeId: string | null;
  commentability: "current";
  anchor: CurrentLineAnchor;
  estimatedHeight: 22;
}>;

export type EditorPeek = Readonly<{
  kind: "deleted" | "previous";
  id: string;
  changeId: string;
  oldLines: readonly Readonly<{ lineNumber: number; text: string }>[];
  annotations: readonly string[];
  boundary:
    | Readonly<{ kind: "beforeLine"; lineNumber: number }>
    | Readonly<{ kind: "eof" }>;
  commentability: "none";
}>;

export type EditorPeekSummaryRow = Readonly<{
  kind: "peekSummary";
  id: string;
  peek: EditorPeek;
  commentability: "none";
  estimatedHeight: 32;
}>;

export type EditorPeekLineRow = Readonly<{
  kind: "peekLine";
  id: string;
  peekId: string;
  peekKind: EditorPeek["kind"];
  oldLineNumber: number;
  text: string;
  commentability: "none";
  estimatedHeight: 22;
}>;

export type EditorAnnotationRow = Readonly<{
  kind: "annotation";
  id: string;
  peekId: string;
  text: string;
  commentability: "none";
  estimatedHeight: 28;
}>;

export type EditorRow =
  | EditorCurrentLine
  | EditorPeekSummaryRow
  | EditorPeekLineRow
  | EditorAnnotationRow;

export type EditorViewModel = Readonly<{
  state:
    | "ready"
    | "degraded"
    | "emptyFile"
    | "currentUnavailable"
    | "inconsistent";
  omissionReason: OmissionReason | null;
  inconsistencyReason: string | null;
  currentLines: readonly EditorCurrentLine[];
  peeks: readonly EditorPeek[];
  orderedChangeIds: readonly string[];
  currentLineIndex: Readonly<Record<number, number>>;
  changeTargetIds: Readonly<Record<string, string>>;
  hasFinalNewline: boolean;
}>;

const HunkHeaderPattern =
  /^@@ -([0-9]+)(?:,([0-9]+))? \+([0-9]+)(?:,([0-9]+))? @@(?: .*)?$/;

/**
 * Splits content into canonical logical lines shared by projection and validation.
 *
 * @param text - Raw content using LF, CRLF, or CR separators.
 * @returns Logical lines without a synthetic trailing row and final-newline metadata.
 */
export function splitCanonicalLines(text: string): CanonicalLines {
  if (text === "") {
    return { lines: [], hasFinalNewline: false };
  }
  const canonicalText = text.replace(/\r\n?/g, "\n");
  const hasFinalNewline = canonicalText.endsWith("\n");
  const splitLines = canonicalText.split("\n");
  const lines = hasFinalNewline ? splitLines.slice(0, -1) : splitLines;
  return { lines, hasFinalNewline };
}

/**
 * Builds the source-neutral current-file projection and validates structured hunks.
 *
 * @param fileDiff - Decoded current content and structured diff.
 * @returns Safe immutable editor state.
 */
export function buildEditorViewModel(fileDiff: FileDiff): EditorViewModel {
  const newContent = fileDiff.review.newContent;
  const isDeletedMissingSide =
    fileDiff.review.file.change === "deleted" &&
    newContent.state === "omitted" &&
    newContent.reason === "missingSide";

  if (newContent.state === "omitted" && !isDeletedMissingSide) {
    return createNonReadyModel({
      state: "currentUnavailable",
      omissionReason: newContent.reason,
    });
  }

  const canonicalCurrent =
    newContent.state === "available"
      ? splitCanonicalLines(newContent.text)
      : { lines: [], hasFinalNewline: false };
  const newPath = fileDiff.review.file.newPath;
  if (canonicalCurrent.lines.length > 0 && newPath === null) {
    return createNonReadyModel({
      state: "inconsistent",
      inconsistencyReason: "current content has no new path",
    });
  }

  const fallbackLines = createCurrentLines({
    lines: canonicalCurrent.lines,
    newPath,
    overlay: {},
  });
  const structuredDiff = fileDiff.review.structuredDiff;
  if (structuredDiff.state === "omitted") {
    if (isDeletedMissingSide) {
      return createNonReadyModel({
        state: "inconsistent",
        inconsistencyReason: "deleted structured diff is unavailable",
      });
    }

    if (canonicalCurrent.lines.length === 0) {
      return {
        ...createNonReadyModel({ state: "emptyFile" }),
        hasFinalNewline: canonicalCurrent.hasFinalNewline,
      };
    }

    return {
      ...createNonReadyModel({
        state: "degraded",
        omissionReason: structuredDiff.reason,
      }),
      currentLines: fallbackLines,
      currentLineIndex: createCurrentLineIndex(fallbackLines),
      hasFinalNewline: canonicalCurrent.hasFinalNewline,
    };
  }

  const blocks = projectChangeBlocks(structuredDiff.hunks);
  const validationError = validateDiff({
    fileDiff,
    oldContent: fileDiff.review.oldContent,
    currentLines: canonicalCurrent.lines,
    blocks,
  });
  if (validationError !== null) {
    return {
      ...createNonReadyModel({
        state: "inconsistent",
        inconsistencyReason: validationError,
      }),
      currentLines: fallbackLines,
      currentLineIndex: createCurrentLineIndex(fallbackLines),
      hasFinalNewline: canonicalCurrent.hasFinalNewline,
    };
  }

  if (canonicalCurrent.lines.length === 0 && blocks.length === 0) {
    return {
      ...createNonReadyModel({ state: "emptyFile" }),
      hasFinalNewline: canonicalCurrent.hasFinalNewline,
    };
  }

  const overlay = createCurrentOverlay(blocks);
  const currentLines = createCurrentLines({
    lines: canonicalCurrent.lines,
    newPath,
    overlay,
  });
  const peeks = createPeeks(blocks, canonicalCurrent.lines.length);
  const changeTargetIds = createChangeTargetIds(blocks, peeks);

  return {
    state: "ready",
    omissionReason: null,
    inconsistencyReason: null,
    currentLines,
    peeks,
    orderedChangeIds: blocks.map((block) => block.id),
    currentLineIndex: createCurrentLineIndex(currentLines),
    changeTargetIds,
    hasFinalNewline: canonicalCurrent.hasFinalNewline,
  };
}

/**
 * Expands selected peek rows without changing semantic line and change identities.
 *
 * @param model - Immutable editor projection.
 * @param expandedPeekIds - Peek identities expanded in viewer-local state.
 * @returns Ordered mixed-height semantic rows.
 */
export function materializeEditorRows(
  model: EditorViewModel,
  expandedPeekIds: ReadonlySet<string>,
): readonly EditorRow[] {
  const beforeLine = new Map<number, EditorPeek[]>();
  const eof: EditorPeek[] = [];
  model.peeks.forEach((peek) => {
    if (peek.boundary.kind === "eof") {
      eof.push(peek);
      return;
    }
    const peeks = beforeLine.get(peek.boundary.lineNumber) ?? [];
    beforeLine.set(peek.boundary.lineNumber, [...peeks, peek]);
  });

  const rows: EditorRow[] = [];
  model.currentLines.forEach((line) => {
    (beforeLine.get(line.lineNumber) ?? []).forEach((peek) => {
      rows.push(...materializePeek(peek, expandedPeekIds.has(peek.id)));
    });
    rows.push(line);
  });
  eof.forEach((peek) => {
    rows.push(...materializePeek(peek, expandedPeekIds.has(peek.id)));
  });
  return rows;
}

/**
 * Creates current rows with a type-safe anchor unavailable to peek variants.
 *
 * @param input - Canonical current text, path and validated overlay.
 * @returns Stable current line rows.
 */
function createCurrentLines(
  input: Readonly<{
    lines: readonly string[];
    newPath: string | null;
    overlay: Readonly<
      Record<number, Readonly<{ kind: "added" | "modified"; changeId: string }>>
    >;
  }>,
): readonly EditorCurrentLine[] {
  if (input.newPath === null) {
    return [];
  }
  const newPath = input.newPath;
  return input.lines.map((text, index) => {
    const lineNumber = index + 1;
    const changed = input.overlay[lineNumber];
    return {
      kind: "currentLine",
      id: `current-line-${lineNumber}`,
      lineNumber,
      text,
      gutterKind: changed?.kind ?? "unchanged",
      changeId: changed?.changeId ?? null,
      commentability: "current",
      anchor: {
        side: "current",
        newPath,
        line: lineNumber,
        lineText: text,
      },
      estimatedHeight: 22,
    };
  });
}

/**
 * Maps validated changed current lines to their visual gutter semantics.
 *
 * @param blocks - Shared change blocks.
 * @returns Line-number keyed immutable overlay.
 */
function createCurrentOverlay(
  blocks: readonly ChangeBlock[],
): Readonly<
  Record<number, Readonly<{ kind: "added" | "modified"; changeId: string }>>
> {
  const overlay: Record<
    number,
    Readonly<{ kind: "added" | "modified"; changeId: string }>
  > = {};
  blocks.forEach((block) => {
    const kind = block.oldLines.length > 0 ? "modified" : "added";
    block.newLines.forEach(({ line }) => {
      if (line.newLineNumber !== null) {
        overlay[line.newLineNumber] = { kind, changeId: block.id };
      }
    });
  });
  return overlay;
}

/**
 * Creates collapsible previous/deleted summaries for blocks containing base lines.
 *
 * @param blocks - Validated shared change blocks.
 * @param currentLineCount - Current logical line count used to classify EOF.
 * @returns Ordered non-commentable peeks.
 */
function createPeeks(
  blocks: readonly ChangeBlock[],
  currentLineCount: number,
): readonly EditorPeek[] {
  return blocks.flatMap((block) => {
    if (block.oldLines.length === 0) {
      return [];
    }
    const isPrevious = block.newLines.length > 0;
    const firstNewLine = block.newRange?.start ?? block.insertionLine;
    const boundary =
      firstNewLine > currentLineCount || currentLineCount === 0
        ? ({ kind: "eof" } as const)
        : ({ kind: "beforeLine", lineNumber: firstNewLine } as const);
    return [
      {
        kind: isPrevious ? "previous" : "deleted",
        id: `${block.id}-peek`,
        changeId: block.id,
        oldLines: block.oldLines.flatMap(({ line }) =>
          line.oldLineNumber === null
            ? []
            : [{ lineNumber: line.oldLineNumber, text: line.text }],
        ),
        annotations: block.annotations,
        boundary,
        commentability: "none",
      },
    ];
  });
}

/**
 * Resolves every change to its first current row or deletion marker.
 *
 * @param blocks - Ordered change blocks.
 * @param peeks - Projected peek summaries.
 * @returns Change-ID keyed semantic row targets.
 */
function createChangeTargetIds(
  blocks: readonly ChangeBlock[],
  peeks: readonly EditorPeek[],
): Readonly<Record<string, string>> {
  const peekByChangeId = Object.fromEntries(
    peeks.map((peek) => [peek.changeId, `${peek.id}-summary`]),
  );
  return Object.fromEntries(
    blocks.flatMap((block) => {
      const currentLineNumber = block.newRange?.start;
      if (currentLineNumber !== undefined) {
        return [[block.id, `current-line-${currentLineNumber}`]];
      }
      const peekTarget = peekByChangeId[block.id];
      return peekTarget === undefined ? [] : [[block.id, peekTarget]];
    }),
  );
}

/**
 * Materializes one summary and its bounded semantic children.
 *
 * @param peek - Peek to render.
 * @param expanded - Whether old lines are visible.
 * @returns Summary followed by old lines and annotations when expanded.
 */
function materializePeek(
  peek: EditorPeek,
  expanded: boolean,
): readonly EditorRow[] {
  const summary: EditorPeekSummaryRow = {
    kind: "peekSummary",
    id: `${peek.id}-summary`,
    peek,
    commentability: "none",
    estimatedHeight: 32,
  };
  if (!expanded) {
    return [summary];
  }
  const oldLines: readonly EditorPeekLineRow[] = peek.oldLines.map((line) => ({
    kind: "peekLine",
    id: `${peek.id}-old-line-${line.lineNumber}`,
    peekId: peek.id,
    peekKind: peek.kind,
    oldLineNumber: line.lineNumber,
    text: line.text,
    commentability: "none",
    estimatedHeight: 22,
  }));
  const annotations: readonly EditorAnnotationRow[] = peek.annotations.map(
    (text, index) => ({
      kind: "annotation",
      id: `${peek.id}-annotation-${index}`,
      peekId: peek.id,
      text,
      commentability: "none",
      estimatedHeight: 28,
    }),
  );
  return [summary, ...oldLines, ...annotations];
}

/**
 * Validates both hunk sides, cross-hunk ordering, overlaps and deleted-file coverage.
 *
 * @param input - Diff, canonical content and common change blocks.
 * @returns A developer-facing inconsistency reason, or null when safe to project.
 */
function validateDiff(
  input: Readonly<{
    fileDiff: FileDiff;
    oldContent: FileContent;
    currentLines: readonly string[];
    blocks: readonly ChangeBlock[];
  }>,
): string | null {
  const oldCanonical =
    input.oldContent.state === "available"
      ? splitCanonicalLines(input.oldContent.text).lines
      : null;
  const oldMissingAllowed =
    (input.fileDiff.review.file.change === "added" ||
      input.fileDiff.review.file.change === "untracked") &&
    input.oldContent.state === "omitted" &&
    input.oldContent.reason === "missingSide";
  const newMissingAllowed =
    input.fileDiff.review.file.change === "deleted" &&
    input.fileDiff.review.newContent.state === "omitted" &&
    input.fileDiff.review.newContent.reason === "missingSide";
  if (oldCanonical === null && !oldMissingAllowed) {
    return "old content is unavailable";
  }
  if (
    input.fileDiff.review.newContent.state === "omitted" &&
    !newMissingAllowed
  ) {
    return "current content is unavailable";
  }

  let lastOldLine = 0;
  let lastNewLine = 0;
  const deletionBoundaries = new Set<number>();
  let lastDeletionBoundary = 0;
  for (const hunk of input.fileDiff.review.structuredDiff.state === "available"
    ? input.fileDiff.review.structuredDiff.hunks
    : []) {
    const parsed = parseHunkHeader(hunk.header);
    if (parsed === null) {
      return "invalid hunk header";
    }
    let expectedOld = parsed.oldStart;
    let expectedNew = parsed.newStart;
    let consumedOld = 0;
    let consumedNew = 0;
    for (const line of hunk.lines) {
      if (line.kind === "noNewline") {
        if (line.oldLineNumber !== null || line.newLineNumber !== null) {
          return "annotation has a line number";
        }
        continue;
      }
      const consumesOld = line.kind !== "added";
      const consumesNew = line.kind !== "removed";
      if (consumesOld) {
        if (
          !isPositiveSafeInteger(line.oldLineNumber) ||
          line.oldLineNumber !== expectedOld
        ) {
          return "old line numbering is inconsistent";
        }
        if (line.oldLineNumber <= lastOldLine) {
          return "old line order overlaps or reverses";
        }
        if (
          oldCanonical === null ||
          oldCanonical[line.oldLineNumber - 1] !== line.text
        ) {
          return "old hunk text does not match content";
        }
        lastOldLine = line.oldLineNumber;
        expectedOld += 1;
        consumedOld += 1;
      } else if (line.oldLineNumber !== null) {
        return "added line has an old line number";
      }
      if (consumesNew) {
        if (
          !isPositiveSafeInteger(line.newLineNumber) ||
          line.newLineNumber !== expectedNew
        ) {
          return "new line numbering is inconsistent";
        }
        if (line.newLineNumber <= lastNewLine) {
          return "new line order overlaps or reverses";
        }
        if (input.currentLines[line.newLineNumber - 1] !== line.text) {
          return "new hunk text does not match content";
        }
        lastNewLine = line.newLineNumber;
        expectedNew += 1;
        consumedNew += 1;
      } else if (line.newLineNumber !== null) {
        return "removed line has a new line number";
      }
    }
    if (consumedOld !== parsed.oldCount || consumedNew !== parsed.newCount) {
      return "hunk header range does not match its lines";
    }
  }

  for (const block of input.blocks) {
    if (block.newLines.length === 0) {
      const boundary = block.insertionLine;
      if (deletionBoundaries.has(boundary) || boundary < lastDeletionBoundary) {
        return "deletion boundaries overlap";
      }
      deletionBoundaries.add(boundary);
      lastDeletionBoundary = boundary;
    }
  }

  if (newMissingAllowed) {
    if (
      oldCanonical === null ||
      !coversWholeDeletedFile(input.blocks, oldCanonical.length)
    ) {
      return "deleted hunk does not cover the whole old file";
    }
  }
  return null;
}

/**
 * Verifies that deleted-file change blocks represent every old logical line exactly once.
 *
 * @param blocks - Deleted-file blocks.
 * @param oldLineCount - Number of canonical base lines.
 * @returns True only for an exact whole-file removal.
 */
function coversWholeDeletedFile(
  blocks: readonly ChangeBlock[],
  oldLineCount: number,
): boolean {
  const numbers = blocks.flatMap((block) => {
    if (block.newLines.length > 0) {
      return [];
    }
    return block.oldLines.flatMap(({ line }) =>
      line.oldLineNumber === null ? [] : [line.oldLineNumber],
    );
  });
  return (
    numbers.length === oldLineCount &&
    numbers.every((lineNumber, index) => lineNumber === index + 1)
  );
}

/**
 * Parses and validates the numeric portions of a unified hunk header.
 *
 * @param header - Header to parse.
 * @returns Range metadata or null for invalid grammar/numbers.
 */
function parseHunkHeader(header: string): Readonly<{
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
}> | null {
  const match = HunkHeaderPattern.exec(header);
  if (match === null) {
    return null;
  }
  const result = {
    oldStart: Number(match[1]),
    oldCount: Number(match[2] ?? "1"),
    newStart: Number(match[3]),
    newCount: Number(match[4] ?? "1"),
  };
  const values = Object.values(result);
  if (
    !values.every(Number.isSafeInteger) ||
    result.oldCount < 0 ||
    result.newCount < 0
  ) {
    return null;
  }
  if (result.oldStart === 0 && result.oldCount > 0) {
    return null;
  }
  if (result.newStart === 0 && result.newCount > 0) {
    return null;
  }
  return result;
}

/**
 * Narrows a line number to a positive safe integer.
 *
 * @param value - Nullable line number.
 * @returns True for a usable real line number.
 */
function isPositiveSafeInteger(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value > 0;
}

/**
 * Builds line-number to array-index lookup without coupling it to display expansion.
 *
 * @param lines - Current semantic lines.
 * @returns Immutable numeric lookup.
 */
function createCurrentLineIndex(
  lines: readonly EditorCurrentLine[],
): Readonly<Record<number, number>> {
  return Object.fromEntries(
    lines.map((line, index) => [line.lineNumber, index]),
  );
}

/**
 * Creates a state without change identities and with explicit diagnostic metadata.
 *
 * @param input - Safe top-level state and optional reason.
 * @returns Empty base model suitable for fallback extension.
 */
function createNonReadyModel(
  input: Readonly<{
    state: EditorViewModel["state"];
    omissionReason?: OmissionReason;
    inconsistencyReason?: string;
  }>,
): EditorViewModel {
  return {
    state: input.state,
    omissionReason: input.omissionReason ?? null,
    inconsistencyReason: input.inconsistencyReason ?? null,
    currentLines: [],
    peeks: [],
    orderedChangeIds: [],
    currentLineIndex: {},
    changeTargetIds: {},
    hasFinalNewline: false,
  };
}

export type { DiffLine };
