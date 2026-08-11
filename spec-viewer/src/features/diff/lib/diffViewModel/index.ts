import type {
  DiffLine,
  FileChangeStatus,
  FileDiff,
  OmissionReason,
} from "@/features/diff/domain/fileDiff";
import {
  type ChangeBlock,
  projectChangeBlocks,
} from "@/features/diff/lib/changeBlocks";
import { getFileChangePresentation } from "@/features/diff/lib/fileChangePresentation";
import { applyCharacterDiff } from "@/features/diff/lib/diffViewModel/characterDiff";
import { foldContextRows } from "@/features/diff/lib/diffViewModel/contextFolding";
import { insertHunkGaps } from "@/features/diff/lib/diffViewModel/hunkGaps";
import { createInlineHunk } from "@/features/diff/lib/diffViewModel/inline";
import { createSideBySideHunk } from "@/features/diff/lib/diffViewModel/sideBySide";

export {
  calculateVisibleWindow,
  type VisibleWindow,
} from "@/features/diff/lib/diffViewModel/windowing";

export type DiffViewMode = "inline" | "sideBySide";

export type DiffSegment = Readonly<{
  kind: "unchanged" | "added" | "removed";
  text: string;
}>;

export type DiffCell = Readonly<{
  line: DiffLine;
  segments: readonly DiffSegment[];
}>;

export type DiffViewRow =
  | Readonly<{
      kind: "hunk";
      id: string;
      header: string;
      estimatedHeight: 28;
    }>
  | Readonly<{
      kind: "content";
      id: string;
      changeId: string | null;
      inline: DiffCell | null;
      old: DiffCell | null;
      next: DiffCell | null;
      estimatedHeight: 20;
    }>
  | Readonly<{
      kind: "annotation";
      id: string;
      side: "old" | "new" | "both";
      text: string;
      estimatedHeight: 28;
    }>
  | Readonly<{
      kind: "gap";
      id: string;
      omittedLineCount: number;
      expandableRows: readonly DiffViewRow[] | null;
      estimatedHeight: 28;
    }>;

export type DiffViewModel = Readonly<{
  state: "ready" | "empty" | "omitted";
  omissionReason: OmissionReason | null;
  status: Readonly<{ change: FileChangeStatus; label: string }>;
  inlineRows: readonly DiffViewRow[];
  sideBySideRows: readonly DiffViewRow[];
  changeIds: readonly string[];
  changeBlocks: readonly ChangeBlock[];
}>;

export type DiffModelOptions = Readonly<{
  contextRadius: number;
  maxCharacterPairs: number;
  maxCharacterCodeUnits: number;
  maxCodeUnitsPerPair: number;
}>;

const DefaultOptions: DiffModelOptions = {
  contextRadius: 3,
  maxCharacterPairs: 250,
  maxCharacterCodeUnits: 100_000,
  maxCodeUnitsPerPair: 4_096,
};

/**
 * Builds the immutable presentation model used by both diff layouts.
 *
 * @param fileDiff - Decoded diff domain input.
 * @param options - Optional transformation budgets.
 * @returns A presentation model without React or DOM dependencies.
 */
export function buildDiffViewModel(
  fileDiff: FileDiff,
  options: Partial<DiffModelOptions> = {},
): DiffViewModel {
  const resolvedOptions: DiffModelOptions = { ...DefaultOptions, ...options };
  const status = {
    change: fileDiff.review.file.change,
    label: getFileChangePresentation(fileDiff.review.file.change).label,
  } as const;
  const structuredDiff = fileDiff.review.structuredDiff;
  const availability = fileDiff.availability;

  if (availability.kind === "omitted") {
    return createNonReadyModel("omitted", availability.reason, status);
  }

  if (availability.kind === "missing") {
    return createNonReadyModel("omitted", "missingSide", status);
  }

  if (availability.kind === "empty") {
    return createNonReadyModel("empty", null, status);
  }

  const changeBlocks = projectChangeBlocks(structuredDiff.hunks);
  const changeBlocksByHunk: ChangeBlock[][] = structuredDiff.hunks.map(
    () => [],
  );
  for (const block of changeBlocks) {
    changeBlocksByHunk[block.hunkIndex]?.push(block);
  }
  const inlineHunks = structuredDiff.hunks.map((hunk, hunkIndex) =>
    createInlineHunk(hunk, hunkIndex, changeBlocksByHunk[hunkIndex] ?? []),
  );
  const sideBySideHunks = structuredDiff.hunks.map((hunk, hunkIndex) =>
    createSideBySideHunk(hunk, hunkIndex, changeBlocksByHunk[hunkIndex] ?? []),
  );
  const inlineRowsWithHunkGaps = insertHunkGaps({
    hunks: structuredDiff.hunks,
    transformedHunks: inlineHunks,
    oldContent: fileDiff.review.oldContent,
    newContent: fileDiff.review.newContent,
    mode: "inline",
  });
  const sideBySideRowsWithHunkGaps = insertHunkGaps({
    hunks: structuredDiff.hunks,
    transformedHunks: sideBySideHunks,
    oldContent: fileDiff.review.oldContent,
    newContent: fileDiff.review.newContent,
    mode: "sideBySide",
  });
  const rowsWithCharacterDiff = applyCharacterDiff(
    inlineRowsWithHunkGaps,
    sideBySideRowsWithHunkGaps,
    resolvedOptions,
  );

  return {
    state: "ready",
    omissionReason: null,
    status,
    inlineRows: foldContextRows(
      rowsWithCharacterDiff.inlineRows,
      resolvedOptions.contextRadius,
    ),
    sideBySideRows: foldContextRows(
      rowsWithCharacterDiff.sideBySideRows,
      resolvedOptions.contextRadius,
    ),
    changeIds: changeBlocks.map((block) => block.id),
    changeBlocks,
  };
}

/**
 * Expands selected context gaps for the requested display mode.
 *
 * @param model - Base immutable view model.
 * @param mode - Requested layout mode.
 * @param expandedGapIds - Gap identifiers selected by the user.
 * @returns Materialized rows for rendering.
 */
export function materializeRows(
  model: DiffViewModel,
  mode: DiffViewMode,
  expandedGapIds: ReadonlySet<string>,
): readonly DiffViewRow[] {
  const rows = mode === "inline" ? model.inlineRows : model.sideBySideRows;

  return rows.flatMap((row) => {
    if (row.kind !== "gap") {
      return [row];
    }
    if (!expandedGapIds.has(row.id) || row.expandableRows === null) {
      return [row];
    }

    return row.expandableRows;
  });
}

/**
 * Resolves the adjacent change without wrapping at collection boundaries.
 *
 * @param changeIds - Ordered stable change identifiers.
 * @param activeChangeId - Currently selected change identifier.
 * @param direction - Navigation direction.
 * @returns The adjacent index, or null when navigation is not possible.
 */
export function findAdjacentChangeIndex(
  changeIds: readonly string[],
  activeChangeId: string | null,
  direction: "previous" | "next",
): number | null {
  if (changeIds.length === 0 || activeChangeId === null) {
    return null;
  }

  const currentIndex = changeIds.indexOf(activeChangeId);
  if (currentIndex < 0) {
    return null;
  }

  const offset = direction === "previous" ? -1 : 1;
  const nextIndex = currentIndex + offset;
  if (nextIndex < 0 || nextIndex >= changeIds.length) {
    return null;
  }

  return nextIndex;
}

/**
 * Calculates cumulative vertical offsets for fixed-height semantic rows.
 *
 * @param rows - Materialized display rows.
 * @returns An offset for each row plus the total height as the final value.
 */
export function calculateRowOffsets(
  rows: readonly DiffViewRow[],
): readonly number[] {
  const offsets = Array.from<number>({ length: rows.length + 1 });
  offsets[0] = 0;
  rows.forEach((row, index) => {
    offsets[index + 1] = (offsets[index] ?? 0) + row.estimatedHeight;
  });
  return offsets;
}

/**
 * Builds a view model with no rows for a diff that has no content to render (either omitted by
 * the backend or genuinely empty), preserving the file's status label.
 *
 * @param state - Whether the diff was omitted or has no hunks.
 * @param omissionReason - The backend-provided reason when omitted, or null.
 * @param status - The file's change status and its display label.
 * @returns A view model with empty `inlineRows`, `sideBySideRows` and `changeIds`.
 */
function createNonReadyModel(
  state: "empty" | "omitted",
  omissionReason: OmissionReason | null,
  status: Readonly<{ change: FileChangeStatus; label: string }>,
): DiffViewModel {
  return {
    state,
    omissionReason,
    status,
    inlineRows: [],
    sideBySideRows: [],
    changeIds: [],
    changeBlocks: [],
  };
}
