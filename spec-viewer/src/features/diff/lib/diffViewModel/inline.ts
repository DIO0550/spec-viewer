import type { DiffLine, Hunk } from "@/features/diff/domain/fileDiff";
import type { DiffCell, DiffViewRow } from "@/features/diff/lib/diffViewModel";
import { createAnnotationRow } from "@/features/diff/lib/diffViewModel/annotation";

export type InlineHunk = Readonly<{
  rows: readonly DiffViewRow[];
  changeIds: readonly string[];
}>;

/**
 * Converts a hunk to source-ordered inline rows with stable changed-block IDs.
 *
 * @param hunk - Domain hunk to convert.
 * @param hunkIndex - Stable index within the structured diff.
 * @returns Inline rows and ordered change identifiers.
 */
export function createInlineHunk(hunk: Hunk, hunkIndex: number): InlineHunk {
  const rows: DiffViewRow[] = [createHunkRow(hunkIndex, hunk.header)];
  const changeIds: string[] = [];
  let activeChangeId: string | null = null;
  let previousKind: DiffLine["kind"] | null = null;

  hunk.lines.forEach((line, lineIndex) => {
    if (line.kind === "noNewline") {
      rows.push(
        createAnnotationRow({
          hunkIndex,
          lineIndex,
          text: line.text,
          previousKind,
        }),
      );
      return;
    }

    if (line.kind === "context") {
      activeChangeId = null;
    } else if (activeChangeId === null) {
      activeChangeId = `hunk-${hunkIndex}-change-${changeIds.length}`;
      changeIds.push(activeChangeId);
    }

    rows.push(createInlineRow({ hunkIndex, lineIndex, line, activeChangeId }));
    previousKind = line.kind;
  });

  return { rows, changeIds };
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
 * Builds a source-ordered inline content row for a single line, placing it on the `old` side
 * unless it was added, and on the `new` side unless it was removed.
 *
 * @param input - The enclosing hunk index, the line's position, the line itself and the active change ID (or null for context).
 * @returns A `content`-kind row with the same cell shared across `inline`, and whichever of `old`/`next` apply.
 */
function createInlineRow(
  input: Readonly<{
    hunkIndex: number;
    lineIndex: number;
    line: DiffLine;
    activeChangeId: string | null;
  }>,
): DiffViewRow {
  const cell = createCell(input.line);
  return {
    kind: "content",
    id: `hunk-${input.hunkIndex}-line-${input.lineIndex}`,
    changeId: input.activeChangeId,
    inline: cell,
    old: input.line.kind === "added" ? null : cell,
    next: input.line.kind === "removed" ? null : cell,
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
