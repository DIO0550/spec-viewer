import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { CurrentFileViewer } from "@/features/diff/components/CurrentFileViewer";
import { DiffViewer } from "@/features/diff/components/DiffViewer";
import { createDiffViewerFixture } from "@/features/diff/components/DiffViewer/testFixtures";
import type { DiffLineCommentsController } from "@/features/diffComments/components/DiffLineCommentSlot";

const containers: HTMLElement[] = [];

afterEach(() => {
  containers.splice(0).forEach((container) => container.remove());
  vi.restoreAllMocks();
});

test("Diff Review jumpはUnifiedのresolved line controlをfocusする", () => {
  installImmediateAnimationFrame();
  const container = createContainer();
  const root = createRoot(container);
  act(() => {
    root.render(
      <DiffViewer
        fileDiff={createDiffViewerFixture()}
        mode="unified"
        activeChangeId={null}
        onActiveChangeIdChange={() => undefined}
        lineComments={createController()}
        commentJumpTarget={{
          key: "current:implementation-plan.md:2",
          side: "current",
          sidePath: "implementation-plan.md",
          line: 2,
          requestId: 1,
        }}
      />,
    );
  });

  expect(document.activeElement?.getAttribute("aria-label")).toBe(
    "implementation-plan.md current 2行目にコメントを追加",
  );
});

test("Diff Review jumpはEditorのunchanged current line controlをfocusする", () => {
  installImmediateAnimationFrame();
  const container = createContainer();
  const root = createRoot(container);
  act(() => {
    root.render(
      <CurrentFileViewer
        fileDiff={createDiffViewerFixture({ newContent: "first\nsecond" })}
        lineComments={createController()}
        commentJumpTarget={{
          key: "current:implementation-plan.md:2",
          side: "current",
          sidePath: "implementation-plan.md",
          line: 2,
          requestId: 1,
        }}
      />,
    );
  });

  expect(document.activeElement?.getAttribute("aria-label")).toBe(
    "implementation-plan.md current 2行目にコメントを追加",
  );
});

test("Diff Review jumpはtargetを含むcontext gapを展開して再materialize後にfocusする", () => {
  installImmediateAnimationFrame();
  const container = createContainer();
  const root = createRoot(container);
  const contextLines = Array.from({ length: 10 }, (_, index) => ({
    kind: "context" as const,
    text: `context ${index + 1}`,
  }));
  act(() => {
    root.render(
      <DiffViewer
        fileDiff={createDiffViewerFixture({
          lines: [
            ...contextLines,
            { kind: "removed", text: "before" },
            { kind: "added", text: "after" },
          ],
        })}
        mode="unified"
        activeChangeId={null}
        onActiveChangeIdChange={() => undefined}
        lineComments={createController()}
        commentJumpTarget={{
          key: "current:implementation-plan.md:5",
          side: "current",
          sidePath: "implementation-plan.md",
          line: 5,
          requestId: 1,
        }}
      />,
    );
  });

  expect(container.querySelector('[data-row-kind="gap"]')).toBeNull();
  expect(document.activeElement?.getAttribute("aria-label")).toBe(
    "implementation-plan.md current 5行目にコメントを追加",
  );
});

test("20k行の遠距離jumpも500行以内でmaterializeしてfocusする", () => {
  installImmediateAnimationFrame();
  const container = createContainer();
  const root = createRoot(container);
  const contextLines = Array.from({ length: 20_000 }, (_, index) => ({
    kind: "context" as const,
    text: "context " + (index + 1),
  }));
  act(() => {
    root.render(
      <DiffViewer
        fileDiff={createDiffViewerFixture({
          lines: [
            ...contextLines,
            { kind: "removed", text: "before" },
            { kind: "added", text: "after" },
          ],
        })}
        mode="unified"
        activeChangeId={null}
        onActiveChangeIdChange={() => undefined}
        lineComments={createController()}
        commentJumpTarget={{
          key: "current:implementation-plan.md:15000",
          side: "current",
          sidePath: "implementation-plan.md",
          line: 15_000,
          requestId: 1,
        }}
      />,
    );
  });

  expect(
    container.querySelectorAll("[data-row-kind]").length,
  ).toBeLessThanOrEqual(500);
  expect(document.activeElement?.getAttribute("aria-label")).toBe(
    "implementation-plan.md current 15000行目にコメントを追加",
  );
});

function createContainer(): HTMLDivElement {
  const container = document.createElement("div");
  document.body.append(container);
  containers.push(container);
  return container;
}

function createController(): DiffLineCommentsController {
  return {
    commentsByTarget: {},
    activeCommentId: null,
    draft: null,
    onStartDraft: vi.fn(),
    onDraftBodyChange: vi.fn(),
    onCancelDraft: vi.fn(),
    onSubmitDraft: vi.fn(),
    onSelectComment: vi.fn(),
  };
}

function installImmediateAnimationFrame(): void {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
}
