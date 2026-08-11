import type { DiffLine, Hunk } from "@/features/diff/domain/fileDiff";
import type { ChangeBlock } from "@/features/diff/lib/changeBlocks";
import type { DiffCell, DiffViewRow } from "@/features/diff/lib/diffViewModel";
import { createAnnotationRow } from "@/features/diff/lib/diffViewModel/annotation";

export type SideBySideHunk = Readonly<{
  rows: readonly DiffViewRow[];
  changeIds: readonly string[];
}>;

/**
 * Aligns a hunk into paired old/new rows while preserving context alignment.
 *
 * @param hunk - Domain hunk to align.
 * @param hunkIndex - Stable index within the structured diff.
 * @returns Paired rows and stable changed-block identifiers.
 */
export function createSideBySideHunk(
  hunk: Hunk,
  hunkIndex: number,
  changeBlocks: readonly ChangeBlock[],
): SideBySideHunk {
  const rows: DiffViewRow[] = [createHunkRow(hunkIndex, hunk.header)];
  const changeIdByLineIndex = Array.from<string | null>({
    length: hunk.lines.length,
  }).fill(null);
  changeBlocks.forEach((block) => {
    changeIdByLineIndex.fill(
      block.id,
      block.startLineIndex,
      block.endLineIndex + 1,
    );
  });
  let lineIndex = 0;
  let previousKind: DiffLine["kind"] | null = null;

  while (lineIndex < hunk.lines.length) {
    const line = hunk.lines[lineIndex];
    if (line === undefined) {
      break;
    }

    if (line.kind === "noNewline") {
      rows.push(
        createAnnotationRow({
          hunkIndex,
          lineIndex,
          text: line.text,
          previousKind,
        }),
      );
      lineIndex += 1;
      continue;
    }

    if (line.kind === "context") {
      rows.push(createContextRow(line, hunkIndex, lineIndex));
      previousKind = line.kind;
      lineIndex += 1;
      continue;
    }

    const blockStart = lineIndex;
    const block: DiffLine[] = [];
    while (lineIndex < hunk.lines.length) {
      const candidate = hunk.lines[lineIndex];
      if (!isChangedLine(candidate)) {
        break;
      }
      block.push(candidate);
      lineIndex += 1;
    }

    if (block.length === 0) {
      lineIndex += 1;
      continue;
    }

    const changeId = changeIdByLineIndex[blockStart] ?? null;
    if (changeId === null) {
      previousKind = block[block.length - 1]?.kind ?? previousKind;
      continue;
    }
    rows.push(...createChangedRows({ block, blockStart, changeId, hunkIndex }));
    previousKind = block[block.length - 1]?.kind ?? previousKind;
  }

  return { rows, changeIds: changeBlocks.map((block) => block.id) };
}

/**
 * Narrows a possibly-undefined line to a removed or added line for run grouping.
 *
 * @param line - Candidate line from the hunk, or undefined past the end.
 * @returns True when the line exists and is a removed or added line.
 */
function isChangedLine(line: DiffLine | undefined): line is DiffLine {
  return line?.kind === "removed" || line?.kind === "added";
}

/**
 * Pairs a run of removed/added lines into aligned rows, padding the shorter side with null cells.
 *
 * @param input - The changed-line block, its starting line index, the shared change ID and hunk index.
 * @returns One content row per aligned removed/added pair.
 */
function createChangedRows(
  input: Readonly<{
    block: readonly DiffLine[];
    blockStart: number;
    changeId: string;
    hunkIndex: number;
  }>,
): readonly DiffViewRow[] {
  const removedLines = input.block.filter((line) => line.kind === "removed");
  const addedLines = input.block.filter((line) => line.kind === "added");
  const rowCount = Math.max(removedLines.length, addedLines.length);

  return Array.from({ length: rowCount }, (_, pairIndex) => {
    const removed = removedLines[pairIndex];
    const added = addedLines[pairIndex];
    return createContentRow({
      id: `hunk-${input.hunkIndex}-block-${input.blockStart}-pair-${pairIndex}`,
      changeId: input.changeId,
      old: removed === undefined ? null : createCell(removed),
      next: added === undefined ? null : createCell(added),
    });
  });
}

/**
 * Builds a side-by-side content row for an unchanged context line, using the same cell on both sides.
 *
 * @param line - The context line to render.
 * @param hunkIndex - Stable index of the enclosing hunk.
 * @param lineIndex - Position of the line within the hunk, used for the row ID.
 * @returns A content row with `changeId` set to null and identical old/new cells.
 */
function createContextRow(
  line: DiffLine,
  hunkIndex: number,
  lineIndex: number,
): DiffViewRow {
  const cell = createCell(line);
  return createContentRow({
    id: `hunk-${hunkIndex}-line-${lineIndex}`,
    changeId: null,
    old: cell,
    next: cell,
  });
}

/**
 * Builds the header row that introduces a hunk in the row list.
 *
 * @param hunkIndex - Stable index of the hunk, used for the row ID.
 * @param header - The hunk header text (e.g. `@@ ... @@`) to display.
 * @returns A `hunk`-kind row.
 */
function createHunkRow(hunkIndex: number, header: string): DiffViewRow {
  return {
    kind: "hunk",
    id: `hunk-${hunkIndex}`,
    header,
    estimatedHeight: 28,
  };
}

/**
 * Assembles a side-by-side `content` row from a precomputed ID, change ID and pair of cells.
 *
 * @param input - The row ID, associated change ID (or null) and old/new cells (either may be null when unpaired).
 * @returns A `content`-kind row with `inline` set to null, since this row is only used in side-by-side layout.
 */
function createContentRow(
  input: Readonly<{
    id: string;
    changeId: string | null;
    old: DiffCell | null;
    next: DiffCell | null;
  }>,
): DiffViewRow {
  return {
    kind: "content",
    id: input.id,
    changeId: input.changeId,
    inline: null,
    old: input.old,
    next: input.next,
    estimatedHeight: 20,
  };
}

/**
 * Wraps a domain line in a diff cell with a single unsegmented text run.
 *
 * @param line - The line to wrap.
 * @returns A cell whose single segment kind matches the line kind (`added`/`removed`), or `unchanged` for context lines.
 */
function createCell(line: DiffLine): DiffCell {
  const kind =
    line.kind === "added" || line.kind === "removed" ? line.kind : "unchanged";
  return { line, segments: [{ kind, text: line.text }] };
}
