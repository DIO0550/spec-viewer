import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { CommentComposer } from "@/features/comments/components/CommentComposer";

const containers: HTMLElement[] = [];

afterEach(() => {
  containers.splice(0).forEach((container) => {
    container.remove();
  });
});

test("CommentComposerは入力へfocusしCtrl+Enterでtrim済み本文を送信する", () => {
  const onSubmit = vi.fn();
  const view = renderComposer({ onSubmit });
  const textarea = getTextarea(view);

  expect(document.activeElement).toBe(textarea);
  expect(view.querySelector("label")?.getAttribute("for")).toBe(textarea.id);
  expect(textarea.getAttribute("aria-describedby")).toContain(
    "shared-comment-composer-details",
  );

  act(() => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        bubbles: true,
      }),
    );
  });

  expect(onSubmit).toHaveBeenCalledWith("review body");
});

test("CommentComposerは送信不能時にblocked callbackを呼び送信しない", () => {
  const onSubmit = vi.fn();
  const onSubmitBlocked = vi.fn();
  const view = renderComposer({
    isSubmitDisabled: true,
    onSubmit,
    onSubmitBlocked,
  });
  const textarea = getTextarea(view);

  act(() => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        metaKey: true,
        bubbles: true,
      }),
    );
  });

  expect(onSubmit).not.toHaveBeenCalled();
  expect(onSubmitBlocked).toHaveBeenCalledOnce();
});

test("CommentComposerはEscapeを親へ伝播せずcancelして起点へfocusを戻す", () => {
  const onCancel = vi.fn();
  const onParentKeyDown = vi.fn();
  const focusTarget = document.createElement("button");
  document.body.append(focusTarget);
  const view = renderComposer({ onCancel, focusTarget }, onParentKeyDown);

  act(() => {
    getTextarea(view).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  expect(onCancel).toHaveBeenCalledOnce();
  expect(onParentKeyDown).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(focusTarget);
  focusTarget.remove();
});

type ComposerOverrides = Partial<Parameters<typeof CommentComposer>[0]>;

function renderComposer(
  overrides: ComposerOverrides = {},
  onParentKeyDown = vi.fn(),
): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  containers.push(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <fieldset onKeyDown={onParentKeyDown}>
        <CommentComposer
          id="shared-comment-composer"
          label="コメント"
          body="  review body  "
          isSaving={false}
          isSubmitDisabled={false}
          hint="CtrlまたはCommand+Enterで保存"
          onBodyChange={() => undefined}
          onCancel={() => undefined}
          onSubmit={() => undefined}
          {...overrides}
        >
          <p role="alert">message</p>
        </CommentComposer>
      </fieldset>,
    );
  });

  return container;
}

function getTextarea(container: HTMLElement): HTMLTextAreaElement {
  const textarea = container.querySelector("textarea");
  if (textarea === null) {
    throw new Error("textarea not found");
  }
  return textarea;
}
