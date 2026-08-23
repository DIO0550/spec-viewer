import { expect, test } from "vitest";

import type { DiffViewRow } from "@/features/diff/lib/diffViewModel";
import {
  calculateRowOffsets,
  calculateVisibleWindow,
} from "@/features/diff/lib/diffViewModel";

test("20,000行でもvisible windowを500 semantic rows以下に制限する", () => {
  const rows = createContentRows(20_000);
  const offsets = calculateRowOffsets(rows);

  const visibleWindow = calculateVisibleWindow({
    offsets,
    scrollTop: 160_000,
    viewportHeight: 800,
    overscanRows: 100,
    hardCap: 500,
  });

  expect(visibleWindow.endIndex - visibleWindow.startIndex).toBeLessThanOrEqual(
    500,
  );
  expect(visibleWindow.startIndex).toBeGreaterThan(0);
  expect(visibleWindow.topSpacerHeight).toBe(offsets[visibleWindow.startIndex]);
  expect(visibleWindow.bottomSpacerHeight).toBe(
    offsets[offsets.length - 1] - offsets[visibleWindow.endIndex],
  );
});

test("viewportHeightが0なら800px fallbackでwindowを計算する", () => {
  const rows = createContentRows(1_000);
  const offsets = calculateRowOffsets(rows);

  const visibleWindow = calculateVisibleWindow({
    offsets,
    scrollTop: 0,
    viewportHeight: 0,
    overscanRows: 100,
    hardCap: 500,
  });

  expect(visibleWindow.startIndex).toBe(0);
  expect(visibleWindow.endIndex).toBe(137);
});

function createContentRows(count: number): readonly DiffViewRow[] {
  return Array.from({ length: count }, (_, index) => ({
    kind: "content" as const,
    id: `line-${index}`,
    changeId: null,
    inline: null,
    old: null,
    next: null,
    estimatedHeight: 22 as const,
  }));
}
