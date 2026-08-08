import { diffChars } from "diff";

import type { DiffLine } from "@/features/diff/domain/fileDiff";
import type {
  DiffCell,
  DiffSegment,
  DiffViewRow,
} from "@/features/diff/lib/diffViewModel";

export type CharacterDiffBudget = Readonly<{
  maxCharacterPairs: number;
  maxCharacterCodeUnits: number;
  maxCodeUnitsPerPair: number;
}>;

export type CharacterDiffRows = Readonly<{
  inlineRows: readonly DiffViewRow[];
  sideBySideRows: readonly DiffViewRow[];
}>;

/**
 * Applies deterministic character-level segments to paired changed rows.
 *
 * @param inlineRows - Source-ordered inline rows.
 * @param sideBySideRows - Aligned old/new rows.
 * @param budget - Pair and character work limits.
 * @returns New row collections with shared precomputed segments.
 */
export function applyCharacterDiff(
  inlineRows: readonly DiffViewRow[],
  sideBySideRows: readonly DiffViewRow[],
  budget: CharacterDiffBudget,
): CharacterDiffRows {
  const segmentsByLine = new Map<DiffLine, readonly DiffSegment[]>();
  let processedPairs = 0;
  let processedCodeUnits = 0;

  const nextSideBySideRows = sideBySideRows.map((row) => {
    if (!isPairedChangedRow(row)) {
      return row;
    }

    const pairCodeUnits = row.old.line.text.length + row.next.line.text.length;
    const exceedsPairBudget = pairCodeUnits > budget.maxCodeUnitsPerPair;
    const exceedsPairCount = processedPairs >= budget.maxCharacterPairs;
    const exceedsTotalBudget =
      processedCodeUnits + pairCodeUnits > budget.maxCharacterCodeUnits;
    if (exceedsPairBudget || exceedsPairCount || exceedsTotalBudget) {
      return row;
    }

    const changes = diffChars(row.old.line.text, row.next.line.text);
    const oldSegments = changes.flatMap((change): readonly DiffSegment[] => {
      if (change.added) {
        return [];
      }
      return [
        { kind: change.removed ? "removed" : "unchanged", text: change.value },
      ];
    });
    const nextSegments = changes.flatMap((change): readonly DiffSegment[] => {
      if (change.removed) {
        return [];
      }
      return [
        { kind: change.added ? "added" : "unchanged", text: change.value },
      ];
    });

    const normalizedOldSegments = normalizeSegments(oldSegments, {
      kind: "removed",
      text: row.old.line.text,
    });
    const normalizedNextSegments = normalizeSegments(nextSegments, {
      kind: "added",
      text: row.next.line.text,
    });

    processedPairs += 1;
    processedCodeUnits += pairCodeUnits;
    segmentsByLine.set(row.old.line, normalizedOldSegments);
    segmentsByLine.set(row.next.line, normalizedNextSegments);

    return {
      ...row,
      old: { ...row.old, segments: normalizedOldSegments },
      next: { ...row.next, segments: normalizedNextSegments },
    };
  });

  return {
    inlineRows: inlineRows.map((row) => updateRowSegments(row, segmentsByLine)),
    sideBySideRows: nextSideBySideRows,
  };
}

/**
 * Falls back to a single whole-line segment when character-level diffing produced no segments
 * (e.g. both sides reduced to an empty string).
 *
 * @param segments - Segments produced by the character diff for one side of a pair.
 * @param fallback - The whole-line segment to use when `segments` is empty.
 * @returns The original segments, or a single-element array containing `fallback`.
 */
function normalizeSegments(
  segments: readonly DiffSegment[],
  fallback: DiffSegment,
): readonly DiffSegment[] {
  if (segments.length > 0) {
    return segments;
  }

  return [fallback];
}

/**
 * Narrows a row to a side-by-side content row that pairs a removed line with an added line,
 * the only shape eligible for character-level diffing.
 *
 * @param row - Candidate row from the side-by-side row list.
 * @returns True when the row is a `content` row with a removed old cell and an added new cell.
 */
function isPairedChangedRow(
  row: DiffViewRow,
): row is Extract<DiffViewRow, { kind: "content" }> &
  Readonly<{ old: DiffCell; next: DiffCell }> {
  return (
    row.kind === "content" &&
    row.old?.line.kind === "removed" &&
    row.next?.line.kind === "added"
  );
}

/**
 * Applies previously computed character segments to an inline row's cells by looking up each
 * cell's underlying line in the shared segment map.
 *
 * @param row - An inline row to update; non-content rows are returned unchanged.
 * @param segmentsByLine - Segments computed while processing the side-by-side rows, keyed by line.
 * @returns The row with any matching cells' segments replaced, or the original row if it is not a content row.
 */
function updateRowSegments(
  row: DiffViewRow,
  segmentsByLine: ReadonlyMap<DiffLine, readonly DiffSegment[]>,
): DiffViewRow {
  if (row.kind !== "content") {
    return row;
  }

  return {
    ...row,
    inline: updateCellSegments(row.inline, segmentsByLine),
    old: updateCellSegments(row.old, segmentsByLine),
    next: updateCellSegments(row.next, segmentsByLine),
  };
}

/**
 * Replaces a cell's segments with the precomputed character-diff segments for its line, if any.
 *
 * @param cell - The cell to update, or null when the row has no content on this side.
 * @param segmentsByLine - Segments computed while processing the side-by-side rows, keyed by line.
 * @returns A new cell with updated segments, the original cell if its line has no computed segments, or null when `cell` is null.
 */
function updateCellSegments(
  cell: DiffCell | null,
  segmentsByLine: ReadonlyMap<DiffLine, readonly DiffSegment[]>,
): DiffCell | null {
  if (cell === null) {
    return null;
  }

  const segments = segmentsByLine.get(cell.line);
  if (segments === undefined) {
    return cell;
  }

  return { ...cell, segments };
}
