export type HeightMeasurementCache = Readonly<Record<string, number>>;

export type MixedHeightRow = Readonly<{
  id: string;
  estimatedHeight: number;
}>;

/**
 * Creates an empty immutable row-height cache scoped to one viewer revision.
 *
 * @returns Empty measurement lookup.
 */
export function createMeasurementCache(): HeightMeasurementCache {
  return {};
}

/**
 * Records a positive finite row measurement without mutating the current cache.
 *
 * @param cache - Current revision-local measurements.
 * @param rowId - Stable semantic row identity.
 * @param height - Measured CSS pixel height.
 * @returns Original cache for invalid/unchanged values, otherwise an updated cache.
 */
export function updateMeasuredHeight(
  cache: HeightMeasurementCache,
  rowId: string,
  height: number,
): HeightMeasurementCache {
  if (!Number.isFinite(height) || height <= 0 || cache[rowId] === height) {
    return cache;
  }
  return { ...cache, [rowId]: height };
}

/**
 * Merges one animation frame of visible-row measurements in one cache update.
 *
 * @param cache - Current revision-local measurements.
 * @param heights - Row heights collected during one frame.
 * @returns Original cache when unchanged, otherwise one updated lookup.
 */
export function mergeMeasuredHeights(
  cache: HeightMeasurementCache,
  heights: HeightMeasurementCache,
): HeightMeasurementCache {
  let next: Record<string, number> = cache;
  for (const [rowId, height] of Object.entries(heights)) {
    if (!Number.isFinite(height) || height <= 0 || cache[rowId] === height) {
      continue;
    }
    if (next === cache) {
      next = { ...cache };
    }
    next[rowId] = height;
  }
  return next;
}

/**
 * Calculates cumulative offsets using measurements when available and estimates otherwise.
 *
 * @param rows - Ordered semantic rows with fallback heights.
 * @param cache - Revision-local measured heights.
 * @returns Prefix offsets including total height as the last item.
 */
export function calculateMixedHeightOffsets(
  rows: readonly MixedHeightRow[],
  cache: HeightMeasurementCache,
): readonly number[] {
  const offsets = Array.from<number>({ length: rows.length + 1 });
  offsets[0] = 0;
  rows.forEach((row, index) => {
    const measuredHeight = cache[row.id];
    const height = measuredHeight ?? row.estimatedHeight;
    offsets[index + 1] = (offsets[index] ?? 0) + height;
  });
  return offsets;
}

/**
 * Resolves the latest offset of a semantic target after estimates or measurements change.
 *
 * @param rows - Current materialized semantic rows.
 * @param offsets - Prefix offsets calculated for the same rows.
 * @param rowId - Target row identity.
 * @returns Target scroll offset, or null when the row is not materialized.
 */
export function getSemanticTargetOffset(
  rows: readonly MixedHeightRow[],
  offsets: readonly number[],
  rowId: string,
): number | null {
  const index = rows.findIndex((row) => row.id === rowId);
  if (index < 0) {
    return null;
  }
  return offsets[index] ?? null;
}
