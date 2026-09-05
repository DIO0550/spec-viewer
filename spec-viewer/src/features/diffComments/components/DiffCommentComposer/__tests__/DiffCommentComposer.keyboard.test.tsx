import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { DiffCommentComposer } from "@/features/diffComments/components/DiffCommentComposer";

const containers: HTMLElement[] = [];

afterEach(() => {
  containers.splice(0).forEach((container) => container.remove());
});

test("Ctrl+Enterでtrim済み本文を送信しplain Enterは改行として扱う", () => {
  const onBodyChange = vi.fn();
  const onSubmit = vi.fn();
  const view = renderComposer({ onBodyChange, onSubmit });
  const textarea = getTextarea(view);

  act(() => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      }),
    );
  });
  expect(onSubmit).not.toHaveBeenCalled();

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

test("IME変換中のEscとCtrl+Enterはcancelもsubmitもしない", () => {
  const onCancel = vi.fn();
  const onSubmit = vi.fn();
  const view = renderComposer({ onCancel, onSubmit });
  const textarea = getTextarea(view);

  act(() => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        isComposing: true,
      }),
    );
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        bubbles: true,
        isComposing: true,
      }),
    );
  });

  expect(onCancel).not.toHaveBeenCalled();
  expect(onSubmit).not.toHaveBeenCalled();
});

test("Escは親へ伝播せずcancelして起点ボタンへfocusを戻す", () => {
  const onCancel = vi.fn();
  const onParentKeyDown = vi.fn();
  const origin = document.createElement("button");
  document.body.append(origin);
  const view = renderComposer({ onCancel, origin }, onParentKeyDown);
  const textarea = getTextarea(view);

  act(() => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  expect(onCancel).toHaveBeenCalledOnce();
  expect(onParentKeyDown).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(origin);
  origin.remove();
});

test("空本文と保存中は送信できず状態を読み上げる", () => {
  const onSubmit = vi.fn();
  const view = renderComposer({
    body: "   ",
    isSaving: true,
    onSubmit,
    statusMessage: "保存しています",
  });
  const submit = view.querySelector<HTMLButtonElement>("button[type='submit']");
  const status = view.querySelector<HTMLElement>("[role='status']");

  expect(submit?.disabled).toBe(true);
  expect(status?.textContent).toContain("保存しています");
  expect(onSubmit).not.toHaveBeenCalled();
});

test.each([
  ["staleTarget", "保存先が古くなりました。再アンカーしてください。"],
  ["revisionOverflow", "revision上限に達したため保存できません。"],
] as const)("%sでは保存buttonとshortcutを無効にするが本文編集は維持する", (disabledReason, expectedMessage) => {
  const onBodyChange = vi.fn();
  const onSubmit = vi.fn();
  const view = renderComposer({
    canSubmit: false,
    disabledReason,
    onBodyChange,
    onSubmit,
  });
  const textarea = getTextarea(view);

  act(() => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        bubbles: true,
      }),
    );
  });
  act(() => {
    setTextareaValue(textarea, "updated body");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  expect(
    view.querySelector<HTMLButtonElement>("button[type='submit']")?.disabled,
  ).toBe(true);
  expect(view.querySelector("[role='alert']")?.textContent).toContain(
    expectedMessage,
  );
  expect(onSubmit).not.toHaveBeenCalled();
  expect(onBodyChange).toHaveBeenCalledWith("updated body");
});

test("retryと再アンカー操作をcallerへ返しdurability uncertainを警告する", () => {
  const onRetry = vi.fn();
  const onReanchor = vi.fn();
  const view = renderComposer({
    canSubmit: false,
    disabledReason: "staleTarget",
    isDurabilityUncertain: true,
    onRetry,
    onReanchor,
  });

  act(() => {
    getButton(view, "保存を再試行").click();
    getButton(view, "再アンカー").click();
  });

  expect(onRetry).toHaveBeenCalledOnce();
  expect(onReanchor).toHaveBeenCalledOnce();
  expect(view.querySelector("[role='status']")?.textContent).toContain(
    "保存結果を確認できません",
  );
});

function renderComposer(
  overrides: Partial<Parameters<typeof DiffCommentComposer>[0]> = {},
  onParentKeyDown = vi.fn(),
): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  containers.push(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <div onKeyDown={onParentKeyDown}>
        <DiffCommentComposer
          id="composer"
          body="  review body  "
          label="src/file.ts current 4行目へのコメント"
          isSaving={false}
          onBodyChange={() => undefined}
          onCancel={() => undefined}
          onSubmit={() => undefined}
          {...overrides}
        />
      </div>,
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

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === label,
  );
  if (button === undefined) {
    throw new Error(`${label} button not found`);
  }
  return button;
}

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
