import type { DiffLine, Hunk } from "@/features/diff/domain/fileDiff";
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
): SideBySideHunk {
  const rows: DiffViewRow[] = [createHunkRow(hunkIndex, hunk.header)];
  const changeIds: string[] = [];
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

    const changeId = `hunk-${hunkIndex}-change-${changeIds.length}`;
    changeIds.push(changeId);
    rows.push(...createChangedRows({ block, blockStart, changeId, hunkIndex }));
    previousKind = block[block.length - 1]?.kind ?? previousKind;
  }

  return { rows, changeIds };
}

function isChangedLine(line: DiffLine | undefined): line is DiffLine {
  return line?.kind === "removed" || line?.kind === "added";
}

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

function createHunkRow(hunkIndex: number, header: string): DiffViewRow {
  return {
    kind: "hunk",
    id: `hunk-${hunkIndex}`,
    header,
    estimatedHeight: 28,
  };
}

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

function createCell(line: DiffLine): DiffCell {
  const kind =
    line.kind === "added" || line.kind === "removed" ? line.kind : "unchanged";
  return { line, segments: [{ kind, text: line.text }] };
}
