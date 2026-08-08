import type {
  DiffLine,
  FileContent,
  Hunk,
} from "@/features/diff/domain/fileDiff";
import type {
  DiffCell,
  DiffViewMode,
  DiffViewRow,
} from "@/features/diff/lib/diffViewModel";

type LineRangeReader = (
  startLineIndex: number,
  lineCount: number,
) => readonly string[] | null;

/**
 * Inserts hunk-gap rows and reconstructs expandable unchanged content when safe.
 *
 * @param input - Domain hunks, transformed rows, contents and layout mode.
 * @returns Rows with explicit gaps between separated hunks.
 */
export function insertHunkGaps(
  input: Readonly<{
    hunks: readonly Hunk[];
    transformedHunks: readonly Readonly<{ rows: readonly DiffViewRow[] }>[];
    oldContent: FileContent;
    newContent: FileContent;
    mode: DiffViewMode;
  }>,
): readonly DiffViewRow[] {
  const oldLineReader = createLineRangeReader(input.oldContent);
  const newLineReader = createLineRangeReader(input.newContent);

  return input.transformedHunks.flatMap((transformedHunk, hunkIndex) => {
    if (hunkIndex === 0) {
      return transformedHunk.rows;
    }

    const previousHunk = input.hunks[hunkIndex - 1];
    const currentHunk = input.hunks[hunkIndex];
    if (previousHunk === undefined || currentHunk === undefined) {
      return transformedHunk.rows;
    }

    const gap = createHunkGap({
      previousHunk,
      currentHunk,
      hunkIndex,
      oldLineReader,
      newLineReader,
      mode: input.mode,
    });
    return gap === null ? transformedHunk.rows : [gap, ...transformedHunk.rows];
  });
}

/**
 * Builds a gap row spanning the omitted lines between two consecutive hunks, if any exist.
 *
 * @param input - The adjacent hunks, the current hunk's index, line readers for reconstructing content and the layout mode.
 * @returns A `gap`-kind row, or null when either hunk has no resolvable line numbers or the hunks are contiguous (no omitted lines).
 */
function createHunkGap(
  input: Readonly<{
    previousHunk: Hunk;
    currentHunk: Hunk;
    hunkIndex: number;
    oldLineReader: LineRangeReader | null;
    newLineReader: LineRangeReader | null;
    mode: DiffViewMode;
  }>,
): DiffViewRow | null {
  const previousOld = findLastLineNumber(
    input.previousHunk.lines,
    "oldLineNumber",
  );
  const previousNew = findLastLineNumber(
    input.previousHunk.lines,
    "newLineNumber",
  );
  const currentOld = findFirstLineNumber(
    input.currentHunk.lines,
    "oldLineNumber",
  );
  const currentNew = findFirstLineNumber(
    input.currentHunk.lines,
    "newLineNumber",
  );
  if (
    previousOld === null ||
    previousNew === null ||
    currentOld === null ||
    currentNew === null
  ) {
    return null;
  }

  const oldGapCount = currentOld - previousOld - 1;
  const newGapCount = currentNew - previousNew - 1;
  if (oldGapCount <= 0 && newGapCount <= 0) {
    return null;
  }

  const expandableRows = createExpandableRows({
    ...input,
    previousOld,
    previousNew,
    oldGapCount,
    newGapCount,
  });
  return {
    kind: "gap",
    id: `hunk-gap-${input.hunkIndex - 1}-${input.hunkIndex}`,
    omittedLineCount: Math.max(oldGapCount, newGapCount),
    expandableRows,
    estimatedHeight: 28,
  };
}

/**
 * Reconstructs the omitted context lines as expandable content rows, but only when both readers
 * are available and the reconstructed old/new ranges are complete and textually identical
 * (i.e. the gap is genuinely unchanged context, not a mismatch between old/new line counts).
 *
 * @param input - Line readers, the last known old/new line numbers before the gap, the gap sizes on each side, the hunk index and the layout mode.
 * @returns One content row per omitted line, or null when the gap cannot be safely reconstructed.
 */
function createExpandableRows(
  input: Readonly<{
    oldLineReader: LineRangeReader | null;
    newLineReader: LineRangeReader | null;
    previousOld: number;
    previousNew: number;
    oldGapCount: number;
    newGapCount: number;
    hunkIndex: number;
    mode: DiffViewMode;
  }>,
): readonly DiffViewRow[] | null {
  if (
    input.oldGapCount !== input.newGapCount ||
    input.oldLineReader === null ||
    input.newLineReader === null
  ) {
    return null;
  }

  const oldLines = input.oldLineReader(input.previousOld, input.oldGapCount);
  const newLines = input.newLineReader(input.previousNew, input.newGapCount);
  if (oldLines === null || newLines === null) {
    return null;
  }
  const hasCompleteRanges =
    oldLines.length === input.oldGapCount &&
    newLines.length === input.newGapCount;
  const hasMatchingContent = oldLines.every(
    (line, index) => line === newLines[index],
  );
  if (!hasCompleteRanges || !hasMatchingContent) {
    return null;
  }

  return oldLines.map((text, index) => {
    const line: DiffLine = {
      kind: "context",
      text,
      oldLineNumber: input.previousOld + index + 1,
      newLineNumber: input.previousNew + index + 1,
    };
    const cell = createCell(line);
    return {
      kind: "content",
      id: `hunk-gap-${input.hunkIndex - 1}-${input.hunkIndex}-line-${index}`,
      changeId: null,
      inline: input.mode === "inline" ? cell : null,
      old: cell,
      next: cell,
      estimatedHeight: 20,
    };
  });
}

/**
 * Creates a stateful, forward-only reader that returns a slice of lines from file content by
 * line index. Returns null immediately when the content is unavailable, and the returned reader
 * itself returns null when asked to seek backward or when the requested range runs past the end
 * of the text.
 *
 * @param content - File content, which may or may not have been successfully loaded.
 * @returns A line-range reader, or null when the content is not available.
 */
function createLineRangeReader(content: FileContent): LineRangeReader | null {
  if (content.state !== "available") {
    return null;
  }

  const text = content.text;
  let nextLineIndex = 0;
  let nextLineStart = 0;

  return (startLineIndex, lineCount) => {
    if (startLineIndex < nextLineIndex) {
      return null;
    }

    while (nextLineIndex < startLineIndex) {
      if (nextLineStart > text.length) {
        return null;
      }
      const newlineIndex = text.indexOf("\n", nextLineStart);
      nextLineStart = newlineIndex === -1 ? text.length + 1 : newlineIndex + 1;
      nextLineIndex += 1;
    }

    const lines: string[] = [];
    while (lines.length < lineCount) {
      if (nextLineStart > text.length) {
        return null;
      }
      const newlineIndex = text.indexOf("\n", nextLineStart);
      const lineEnd = newlineIndex === -1 ? text.length : newlineIndex;
      lines.push(text.slice(nextLineStart, lineEnd));
      nextLineStart = newlineIndex === -1 ? text.length + 1 : newlineIndex + 1;
      nextLineIndex += 1;
    }

    return lines;
  };
}

/**
 * Finds the last non-null line number (old or new side) among a hunk's lines, by scanning
 * forward and keeping the most recent non-null value found.
 *
 * @param lines - Lines of a hunk, in source order.
 * @param key - Which side's line number to read.
 * @returns The last non-null line number, or null if none of the lines carry one.
 */
function findLastLineNumber(
  lines: readonly DiffLine[],
  key: "oldLineNumber" | "newLineNumber",
): number | null {
  return lines.reduce<number | null>(
    (result, line) => line[key] ?? result,
    null,
  );
}

/**
 * Finds the first non-null line number (old or new side) among a hunk's lines.
 *
 * @param lines - Lines of a hunk, in source order.
 * @param key - Which side's line number to read.
 * @returns The first non-null line number, or null if none of the lines carry one.
 */
function findFirstLineNumber(
  lines: readonly DiffLine[],
  key: "oldLineNumber" | "newLineNumber",
): number | null {
  return lines.find((line) => line[key] !== null)?.[key] ?? null;
}

/**
 * Wraps a reconstructed context line in a diff cell with a single unchanged segment.
 *
 * @param line - The context line to wrap.
 * @returns A cell containing exactly one `unchanged` segment holding the line's text.
 */
function createCell(line: DiffLine): DiffCell {
  return { line, segments: [{ kind: "unchanged", text: line.text }] };
}
