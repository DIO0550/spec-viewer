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

function createHunkRow(hunkIndex: number, header: string): DiffViewRow {
  return {
    kind: "hunk",
    id: `hunk-${hunkIndex}`,
    header,
    estimatedHeight: 28,
  };
}

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

function createCell(line: DiffLine): DiffCell {
  const kind =
    line.kind === "added" || line.kind === "removed" ? line.kind : "unchanged";
  return { line, segments: [{ kind, text: line.text }] };
}
