import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { CurrentFileViewer } from "@/features/diff/components/CurrentFileViewer";
import { createDiffViewerFixture } from "@/features/diff/components/DiffViewer/testFixtures";

test("replacementをmodified gutterで示しprevious peekを展開する", () => {
  const fileDiff = createReplacementFixture();
  const view = renderViewer(fileDiff, "hunk-0-change-0");

  const modified = view.container.querySelector(
    '[data-change-kind="modified"]',
  );
  const button = view.container.querySelector<HTMLButtonElement>(
    '[aria-expanded="false"]',
  );
  expect(modified?.getAttribute("data-commentable")).toBe("true");
  expect(modified?.textContent).toContain("2new");
  expect(button?.textContent).toContain("変更前 1行");
  act(() => button?.click());
  expect(view.container.textContent).toContain("変更前 2 old");
  expect(
    view.container
      .querySelector('[data-row-kind="peek-line"]')
      ?.getAttribute("data-commentable"),
  ).toBe("false");
  view.unmount();
});

test("deleted fileはwhole-file peekだけを非comment対象で表示する", () => {
  const fileDiff = createDiffViewerFixture({
    status: "deleted",
    oldContent: "first\nsecond",
    hunks: [
      {
        header: "@@ -1,2 +0,0 @@",
        lines: [
          {
            kind: "removed",
            text: "first",
            oldLineNumber: 1,
            newLineNumber: null,
          },
          {
            kind: "removed",
            text: "second",
            oldLineNumber: 2,
            newLineNumber: null,
          },
        ],
      },
    ],
  });
  const view = renderViewer(fileDiff, null);

  expect(view.container.textContent).toContain("2行削除");
  expect(view.container.querySelector('[data-commentable="true"]')).toBeNull();
  view.unmount();
});

test("削除のみのactive changeはtargetのpeek summaryを強調する", () => {
  const fileDiff = createDiffViewerFixture({
    oldContent: "before\ndeleted\nafter",
    newContent: "before\nafter",
    hunks: [
      {
        header: "@@ -1,3 +1,2 @@",
        lines: [
          {
            kind: "context",
            text: "before",
            oldLineNumber: 1,
            newLineNumber: 1,
          },
          {
            kind: "removed",
            text: "deleted",
            oldLineNumber: 2,
            newLineNumber: null,
          },
          {
            kind: "context",
            text: "after",
            oldLineNumber: 3,
            newLineNumber: 2,
          },
        ],
      },
    ],
  });
  const view = renderViewer(fileDiff, "hunk-0-change-0");
  const activeRow = view.container.querySelector<HTMLElement>(
    '[data-active-change="true"]',
  );

  expect(activeRow?.dataset.rowKind).toBe("peek-summary");
  expect(activeRow?.textContent).toContain("1行削除");
  view.unmount();
});

test("structured diff omittedはdegraded警告とcurrent全文を同時表示する", () => {
  const base = createDiffViewerFixture({ newContent: "current" });
  const fileDiff = {
    ...base,
    review: {
      ...base.review,
      structuredDiff: {
        state: "omitted" as const,
        hunks: [] as const,
        reason: "diffLimit" as const,
      },
    },
    availability: { kind: "omitted" as const, reason: "diffLimit" as const },
  };
  const view = renderViewer(fileDiff, null);

  expect(view.container.textContent).toContain("変更表示を利用できません");
  expect(view.container.textContent).toContain("1current");
  expect(
    view.container.querySelector('[data-change-kind="unchanged"]'),
  ).not.toBeNull();
  view.unmount();
});

test("不整合hunkは理由と安全なcurrent全文fallbackだけを表示する", () => {
  const fileDiff = createReplacementFixture("different");
  const view = renderViewer(fileDiff, null);

  expect(view.container.textContent).toContain("変更情報に不整合があります");
  expect(view.container.textContent).toContain("2new");
  expect(
    view.container.querySelector(".current-file-viewer__navigation"),
  ).toBeNull();
  view.unmount();
});

test("次の変更はcontrolled cross-view IDを通知する", () => {
  const onChange = vi.fn();
  const fileDiff = createDiffViewerFixture({
    oldContent: "before\nold-a\nmiddle\nold-b",
    newContent: "before\nnew-a\nmiddle\nnew-b",
    hunks: [
      {
        header: "@@ -1,4 +1,4 @@",
        lines: [
          {
            kind: "context",
            text: "before",
            oldLineNumber: 1,
            newLineNumber: 1,
          },
          {
            kind: "removed",
            text: "old-a",
            oldLineNumber: 2,
            newLineNumber: null,
          },
          {
            kind: "added",
            text: "new-a",
            oldLineNumber: null,
            newLineNumber: 2,
          },
          {
            kind: "context",
            text: "middle",
            oldLineNumber: 3,
            newLineNumber: 3,
          },
          {
            kind: "removed",
            text: "old-b",
            oldLineNumber: 4,
            newLineNumber: null,
          },
          {
            kind: "added",
            text: "new-b",
            oldLineNumber: null,
            newLineNumber: 4,
          },
        ],
      },
    ],
  });
  const view = renderViewer(
    fileDiff,
    "hunk-0-change-0",
    "revision-1",
    onChange,
  );

  act(() =>
    view.container
      .querySelector<HTMLButtonElement>('[aria-label="次の変更"]')
      ?.click(),
  );
  expect(onChange).toHaveBeenCalledWith("hunk-0-change-1");
  view.unmount();
});

test("revisionKey変更時だけ展開済みpeekをresetする", () => {
  const fileDiff = createReplacementFixture();
  const view = renderViewer(fileDiff, null);
  act(() =>
    view.container
      .querySelector<HTMLButtonElement>('[aria-expanded="false"]')
      ?.click(),
  );
  expect(view.container.querySelector('[aria-expanded="true"]')).not.toBeNull();

  view.rerender(fileDiff, "revision-1");
  expect(view.container.querySelector('[aria-expanded="true"]')).not.toBeNull();
  const scrollSurface = view.container.querySelector<HTMLDivElement>(
    ".current-file-viewer__scroll-surface",
  );
  expect(scrollSurface).not.toBeNull();
  scrollSurface!.scrollTop = 125;
  view.rerender(fileDiff, "revision-2");
  expect(
    view.container.querySelector('[aria-expanded="false"]'),
  ).not.toBeNull();
  expect(scrollSurface?.scrollTop).toBe(0);
  view.unmount();
});

test("20,000行でもARIA総数を保ちDOM rowを500以下に制限する", () => {
  const content = Array.from(
    { length: 20_000 },
    (_, index) => `line-${index + 1}`,
  ).join("\n");
  const view = renderViewer(
    createDiffViewerFixture({ newContent: content, lines: [] }),
    null,
  );
  const grid = view.container.querySelector('[role="grid"]');
  const rows = view.container.querySelectorAll('[role="row"]');

  expect(grid?.getAttribute("aria-rowcount")).toBe("20000");
  expect(rows.length).toBeLessThanOrEqual(500);
  expect(rows[0]?.getAttribute("aria-rowindex")).toBe("1");
  view.unmount();
});

test("長大な1行をwrapせず1 semantic rowとして表示する", () => {
  const view = renderViewer(
    createDiffViewerFixture({ newContent: "x".repeat(20_000), lines: [] }),
    null,
  );

  expect(
    view.container
      .querySelector("code")
      ?.classList.contains("current-file-viewer__code"),
  ).toBe(true);
  expect(view.container.querySelectorAll('[role="row"]')).toHaveLength(1);
  view.unmount();
});

test("展開済みpeek controlは実際のpeek rowだけを参照する", () => {
  const view = renderViewer(createReplacementFixture(), null);
  const button = view.container.querySelector<HTMLButtonElement>(
    '[aria-expanded="false"]',
  );

  expect(button?.hasAttribute("aria-controls")).toBe(false);
  act(() => button?.click());
  const controlledIds = button?.getAttribute("aria-controls")?.split(" ") ?? [];
  const controlledRows = controlledIds.map((id) =>
    view.container.querySelector<HTMLElement>(`#${id}`),
  );

  expect(controlledIds.length).toBeGreaterThan(0);
  expect(
    controlledRows.every((row) => row?.dataset.rowKind === "peek-line"),
  ).toBe(true);
  expect(
    controlledRows.every(
      (row) => row?.dataset.peekId === "hunk-0-change-0-peek",
    ),
  ).toBe(true);
  expect(view.container.querySelector('[aria-hidden="true"][id]')).toBeNull();
  const rows = view.container.querySelectorAll<HTMLElement>('[role="row"]');
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(row.querySelector(':scope > [role="gridcell"]')).not.toBeNull();
  }

  view.unmount();
});

test("20,000行far targetの前100行が22pxから20pxへ実測されてもviewport位置を保つ", () => {
  const animationFrames = installAnimationFrameHarness();
  const getRect = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function getMeasuredRowRect(this: HTMLElement) {
      const rowIndex = Number(this.getAttribute("aria-rowindex"));
      const height = rowIndex < 14_900 ? 22 : 20;
      return { height } as DOMRect;
    });
  const view = renderViewer(createFarTargetFixture(), "hunk-0-change-0");
  const scrollSurface = view.container.querySelector<HTMLDivElement>(
    ".current-file-viewer__scroll-surface",
  );
  const target = view.container.querySelector<HTMLElement>(
    '[data-active-change="true"]',
  );
  const targetRowIndex = Number(target?.getAttribute("aria-rowindex"));
  const measuredRowsBeforeTarget = Array.from(
    view.container.querySelectorAll<HTMLElement>('[role="row"]'),
  ).filter(
    (row) => Number(row.getAttribute("aria-rowindex")) < targetRowIndex,
  ).length;
  const estimatedScrollTop = scrollSurface?.scrollTop ?? 0;

  act(() => {
    animationFrames.flush();
  });

  expect(measuredRowsBeforeTarget).toBe(100);
  expect(scrollSurface?.scrollTop).toBe(
    estimatedScrollTop - measuredRowsBeforeTarget * 2,
  );
  view.unmount();
  getRect.mockRestore();
  animationFrames.restore();
});

test("active changeより前のpeek開閉はtargetのviewport位置を保つ", () => {
  const view = renderViewer(createTwoReplacementFixture(), "hunk-0-change-1");
  const scrollSurface = view.container.querySelector<HTMLDivElement>(
    ".current-file-viewer__scroll-surface",
  );
  const firstPeek = view.container.querySelector<HTMLButtonElement>(
    '[aria-expanded="false"]',
  );
  const initialScrollTop = scrollSurface?.scrollTop ?? 0;

  act(() => firstPeek?.click());
  expect(scrollSurface?.scrollTop).toBe(initialScrollTop + 22);
  act(() => firstPeek?.click());
  expect(scrollSurface?.scrollTop).toBe(initialScrollTop);
  view.unmount();
});

test("active change自身のprevious peek開閉はsame semantic targetのviewport位置を保つ", () => {
  const view = renderViewer(createReplacementFixture(), "hunk-0-change-0");
  const scrollSurface = view.container.querySelector<HTMLDivElement>(
    ".current-file-viewer__scroll-surface",
  );
  const previousPeek = view.container.querySelector<HTMLButtonElement>(
    '[aria-expanded="false"]',
  );
  const initialScrollTop = scrollSurface?.scrollTop ?? 0;

  act(() => previousPeek?.click());
  expect(scrollSurface?.scrollTop).toBe(initialScrollTop + 22);
  act(() => previousPeek?.click());
  expect(scrollSurface?.scrollTop).toBe(initialScrollTop);
  view.unmount();
});

test("1MiB行はaria-labelへ全文複製せずcodeを一度だけ公開する", () => {
  const longLine = "x".repeat(1024 * 1024);
  const view = renderViewer(
    createDiffViewerFixture({ newContent: longLine, lines: [] }),
    null,
  );
  const row = view.container.querySelector<HTMLElement>(
    '[data-row-kind="current-line"]',
  );
  const code = view.container.querySelector<HTMLElement>(
    ".current-file-viewer__code",
  );

  expect(row?.hasAttribute("aria-label")).toBe(false);
  expect(code?.textContent).toBe(longLine);
  expect(view.container.querySelectorAll('[role="row"]')).toHaveLength(1);
  view.unmount();
});

test("manual scroll後のsame-change previous peek開閉はtarget viewport位置だけを補正する", () => {
  const view = renderViewer(createReplacementFixture(), "hunk-0-change-0");
  const scrollSurface = view.container.querySelector<HTMLDivElement>(
    ".current-file-viewer__scroll-surface",
  );
  const button = view.container.querySelector<HTMLButtonElement>(
    '[aria-expanded="false"]',
  );

  expect(scrollSurface).not.toBeNull();
  scrollSurface!.scrollTop = 240;
  act(() => button?.click());
  expect(scrollSurface?.scrollTop).toBe(262);
  act(() => button?.click());
  expect(scrollSurface?.scrollTop).toBe(240);
  view.unmount();
});

test("初回mountのrow測定RAFはrevision resetでcancelされずtarget offsetを実測補正する", () => {
  const animationFrames = installAnimationFrameHarness();
  const getRect = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue({ height: 20 } as DOMRect);
  const view = renderViewer(createReplacementFixture(), "hunk-0-change-0");
  const scrollSurface = view.container.querySelector<HTMLDivElement>(
    ".current-file-viewer__scroll-surface",
  );
  const estimatedScrollTop = scrollSurface?.scrollTop ?? 0;

  expect(animationFrames.cancelledFrameCount()).toBe(0);
  act(() => {
    animationFrames.flush();
  });

  expect(scrollSurface?.scrollTop).toBe(estimatedScrollTop - 14);
  view.unmount();
  getRect.mockRestore();
  animationFrames.restore();
});

test("revisionKey変更後は同じrow IDを再測定し新しい高さでtarget offsetを補正する", () => {
  const animationFrames = installAnimationFrameHarness();
  let measuredHeight = 20;
  const getRect = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(() => ({ height: measuredHeight }) as DOMRect);
  const fileDiff = createTwoReplacementFixture();
  const view = renderViewer(fileDiff, "hunk-0-change-0");
  const scrollSurface = view.container.querySelector<HTMLDivElement>(
    ".current-file-viewer__scroll-surface",
  );

  act(() => {
    animationFrames.flush();
  });
  const initialMeasurementCount = getRect.mock.calls.length;

  measuredHeight = 18;
  view.rerender(fileDiff, "revision-2", "hunk-0-change-0");

  expect(getRect.mock.calls.length).toBeGreaterThan(initialMeasurementCount);
  expect(animationFrames.cancelledFrameCount()).toBe(0);

  view.rerender(fileDiff, "revision-2", "hunk-0-change-1");
  expect(scrollSurface?.scrollTop).toBe(130);

  act(() => {
    animationFrames.flush();
  });

  expect(scrollSurface?.scrollTop).toBe(90);
  view.unmount();
  getRect.mockRestore();
  animationFrames.restore();
});

test("同一propsのparent rerenderでvisible rowを再測定しない", () => {
  const getRect = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue({ height: 20 } as DOMRect);
  const fileDiff = createReplacementFixture();
  const view = renderViewer(fileDiff, null);
  const initialMeasurementCount = getRect.mock.calls.length;

  view.rerender(fileDiff, "revision-1");
  expect(getRect).toHaveBeenCalledTimes(initialMeasurementCount);
  view.unmount();
  getRect.mockRestore();
});

function createReplacementFixture(oldContent = "before\nold\nafter") {
  return createDiffViewerFixture({
    oldContent,
    newContent: "before\nnew\nafter",
    hunks: [
      {
        header: "@@ -1,3 +1,3 @@",
        lines: [
          {
            kind: "context",
            text: "before",
            oldLineNumber: 1,
            newLineNumber: 1,
          },
          {
            kind: "removed",
            text: "old",
            oldLineNumber: 2,
            newLineNumber: null,
          },
          { kind: "added", text: "new", oldLineNumber: null, newLineNumber: 2 },
          {
            kind: "context",
            text: "after",
            oldLineNumber: 3,
            newLineNumber: 3,
          },
        ],
      },
    ],
  });
}

function createTwoReplacementFixture() {
  return createDiffViewerFixture({
    oldContent: "before\nold-a\nmiddle\nold-b",
    newContent: "before\nnew-a\nmiddle\nnew-b",
    hunks: [
      {
        header: "@@ -1,4 +1,4 @@",
        lines: [
          {
            kind: "context",
            text: "before",
            oldLineNumber: 1,
            newLineNumber: 1,
          },
          {
            kind: "removed",
            text: "old-a",
            oldLineNumber: 2,
            newLineNumber: null,
          },
          {
            kind: "added",
            text: "new-a",
            oldLineNumber: null,
            newLineNumber: 2,
          },
          {
            kind: "context",
            text: "middle",
            oldLineNumber: 3,
            newLineNumber: 3,
          },
          {
            kind: "removed",
            text: "old-b",
            oldLineNumber: 4,
            newLineNumber: null,
          },
          {
            kind: "added",
            text: "new-b",
            oldLineNumber: null,
            newLineNumber: 4,
          },
        ],
      },
    ],
  });
}

function createFarTargetFixture() {
  const oldLines = Array.from(
    { length: 19_999 },
    (_, index) => `line-${index + 1}`,
  );
  const newLines = [
    ...oldLines.slice(0, 14_999),
    "new-target",
    ...oldLines.slice(14_999),
  ];
  return createDiffViewerFixture({
    oldContent: oldLines.join("\n"),
    newContent: newLines.join("\n"),
    hunks: [
      {
        header: "@@ -14999,0 +15000 @@",
        lines: [
          {
            kind: "added",
            text: "new-target",
            oldLineNumber: null,
            newLineNumber: 15_000,
          },
        ],
      },
    ],
  });
}

function renderViewer(
  fileDiff: ReturnType<typeof createDiffViewerFixture>,
  activeChangeId: string | null,
  initialRevisionKey = "revision-1",
  onActiveChangeIdChange = vi.fn(),
) {
  const container = document.createElement("div");
  const root = createRoot(container);
  const render = (
    nextFileDiff = fileDiff,
    revisionKey = initialRevisionKey,
    nextActiveChangeId = activeChangeId,
  ) => {
    act(() =>
      root.render(
        <CurrentFileViewer
          fileDiff={nextFileDiff}
          revisionKey={revisionKey}
          activeChangeId={nextActiveChangeId}
          onActiveChangeIdChange={onActiveChangeIdChange}
        />,
      ),
    );
  };
  render();
  return {
    container,
    rerender: render,
    unmount: () => act(() => root.unmount()),
  };
}

type AnimationFrameHarness = Readonly<{
  cancelledFrameCount: () => number;
  flush: () => void;
  restore: () => void;
}>;

function installAnimationFrameHarness(): AnimationFrameHarness {
  const callbacks = new Map<number, FrameRequestCallback>();
  let cancelledFrameCount = 0;
  let nextFrameId = 1;
  const requestFrame = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      callbacks.set(frameId, callback);
      return frameId;
    });
  const cancelFrame = vi
    .spyOn(window, "cancelAnimationFrame")
    .mockImplementation((frameId) => {
      cancelledFrameCount += 1;
      callbacks.delete(frameId);
    });

  return {
    cancelledFrameCount: () => cancelledFrameCount,
    flush: () => {
      const scheduledCallbacks = [...callbacks.values()];
      callbacks.clear();
      for (const callback of scheduledCallbacks) {
        callback(0);
      }
    },
    restore: () => {
      cancelFrame.mockRestore();
      requestFrame.mockRestore();
    },
  };
}
