import type { DiffLine, Hunk } from "@/features/diff/domain/fileDiff";

export type LineRange = Readonly<{ start: number; end: number }>;

export type ProjectedChangeLine = Readonly<{
  lineIndex: number;
  line: DiffLine;
}>;

export type ChangeBlock = Readonly<{
  id: string;
  hunkIndex: number;
  changeIndex: number;
  startLineIndex: number;
  endLineIndex: number;
  oldLines: readonly ProjectedChangeLine[];
  newLines: readonly ProjectedChangeLine[];
  oldRange: LineRange | null;
  newRange: LineRange | null;
  insertionLine: number;
  annotations: readonly string[];
}>;

const HunkHeaderPattern =
  /^@@ -([0-9]+)(?:,[0-9]+)? \+([0-9]+)(?:,([0-9]+))? @@(?: .*)?$/;

/**
 * Projects every changed run to one source-neutral identity shared by all renderers.
 *
 * @param hunks - Structured hunks in source order.
 * @returns Ordered immutable change blocks with old/new ranges.
 */
export function projectChangeBlocks(
  hunks: readonly Hunk[],
): readonly ChangeBlock[] {
  return hunks.flatMap((hunk, hunkIndex) =>
    projectHunkChangeBlocks(hunk, hunkIndex),
  );
}

/**
 * Projects changed runs from one hunk while preserving the hunk-local change index.
 *
 * @param hunk - Hunk whose changed lines are grouped.
 * @param hunkIndex - Stable position of the hunk.
 * @returns Ordered change blocks belonging to the hunk.
 */
export function projectHunkChangeBlocks(
  hunk: Hunk,
  hunkIndex: number,
): readonly ChangeBlock[] {
  const blocks: ChangeBlock[] = [];
  let lineIndex = 0;
  let currentNewLine = getInitialCurrentLine(hunk.header);

  while (lineIndex < hunk.lines.length) {
    const line = hunk.lines[lineIndex];
    if (line === undefined) {
      break;
    }
    if (line.kind === "context") {
      currentNewLine = (line.newLineNumber ?? currentNewLine) + 1;
      lineIndex += 1;
      continue;
    }
    if (line.kind === "noNewline") {
      lineIndex += 1;
      continue;
    }

    const startLineIndex = lineIndex;
    const insertionLine = Math.max(1, currentNewLine);
    const oldLines: ProjectedChangeLine[] = [];
    const newLines: ProjectedChangeLine[] = [];
    const annotations: string[] = [];

    while (lineIndex < hunk.lines.length) {
      const candidate = hunk.lines[lineIndex];
      if (candidate === undefined || candidate.kind === "context") {
        break;
      }
      if (candidate.kind === "noNewline") {
        annotations.push(candidate.text);
        lineIndex += 1;
        continue;
      }
      if (candidate.kind === "removed") {
        oldLines.push({ lineIndex, line: candidate });
      } else {
        newLines.push({ lineIndex, line: candidate });
        currentNewLine = (candidate.newLineNumber ?? currentNewLine) + 1;
      }
      lineIndex += 1;
    }

    const changeIndex = blocks.length;
    blocks.push({
      id: `hunk-${hunkIndex}-change-${changeIndex}`,
      hunkIndex,
      changeIndex,
      startLineIndex,
      endLineIndex: Math.max(startLineIndex, lineIndex - 1),
      oldLines,
      newLines,
      oldRange: createRange(oldLines, "oldLineNumber"),
      newRange: createRange(newLines, "newLineNumber"),
      insertionLine,
      annotations,
    });
  }

  return blocks;
}

/**
 * Parses the current-side start boundary from a unified hunk header.
 *
 * @param header - Unified hunk header.
 * @returns Current-side start number, including zero for an empty side.
 */
export function getHunkNewStart(header: string): number {
  const match = HunkHeaderPattern.exec(header);
  const value = Number(match?.[2]);
  return Number.isSafeInteger(value) ? value : 0;
}

/**
 * Resolves the first insertion boundary for unified zero-line ranges.
 *
 * @param header - Unified hunk header.
 * @returns First current line before which a changed block is inserted.
 */
function getInitialCurrentLine(header: string): number {
  const match = HunkHeaderPattern.exec(header);
  const start = Number(match?.[2]);
  const count = Number(match?.[3] ?? "1");
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(count)) {
    return 0;
  }
  return count === 0 ? start + 1 : start;
}
/**
 * Creates the inclusive range represented by numbered changed lines.
 *
 * @param lines - Changed line entries.
 * @param key - Number field for the requested side.
 * @returns Inclusive range, or null when the block has no lines on that side.
 */
function createRange(
  lines: readonly ProjectedChangeLine[],
  key: "oldLineNumber" | "newLineNumber",
): LineRange | null {
  const numbers = lines.flatMap(({ line }) => {
    const value = line[key];
    return value === null ? [] : [value];
  });
  const start = numbers[0];
  const end = numbers[numbers.length - 1];
  if (start === undefined || end === undefined) {
    return null;
  }
  return { start, end };
}
