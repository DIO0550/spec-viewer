import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { DiffViewer } from "@/features/diff/components/DiffViewer";
import {
  createDiffViewerFixture,
  createLargeDiffViewerFixture,
} from "@/features/diff/components/DiffViewer/testFixtures";
import type { DiffProjectionViewMode } from "@/features/diff/domain/fileDiff";
import type {
  DiffLineCommentDraft,
  DiffLineCommentsController,
} from "@/features/diffComments/components/DiffLineCommentSlot";
import type { DiffLineCommentTarget } from "@/features/diffComments/components/DiffLineCommentControl";

const RowHeight = 20;
const ComposerRowHeight = 120;
const mountedRoots: Root[] = [];
const mountedContainers: HTMLDivElement[] = [];

afterEach(() => {
  mountedRoots.splice(0).forEach((root) => {
    act(() => root.unmount());
  });
  mountedContainers.splice(0).forEach((container) => container.remove());
  vi.restoreAllMocks();
});

test.each([
  ["unified", "before", "current:implementation-plan.md:1", 100],
  ["unified", "self", "current:implementation-plan.md:3", 0],
  ["unified", "after", "current:implementation-plan.md:4", 0],
  ["split", "before", "current:implementation-plan.md:1", 100],
  ["split", "self", "current:implementation-plan.md:3", 0],
  ["split", "after", "current:implementation-plan.md:4", 0],
] satisfies readonly [
  DiffProjectionViewMode,
  string,
  string,
  number,
][])("%sでsemantic targetの%sにcomposerをopen-closeしてもviewport offsetを維持する", (mode, _position, draftKey, expectedOpenDelta) => {
  const animationFrames = installMeasuredLayout();
  const view = renderViewer(mode, createController());
  flushAnimationFrames(animationFrames);
  const surface = getScrollSurface(view.container);
  const anchorRow = getTargetRow(
    view.container,
    "current:implementation-plan.md:3",
  );
  const rows = [...view.container.querySelectorAll(".diff-viewer__row")];
  const anchorIndex = rows.indexOf(anchorRow);
  const initialScrollTop = anchorIndex * RowHeight + 5;
  surface.scrollTop = initialScrollTop;

  view.render(mode, createController(createTarget(draftKey)));
  flushAnimationFrames(animationFrames);
  expect(surface.scrollTop).toBe(initialScrollTop + expectedOpenDelta);

  view.render(mode, createController());
  flushAnimationFrames(animationFrames);
  expect(surface.scrollTop).toBe(initialScrollTop);
});

test("modeとrevision切替はmeasurement cacheとscroll anchorをresetする", () => {
  const animationFrames = installMeasuredLayout();
  const view = renderViewer("unified", createController());
  flushAnimationFrames(animationFrames);
  const surface = getScrollSurface(view.container);
  const anchorRow = getTargetRow(
    view.container,
    "current:implementation-plan.md:3",
  );
  const rows = [...view.container.querySelectorAll(".diff-viewer__row")];
  surface.scrollTop = rows.indexOf(anchorRow) * RowHeight + 5;

  view.render(
    "unified",
    createController(createTarget("current:implementation-plan.md:1")),
  );
  flushAnimationFrames(animationFrames);
  expect(surface.scrollTop).toBeGreaterThan(100);

  view.render("split", createController());
  flushAnimationFrames(animationFrames);
  expect(surface.scrollTop).toBe(0);

  surface.scrollTop = 75;
  view.render(
    "split",
    createController(),
    createDiffViewerFixture({ fileKey: "next-revision" }),
  );
  flushAnimationFrames(animationFrames);
  expect(surface.scrollTop).toBe(0);
});

test("20,000行でもDOM capを守りvisible row測定を1 frameへbatchする", () => {
  const animationFrames = installMeasuredLayout();
  const view = renderViewer(
    "unified",
    createController(),
    createLargeDiffViewerFixture(),
  );

  expect(
    view.container.querySelectorAll(".diff-viewer__row").length,
  ).toBeLessThanOrEqual(500);
  expect(animationFrames).toHaveLength(1);
});

function renderViewer(
  mode: DiffProjectionViewMode,
  controller: DiffLineCommentsController,
  initialFileDiff = createDiffViewerFixture(),
): Readonly<{
  container: HTMLDivElement;
  render: (
    nextMode: DiffProjectionViewMode,
    nextController: DiffLineCommentsController,
    nextFileDiff?: ReturnType<typeof createDiffViewerFixture>,
  ) => void;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  mountedContainers.push(container);
  const root = createRoot(container);
  mountedRoots.push(root);
  const render = (
    nextMode: DiffProjectionViewMode,
    nextController: DiffLineCommentsController,
    nextFileDiff = initialFileDiff,
  ): void => {
    act(() => {
      root.render(
        <DiffViewer
          fileDiff={nextFileDiff}
          mode={nextMode}
          activeChangeId={null}
          onActiveChangeIdChange={() => undefined}
          lineComments={nextController}
        />,
      );
    });
  };
  render(mode, controller);
  return { container, render };
}

function createController(
  target?: DiffLineCommentTarget,
): DiffLineCommentsController {
  const draft: DiffLineCommentDraft | null =
    target === undefined
      ? null
      : {
          target,
          body: "kept draft",
          isSaving: false,
          origin: null,
        };
  return {
    commentsByTarget: {},
    activeCommentId: null,
    draft,
    onStartDraft: vi.fn(),
    onDraftBodyChange: vi.fn(),
    onCancelDraft: vi.fn(),
    onSubmitDraft: vi.fn(),
    onSelectComment: vi.fn(),
  };
}

function createTarget(key: string): DiffLineCommentTarget {
  const [, sidePath, line] = key.split(":");
  if (sidePath === undefined || line === undefined) {
    throw new Error(`Invalid test target: ${key}`);
  }
  return { key, side: "current", sidePath, line: Number(line) };
}

function installMeasuredLayout(): FrameRequestCallback[] {
  const animationFrames: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    animationFrames.push(callback);
    return animationFrames.length;
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function getBoundingClientRect(this: HTMLElement): DOMRect {
      const height = this.querySelector(".diff-comment-composer")
        ? ComposerRowHeight
        : RowHeight;
      return createRect(height);
    },
  );
  return animationFrames;
}

function flushAnimationFrames(animationFrames: FrameRequestCallback[]): void {
  let remainingPasses = 10;
  while (animationFrames.length > 0 && remainingPasses > 0) {
    const callbacks = animationFrames.splice(0);
    act(() => callbacks.forEach((callback) => callback(0)));
    remainingPasses -= 1;
  }
  expect(remainingPasses).toBeGreaterThan(0);
}

function getScrollSurface(container: HTMLElement): HTMLDivElement {
  const surface = container.querySelector<HTMLDivElement>(
    ".diff-viewer__scroll-surface",
  );
  if (surface === null) {
    throw new Error("Expected DiffViewer scroll surface");
  }
  return surface;
}

function getTargetRow(container: HTMLElement, key: string): Element {
  const control = container.querySelector(`[data-comment-target-key="${key}"]`);
  const row = control?.closest(".diff-viewer__row");
  if (row === null || row === undefined) {
    throw new Error(`Expected semantic target row: ${key}`);
  }
  return row;
}

function createRect(height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    width: 100,
    height,
    top: 0,
    right: 100,
    bottom: height,
    left: 0,
    toJSON: () => ({}),
  };
}
