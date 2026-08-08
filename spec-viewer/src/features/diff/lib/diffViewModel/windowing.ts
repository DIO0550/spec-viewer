const FallbackViewportHeight = 800;

export type VisibleWindow = Readonly<{
  startIndex: number;
  endIndex: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
}>;

/**
 * Calculates a bounded fixed-height row window with symmetric row overscan.
 *
 * @param input - Prefix offsets, scroll geometry and row limits.
 * @returns Slice indexes and spacer heights for semantic rendering.
 */
export function calculateVisibleWindow(
  input: Readonly<{
    offsets: readonly number[];
    scrollTop: number;
    viewportHeight: number;
    overscanRows: number;
    hardCap: number;
  }>,
): VisibleWindow {
  const rowCount = Math.max(0, input.offsets.length - 1);
  if (rowCount === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
    };
  }

  const viewportHeight =
    input.viewportHeight > 0 ? input.viewportHeight : FallbackViewportHeight;
  const scrollTop = Math.max(0, input.scrollTop);
  const firstVisibleIndex = Math.max(
    0,
    findFirstOffsetGreaterThan(input.offsets, scrollTop) - 1,
  );
  const visibleBottom = scrollTop + viewportHeight;
  const visibleEndIndex = Math.min(
    rowCount,
    findFirstOffsetAtLeast(input.offsets, visibleBottom),
  );
  const startIndex = Math.max(0, firstVisibleIndex - input.overscanRows);
  const requestedEndIndex = Math.min(
    rowCount,
    visibleEndIndex + input.overscanRows,
  );
  const endIndex = Math.min(requestedEndIndex, startIndex + input.hardCap);
  const totalHeight = input.offsets[rowCount] ?? 0;

  return {
    startIndex,
    endIndex,
    topSpacerHeight: input.offsets[startIndex] ?? 0,
    bottomSpacerHeight: totalHeight - (input.offsets[endIndex] ?? totalHeight),
  };
}

/**
 * Binary-searches for the index of the first offset strictly greater than the target, treating
 * missing entries as positive infinity.
 *
 * @param offsets - Cumulative row offsets, assumed non-decreasing.
 * @param target - The scroll position to search past.
 * @returns The index of the first offset greater than `target`; equals `offsets.length` if none is.
 */
function findFirstOffsetGreaterThan(
  offsets: readonly number[],
  target: number,
): number {
  let lower = 0;
  let upper = offsets.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    const offset = offsets[middle] ?? Number.POSITIVE_INFINITY;
    if (offset <= target) {
      lower = middle + 1;
    } else {
      upper = middle;
    }
  }
  return lower;
}

/**
 * Binary-searches for the index of the first offset at least equal to the target, treating
 * missing entries as positive infinity.
 *
 * @param offsets - Cumulative row offsets, assumed non-decreasing.
 * @param target - The visible-bottom position to search up to.
 * @returns The index of the first offset that is `>= target`; equals `offsets.length` if none is.
 */
function findFirstOffsetAtLeast(
  offsets: readonly number[],
  target: number,
): number {
  let lower = 0;
  let upper = offsets.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    const offset = offsets[middle] ?? Number.POSITIVE_INFINITY;
    if (offset < target) {
      lower = middle + 1;
    } else {
      upper = middle;
    }
  }
  return lower;
}
