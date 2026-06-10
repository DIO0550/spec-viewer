import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { useKeyboardShortcuts } from "@/features/preferences/hooks/useKeyboardShortcuts";

type RenderResult = Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}>;

function renderComponent(component: ReactNode): RenderResult {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(component);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

type ShortcutHarnessProps = Readonly<{
  onNextFile: () => void;
  onPreviousFile: () => void;
  onNextComment: () => void;
  onPreviousComment: () => void;
}>;

function ShortcutHarness({
  onNextFile,
  onPreviousFile,
  onNextComment,
  onPreviousComment,
}: ShortcutHarnessProps) {
  useKeyboardShortcuts({
    isEnabled: true,
    onNextFile,
    onPreviousFile,
    onNextComment,
    onPreviousComment,
  });

  return (
    <div>
      <button type="button">Outside input</button>
      <input aria-label="Editable field" />
    </div>
  );
}

test("useKeyboardShortcutsはAlt矢印キーでfile tabとcommentを移動する", () => {
  const onNextFile = vi.fn();
  const onPreviousFile = vi.fn();
  const onNextComment = vi.fn();
  const onPreviousComment = vi.fn();
  const result = renderComponent(
    <ShortcutHarness
      onNextFile={onNextFile}
      onPreviousFile={onPreviousFile}
      onNextComment={onNextComment}
      onPreviousComment={onPreviousComment}
    />,
  );

  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        altKey: true,
        bubbles: true,
      }),
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        altKey: true,
        bubbles: true,
      }),
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        altKey: true,
        bubbles: true,
      }),
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowUp",
        altKey: true,
        bubbles: true,
      }),
    );
  });

  expect(onNextFile).toHaveBeenCalledOnce();
  expect(onPreviousFile).toHaveBeenCalledOnce();
  expect(onNextComment).toHaveBeenCalledOnce();
  expect(onPreviousComment).toHaveBeenCalledOnce();
  result.unmount();
});

test("useKeyboardShortcutsは入力中の矢印キーを横取りしない", () => {
  const onNextFile = vi.fn();
  const result = renderComponent(
    <ShortcutHarness
      onNextFile={onNextFile}
      onPreviousFile={vi.fn()}
      onNextComment={vi.fn()}
      onPreviousComment={vi.fn()}
    />,
  );
  const input = result.container.querySelector("input") as HTMLInputElement;

  act(() => {
    input.focus();
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        altKey: true,
        bubbles: true,
      }),
    );
  });

  expect(onNextFile).not.toHaveBeenCalled();
  result.unmount();
});
