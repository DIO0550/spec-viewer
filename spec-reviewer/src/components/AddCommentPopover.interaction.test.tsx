import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type { CommentAnchorDraft } from "../types/comment";
import { AddCommentPopover } from "./AddCommentPopover";

const draft: CommentAnchorDraft = {
  anchor: {
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 2,
    textHash: "fnv1a:12345678",
    textSnippet: "selected requirement text",
    charRange: {
      start: 4,
      end: 29,
    },
  },
  selectionBounds: {
    top: 24,
    left: 32,
    width: 120,
    height: 18,
  },
};

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

function renderPopover(
  overrides: Partial<Parameters<typeof AddCommentPopover>[0]> = {},
): RenderResult {
  return renderComponent(
    <AddCommentPopover
      draft={draft}
      style={{ top: 10, left: 20 }}
      isSaving={false}
      errorMessage={null}
      isScopeReady={true}
      onSubmit={vi.fn().mockResolvedValue(true)}
      onCancel={vi.fn()}
      {...overrides}
    />,
  );
}

function findTextarea(container: ParentNode): HTMLTextAreaElement {
  return container.querySelector("textarea") as HTMLTextAreaElement;
}

function findSaveButton(container: ParentNode): HTMLButtonElement {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.includes("保存") ?? false,
  ) as HTMLButtonElement;
}

test("AddCommentPopoverはtextareaにfocusし空本文では保存を無効にする", () => {
  const result = renderPopover();
  const textarea = findTextarea(result.container);
  const saveButton = findSaveButton(result.container);

  expect(document.activeElement).toBe(textarea);
  expect(result.container.querySelector("label")?.getAttribute("for")).toBe(
    textarea.id,
  );
  expect(saveButton.disabled).toBe(true);
  result.unmount();
});

test("AddCommentPopoverはtrim済み本文とanchorを保存する", async () => {
  const onSubmit = vi.fn().mockResolvedValue(true);
  const result = renderPopover({ onSubmit });
  const textarea = findTextarea(result.container);

  act(() => {
    textarea.value = "  Please clarify this requirement.  ";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await act(async () => {
    findSaveButton(result.container).click();
  });

  expect(onSubmit).toHaveBeenCalledWith({
    anchor: draft.anchor,
    body: "Please clarify this requirement.",
  });
  result.unmount();
});

test("AddCommentPopoverはscope不足時に保存を止めて理由を表示する", () => {
  const onSubmit = vi.fn().mockResolvedValue(true);
  const result = renderPopover({ isScopeReady: false, onSubmit });
  const textarea = findTextarea(result.container);

  act(() => {
    textarea.value = "Cannot save yet";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  expect(findSaveButton(result.container).disabled).toBe(true);
  expect(result.container.textContent).toContain(
    "保存する前にワークスペース、Spec、ファイルを選択してください。",
  );
  expect(onSubmit).not.toHaveBeenCalled();
  result.unmount();
});

test("AddCommentPopoverは保存中と保存失敗を表示する", () => {
  const result = renderPopover({
    isSaving: true,
    errorMessage: "disk write failed",
  });

  expect(findTextarea(result.container).disabled).toBe(true);
  expect(findSaveButton(result.container).disabled).toBe(true);
  expect(result.container.textContent).toContain("disk write failed");
  expect(result.container.querySelector('[role="alert"]')).not.toBeNull();
  result.unmount();
});

test("AddCommentPopoverはEscapeでキャンセルする", () => {
  const onCancel = vi.fn();
  const result = renderPopover({ onCancel });
  const textarea = findTextarea(result.container);

  act(() => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  expect(onCancel).toHaveBeenCalledOnce();
  result.unmount();
});

test("AddCommentPopoverはdialog内のbutton focus時もEscapeでキャンセルする", () => {
  const onCancel = vi.fn();
  const result = renderPopover({ onCancel });
  const cancelButton = Array.from(
    result.container.querySelectorAll("button"),
  ).find(
    (button) =>
      button.getAttribute("aria-label") === "コメント追加をキャンセル",
  );

  act(() => {
    (cancelButton as HTMLButtonElement).focus();
    cancelButton?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  expect(onCancel).toHaveBeenCalledOnce();
  result.unmount();
});

test("AddCommentPopoverはCtrl Enterで保存する", async () => {
  const onSubmit = vi.fn().mockResolvedValue(true);
  const result = renderPopover({ onSubmit });
  const textarea = findTextarea(result.container);

  act(() => {
    textarea.value = "Keyboard submit";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await act(async () => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        bubbles: true,
      }),
    );
  });

  expect(onSubmit).toHaveBeenCalledWith({
    anchor: draft.anchor,
    body: "Keyboard submit",
  });
  result.unmount();
});
