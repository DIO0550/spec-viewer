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
      oldContent: input.oldContent,
      newContent: input.newContent,
      mode: input.mode,
    });
    return gap === null ? transformedHunk.rows : [gap, ...transformedHunk.rows];
  });
}

function createHunkGap(
  input: Readonly<{
    previousHunk: Hunk;
    currentHunk: Hunk;
    hunkIndex: number;
    oldContent: FileContent;
    newContent: FileContent;
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

function createExpandableRows(
  input: Readonly<{
    oldContent: FileContent;
    newContent: FileContent;
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
    input.oldContent.state !== "available" ||
    input.newContent.state !== "available"
  ) {
    return null;
  }

  const oldLines = input.oldContent.text
    .split("\n")
    .slice(input.previousOld, input.previousOld + input.oldGapCount);
  const newLines = input.newContent.text
    .split("\n")
    .slice(input.previousNew, input.previousNew + input.newGapCount);
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

function findLastLineNumber(
  lines: readonly DiffLine[],
  key: "oldLineNumber" | "newLineNumber",
): number | null {
  return lines.reduce<number | null>(
    (result, line) => line[key] ?? result,
    null,
  );
}

function findFirstLineNumber(
  lines: readonly DiffLine[],
  key: "oldLineNumber" | "newLineNumber",
): number | null {
  return lines.find((line) => line[key] !== null)?.[key] ?? null;
}

function createCell(line: DiffLine): DiffCell {
  return { line, segments: [{ kind: "unchanged", text: line.text }] };
}
