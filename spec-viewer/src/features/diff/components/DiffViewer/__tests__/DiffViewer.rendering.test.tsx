import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test } from "vitest";

import { DiffViewer } from "@/features/diff/components/DiffViewer";
import {
  createDiffViewerFixture,
  createLargeDiffViewerFixture,
} from "@/features/diff/components/DiffViewer/testFixtures";
import type { OmissionReason } from "@/features/diff/domain/fileDiff";

const mountedContainers: HTMLDivElement[] = [];

afterEach(() => {
  mountedContainers.splice(0).forEach((container) => container.remove());
});

test("ready diffはpath・change navigation・行番号・markerを描画する", () => {
  const result = renderViewer(createDiffViewerFixture());

  expect(
    result.container.querySelector(
      '[aria-label="implementation-plan.md の差分"]',
    ),
  ).not.toBeNull();
  expect(
    result.container.querySelector('[aria-label="変更箇所ナビゲーション"]'),
  ).not.toBeNull();
  expect(result.container.querySelector('[role="radiogroup"]')).toBeNull();
  expect(result.container.textContent).toContain("-");
  expect(result.container.textContent).toContain("+");
  const scrollSurface = result.container.querySelector(
    ".diff-viewer__scroll-surface",
  );
  const endSpacer = result.container.querySelector(".diff-viewer__end-spacer");
  expect(scrollSurface).not.toBeNull();
  expect(endSpacer?.parentElement).toBe(scrollSurface);
  expect(scrollSurface?.lastElementChild).toBe(endSpacer);
  expect(
    result.container.querySelector(".diff-viewer__comment-lane"),
  ).toBeNull();
  result.unmount();
});

test("availableでhunkが空なら明確な空状態と非活性controlsを表示する", () => {
  const result = renderViewer(createDiffViewerFixture({ lines: [] }));

  expect(result.container.textContent).toContain(
    "表示できる行変更はありません",
  );
  expect(result.container.querySelector('[role="radiogroup"]')).toBeNull();
  result.unmount();
});

test.each([
  ["binary", "バイナリ"],
  ["largeFile", "大きすぎる"],
  ["diffLimit", "上限"],
  ["missingSide", "片側"],
  ["unsupportedEntryKind", "未対応"],
] satisfies readonly [
  OmissionReason,
  string,
][])("%s omitted reasonは%sを含む状態を表示する", (omissionReason, expectedText) => {
  const result = renderViewer(createDiffViewerFixture({ omissionReason }));

  expect(result.container.textContent).toContain(expectedText);
  expect(result.container.querySelector('[role="radiogroup"]')).toBeNull();
  result.unmount();
});

test("[R199-PERF-002] 20,000行入力でも初期semantic rowを500以下にwindowingする", () => {
  const result = renderViewer(createLargeDiffViewerFixture());

  expect(
    result.container.querySelectorAll(".diff-viewer__row").length,
  ).toBeLessThanOrEqual(500);
  result.unmount();
});

function renderViewer(fileDiff: ReturnType<typeof createDiffViewerFixture>) {
  const container = document.createElement("div");
  document.body.append(container);
  mountedContainers.push(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <DiffViewer
        fileDiff={fileDiff}
        mode="unified"
        activeChangeId={null}
        onActiveChangeIdChange={() => {}}
      />,
    );
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
    },
  };
}
