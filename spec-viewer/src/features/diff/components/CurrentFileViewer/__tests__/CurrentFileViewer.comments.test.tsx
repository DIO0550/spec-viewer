import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { CurrentFileViewer } from "@/features/diff/components/CurrentFileViewer";
import { createDiffViewerFixture } from "@/features/diff/components/DiffViewer/testFixtures";
import type { DiffLineCommentsController } from "@/features/diffComments/components/DiffLineCommentSlot";

const containers: HTMLElement[] = [];

afterEach(() => {
  containers.splice(0).forEach((container) => container.remove());
});

test("Editorはunchangedを含む全current行をコメント対象にする", () => {
  const view = renderViewer(
    createDiffViewerFixture({ newContent: "first\nsecond" }),
  );

  expect(
    findButton(view, "implementation-plan.md current 1行目にコメントを追加"),
  ).not.toBeNull();
  expect(
    findButton(view, "implementation-plan.md current 2行目にコメントを追加"),
  ).not.toBeNull();
});

test("Editorはコメント列用modifierを付けてコード行を4列で描画する", () => {
  const view = renderViewer(
    createDiffViewerFixture({ newContent: "first\nsecond" }),
  );

  expect(
    view.querySelector(".current-file-viewer--with-comments"),
  ).not.toBeNull();
  expect(
    view.querySelector('[data-row-kind="current-line"]')?.children,
  ).toHaveLength(4);
});

test("Editorはdeletion peek summaryとbase peek行をコメント対象にしない", () => {
  const view = renderViewer(
    createDiffViewerFixture({
      status: "deleted",
      oldContent: "old",
      hunks: [
        {
          header: "@@ -1 +0,0 @@",
          lines: [
            {
              kind: "removed",
              text: "old",
              oldLineNumber: 1,
              newLineNumber: null,
            },
          ],
        },
      ],
    }),
  );

  expect(view.textContent).toContain("1行削除");
  expect(view.querySelector(".diff-line-comment-control")).toBeNull();
});

function renderViewer(
  fileDiff: ReturnType<typeof createDiffViewerFixture>,
): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  containers.push(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <CurrentFileViewer
        fileDiff={fileDiff}
        lineComments={createController()}
      />,
    );
  });
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

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.getAttribute("aria-label") === label,
  );
  if (button === undefined) {
    throw new Error(`button not found: ${label}`);
  }
  return button;
}
