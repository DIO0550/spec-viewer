import { expect, test } from "vitest";

import {
  calculateMixedHeightOffsets,
  createMeasurementCache,
  getSemanticTargetOffset,
  mergeMeasuredHeights,
  updateMeasuredHeight,
} from "@/features/diff/lib/editorWindowing";
import { calculateVisibleWindow } from "@/features/diff/lib/diffViewModel";

const Rows = [
  { id: "line-1", estimatedHeight: 22 },
  { id: "peek-summary", estimatedHeight: 32 },
  { id: "old-line-1", estimatedHeight: 22 },
] as const;

test("異種rowのestimated heightから累積offsetを作る", () => {
  expect(calculateMixedHeightOffsets(Rows, createMeasurementCache())).toEqual([
    0, 22, 54, 76,
  ]);
});

test("実測heightを不変更新して後続semantic targetを補正する", () => {
  const initial = createMeasurementCache();
  const measured = updateMeasuredHeight(initial, "peek-summary", 48);
  const offsets = calculateMixedHeightOffsets(Rows, measured);

  expect(initial).toEqual({});
  expect(measured).toEqual({ "peek-summary": 48 });
  expect(getSemanticTargetOffset(Rows, offsets, "old-line-1")).toBe(70);
});

test("visible rowsの実測値を1回のimmutable cache更新へbatchする", () => {
  const initial = { existing: 18 };
  const measured = mergeMeasuredHeights(initial, {
    "line-1": 20,
    "line-2": 24,
    invalid: 0,
  });

  expect(measured).toEqual({ existing: 18, "line-1": 20, "line-2": 24 });
  expect(mergeMeasuredHeights(measured, { "line-1": 20 })).toBe(measured);
});

test("20,000 mixed-height rowsでもvisible windowを500 rows以下に制限する", () => {
  const rows = Array.from({ length: 20_000 }, (_, index) => ({
    id: `row-${index}`,
    estimatedHeight: index % 10 === 0 ? 32 : 22,
  }));
  const offsets = calculateMixedHeightOffsets(rows, createMeasurementCache());
  const visible = calculateVisibleWindow({
    offsets,
    scrollTop: 200_000,
    viewportHeight: 800,
    overscanRows: 100,
    hardCap: 500,
  });

  expect(visible.endIndex - visible.startIndex).toBeLessThanOrEqual(500);
  expect(visible.startIndex).toBeGreaterThan(0);
});

test("存在しないsemantic targetはnullを返す", () => {
  const offsets = calculateMixedHeightOffsets(Rows, createMeasurementCache());
  expect(getSemanticTargetOffset(Rows, offsets, "missing")).toBeNull();
});
