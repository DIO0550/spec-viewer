import { act, type ReactElement, useState } from "react";
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

test("Diffコメントへ1文字入力してcontrolled draftが更新されてもfocusを維持する", () => {
  const view = renderHarness();
  const textarea = getTextarea(view);

  act(() => {
    setTextareaValue(textarea, "a");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  expect(textarea.isConnected).toBe(true);
  expect(document.activeElement).toBe(textarea);
  expect(getTextarea(view)).toBe(textarea);
  expect(textarea.value).toBe("a");
});

/** @returns A Diff viewer whose draft body is controlled by React state. */
function ControlledDiffCommentHarness(): ReactElement {
  const [body, setBody] = useState("");
  const controller: DiffLineCommentsController = {
    commentsByTarget: {},
    activeCommentId: null,
    draft: {
      target: {
        key: "current:implementation-plan.md:2",
        side: "current",
        sidePath: "implementation-plan.md",
        newPath: "implementation-plan.md",
        line: 2,
      },
      body,
      isSaving: false,
      origin: null,
    },
    onStartDraft: vi.fn(),
    onDraftBodyChange: setBody,
    onCancelDraft: vi.fn(),
    onSubmitDraft: vi.fn(),
    onSelectComment: vi.fn(),
  };

  return (
    <DiffViewer
      fileDiff={createDiffViewerFixture()}
      mode="unified"
      activeChangeId={null}
      onActiveChangeIdChange={() => undefined}
      lineComments={controller}
    />
  );
}

/** @returns The mounted controlled Diff comment fixture. */
function renderHarness(): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  containers.push(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ControlledDiffCommentHarness />);
  });

  return container;
}

/** @returns The active comment textarea. */
function getTextarea(container: HTMLElement): HTMLTextAreaElement {
  const textarea = container.querySelector<HTMLTextAreaElement>(
    ".diff-comment-composer textarea",
  );
  if (textarea === null) {
    throw new Error("Diff comment textarea not found");
  }
  return textarea;
}

/** Updates a textarea through its native value setter. */
function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  if (setter === undefined) {
    throw new Error("textarea value setter not found");
  }
  setter.call(textarea, value);
}
