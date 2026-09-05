import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { DiffViewer } from "@/features/diff/components/DiffViewer";
import { createDiffViewerFixture } from "@/features/diff/components/DiffViewer/testFixtures";
import type { DiffLineCommentsController } from "@/features/diffComments/components/DiffLineCommentSlot";

const containers: HTMLElement[] = [];

afterEach(() => {
  containers.splice(0).forEach((container) => {
    container.remove();
  });
});

test("Unifiedはremovedをbase addedをcurrent contextを両sideのtargetにする", () => {
  const view = renderViewer("unified");

  expect(
    findButton(view, "implementation-plan.md base 2行目にコメントを追加"),
  ).not.toBeNull();
  expect(
    findButton(view, "implementation-plan.md current 2行目にコメントを追加"),
  ).not.toBeNull();
  expect(
    findButton(view, "implementation-plan.md base 1行目にコメントを追加"),
  ).not.toBeNull();
  expect(
    findButton(view, "implementation-plan.md current 1行目にコメントを追加"),
  ).not.toBeNull();
});

test("Splitはspacerを除外して左右の実在行だけtargetにする", () => {
  const view = renderViewer("split");

  expect(
    findButton(view, "implementation-plan.md base 2行目にコメントを追加"),
  ).not.toBeNull();
  expect(
    findButton(view, "implementation-plan.md current 2行目にコメントを追加"),
  ).not.toBeNull();
  expect(
    view.querySelectorAll(".diff-line-comment-control").length,
  ).toBeGreaterThan(0);
  expect(
    view.querySelector(".diff-viewer__cell--spacer .diff-line-comment-control"),
  ).toBeNull();
});

test("occupied targetはindicatorと同一行への追加controlを両方表示する", () => {
  const controller = createController({
    commentsByTarget: {
      "current:implementation-plan.md:2": [
        { id: "comment", createdAt: "2026-08-11T00:00:00Z", label: "Open" },
      ],
    },
  });
  const view = renderViewer("unified", controller);

  expect(
    findButton(view, "implementation-plan.md current 2行目のコメント1件を表示"),
  ).not.toBeNull();
  expect(
    findButton(view, "implementation-plan.md current 2行目にコメントを追加"),
  ).not.toBeNull();
  expect(
    view.querySelector(".diff-inline-comment-thread")?.textContent,
  ).toContain("Open");
  expect(
    view
      .querySelector(".diff-inline-comment-thread")
      ?.parentElement?.classList.contains("diff-viewer__cell"),
  ).toBe(true);
});

function renderViewer(
  mode: "unified" | "split",
  controller = createController(),
): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  containers.push(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <DiffViewer
        fileDiff={createDiffViewerFixture()}
        mode={mode}
        activeChangeId={null}
        onActiveChangeIdChange={() => undefined}
        lineComments={controller}
      />,
    );
  });
  return container;
}

function createController(
  overrides: Partial<DiffLineCommentsController> = {},
): DiffLineCommentsController {
  return {
    commentsByTarget: {},
    activeCommentId: null,
    draft: null,
    onStartDraft: vi.fn(),
    onDraftBodyChange: vi.fn(),
    onCancelDraft: vi.fn(),
    onSubmitDraft: vi.fn(),
    onSelectComment: vi.fn(),
    ...overrides,
  };
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.getAttribute("aria-label") === label,
  );
  if (button === undefined) {
    throw new Error(`button not found: ${label}`);
  }
  return button;
}
