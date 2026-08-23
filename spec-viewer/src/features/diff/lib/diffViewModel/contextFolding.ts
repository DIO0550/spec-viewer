import type { DiffViewRow } from "@/features/diff/lib/diffViewModel";

/**
 * Replaces long contiguous context runs with stable expandable gap rows.
 *
 * @param rows - Fully materialized rows for one display mode.
 * @param contextRadius - Number of leading and trailing context rows to retain.
 * @returns Rows with only long context runs collapsed.
 */
export function foldContextRows(
  rows: readonly DiffViewRow[],
  contextRadius: number,
): readonly DiffViewRow[] {
  const foldedRows: DiffViewRow[] = [];
  let rowIndex = 0;

  while (rowIndex < rows.length) {
    const row = rows[rowIndex];
    if (row === undefined) {
      break;
    }

    if (!isContextRow(row)) {
      foldedRows.push(row);
      rowIndex += 1;
      continue;
    }

    const contextRun: DiffViewRow[] = [];
    while (rowIndex < rows.length) {
      const candidate = rows[rowIndex];
      if (candidate === undefined || !isContextRow(candidate)) {
        break;
      }
      contextRun.push(candidate);
      rowIndex += 1;
    }

    foldedRows.push(...foldContextRun(contextRun, contextRadius));
  }

  return foldedRows;
}

/**
 * Collapses a single contiguous run of context rows into a leading/trailing radius plus a gap
 * row for the rows in between, when the run is longer than the visible threshold.
 *
 * @param rows - A contiguous run of context rows (all `content` rows with no changeId).
 * @param contextRadius - Number of leading and trailing rows to keep visible around the gap.
 * @returns The original rows when the run is short enough to show in full; otherwise the leading rows, a `gap` row, and the trailing rows.
 */
function foldContextRun(
  rows: readonly DiffViewRow[],
  contextRadius: number,
): readonly DiffViewRow[] {
  const visibleThreshold = contextRadius * 2 + 1;
  if (rows.length <= visibleThreshold) {
    return rows;
  }

  const firstRows = rows.slice(0, contextRadius);
  const lastRows = rows.slice(-contextRadius);
  const expandableRows = rows.slice(contextRadius, -contextRadius);
  const firstId = rows[0]?.id ?? "context";
  const hunkId = firstId.split("-line-")[0] ?? firstId;
  const gap: DiffViewRow = {
    kind: "gap",
    id: `${hunkId}-context-${contextRadius}-${rows.length - contextRadius - 1}`,
    omittedLineCount: expandableRows.length,
    expandableRows,
    estimatedHeight: 30,
  };

  return [...firstRows, gap, ...lastRows];
}

/**
 * Determines whether a row represents unchanged context: a content row with no change ID whose
 * inline cell (or both side-by-side cells) hold a `context`-kind line.
 *
 * @param row - The row to classify.
 * @returns True when the row is eligible to be folded as context.
 */
function isContextRow(row: DiffViewRow): boolean {
  if (row.kind !== "content" || row.changeId !== null) {
    return false;
  }

  const inlineIsContext = row.inline?.line.kind === "context";
  const bothSidesAreContext =
    row.old?.line.kind === "context" && row.next?.line.kind === "context";
  return inlineIsContext || bothSidesAreContext;
}
