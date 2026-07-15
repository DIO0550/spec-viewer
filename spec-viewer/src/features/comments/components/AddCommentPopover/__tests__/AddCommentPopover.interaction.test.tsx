import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { AddCommentPopover } from "@/features/comments/components/AddCommentPopover";
import type { CommentAnchorDraft } from "@/features/comments/types/comment";

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

test("AddCommentPopoverは空白のみ本文を保存せず理由を表示する", async () => {
  const onSubmit = vi.fn().mockResolvedValue(true);
  const result = renderPopover({ onSubmit });
  const textarea = findTextarea(result.container);

  act(() => {
    textarea.value = "   ";
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

  expect(onSubmit).not.toHaveBeenCalled();
  expect(result.container.textContent).toContain(
    "コメント本文を入力してください。",
  );
  expect(result.container.querySelector('[role="alert"]')).not.toBeNull();
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

test("AddCommentPopoverはscope不足を本文validationより優先して表示する", async () => {
  const onSubmit = vi.fn().mockResolvedValue(true);
  const result = renderPopover({ isScopeReady: false, onSubmit });
  const textarea = findTextarea(result.container);

  act(() => {
    textarea.value = "   ";
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

  expect(result.container.textContent).toContain(
    "保存する前にワークスペース、Spec、ファイルを選択してください。",
  );
  expect(result.container.textContent).not.toContain(
    "コメント本文を入力してください。",
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

test("AddCommentPopoverは保存結果falseで失敗メッセージを表示する", async () => {
  const onSubmit = vi.fn().mockResolvedValue(false);
  const result = renderPopover({ onSubmit });
  const textarea = findTextarea(result.container);

  act(() => {
    textarea.value = "Save me";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await act(async () => {
    findSaveButton(result.container).click();
  });

  expect(result.container.textContent).toContain(
    "コメントを保存できませんでした。再試行してください。",
  );
  expect(result.container.querySelector('[role="alert"]')).not.toBeNull();
  result.unmount();
});

test("AddCommentPopoverは本文スクロール領域とfooter actionsを分けて表示する", () => {
  const result = renderPopover({
    draft: {
      ...draft,
      anchor: {
        ...draft.anchor,
        textSnippet: "long selected text ".repeat(30),
      },
    },
  });
  const body = result.container.querySelector(".add-comment-popover__body");
  const actions = result.container.querySelector(
    ".add-comment-popover__actions",
  );

  expect(body?.textContent).toContain("long selected text");
  expect(body?.contains(findTextarea(result.container))).toBe(true);
  expect(actions?.textContent).toContain("保存");
  expect(actions?.contains(findTextarea(result.container))).toBe(false);
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

test("AddCommentPopoverは範囲外クリックでキャンセルする", () => {
  const onCancel = vi.fn();
  const result = renderPopover({ onCancel });

  act(() => {
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });

  expect(onCancel).toHaveBeenCalledOnce();
  result.unmount();
});

test("AddCommentPopoverは内部クリックではキャンセルしない", () => {
  const onCancel = vi.fn();
  const result = renderPopover({ onCancel });
  const textarea = findTextarea(result.container);

  act(() => {
    textarea.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });

  expect(onCancel).not.toHaveBeenCalled();
  result.unmount();
});

test("AddCommentPopoverは保存中の範囲外クリックではキャンセルしない", () => {
  const onCancel = vi.fn();
  const result = renderPopover({ isSaving: true, onCancel });

  act(() => {
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });

  expect(onCancel).not.toHaveBeenCalled();
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

test("AddCommentPopoverはMeta Enterで保存する", async () => {
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
        metaKey: true,
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

test("AddCommentPopoverは追加modifierつきCtrl Enterで保存する", async () => {
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
        shiftKey: true,
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

test("AddCommentPopoverは追加modifierつきEscapeでキャンセルする", () => {
  const onCancel = vi.fn();
  const result = renderPopover({ onCancel });
  const textarea = findTextarea(result.container);

  act(() => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        shiftKey: true,
        bubbles: true,
      }),
    );
  });

  expect(onCancel).toHaveBeenCalledOnce();
  result.unmount();
});

test("AddCommentPopoverは保存中のCtrl Enterで保存しない", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onSubmit = vi.fn().mockResolvedValue(true);

  act(() => {
    root.render(
      <AddCommentPopover
        draft={draft}
        style={{ top: 10, left: 20 }}
        isSaving={false}
        errorMessage={null}
        isScopeReady={true}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
  });

  const textarea = findTextarea(container);
  act(() => {
    textarea.value = "Saving should block shortcut";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  act(() => {
    root.render(
      <AddCommentPopover
        draft={draft}
        style={{ top: 10, left: 20 }}
        isSaving={true}
        errorMessage={null}
        isScopeReady={true}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
  });

  await act(async () => {
    findTextarea(container).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        bubbles: true,
      }),
    );
  });

  expect(onSubmit).not.toHaveBeenCalled();
  act(() => {
    root.unmount();
  });
  container.remove();
});

test("AddCommentPopoverは保存中のEscapeでキャンセルしない", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onCancel = vi.fn();

  act(() => {
    root.render(
      <AddCommentPopover
        draft={draft}
        style={{ top: 10, left: 20 }}
        isSaving={false}
        errorMessage={null}
        isScopeReady={true}
        onSubmit={vi.fn().mockResolvedValue(true)}
        onCancel={onCancel}
      />,
    );
  });

  act(() => {
    root.render(
      <AddCommentPopover
        draft={draft}
        style={{ top: 10, left: 20 }}
        isSaving={true}
        errorMessage={null}
        isScopeReady={true}
        onSubmit={vi.fn().mockResolvedValue(true)}
        onCancel={onCancel}
      />,
    );
  });

  act(() => {
    findTextarea(container).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  expect(onCancel).not.toHaveBeenCalled();
  act(() => {
    root.unmount();
  });
  container.remove();
});

test("AddCommentPopoverはkey変更remountで本文とvalidation errorを初期化する", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <AddCommentPopover
        key="draft-1"
        draft={draft}
        style={{ top: 10, left: 20 }}
        isSaving={false}
        errorMessage={null}
        isScopeReady={true}
        onSubmit={vi.fn().mockResolvedValue(true)}
        onCancel={vi.fn()}
      />,
    );
  });

  const textarea = findTextarea(container);
  act(() => {
    textarea.value = "   ";
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

  expect(container.textContent).toContain("コメント本文を入力してください。");

  act(() => {
    root.render(
      <AddCommentPopover
        key="draft-2"
        draft={{
          ...draft,
          anchor: {
            ...draft.anchor,
            blockIndex: 3,
            textHash: "fnv1a:87654321",
            textSnippet: "next selected requirement text",
          },
        }}
        style={{ top: 10, left: 20 }}
        isSaving={false}
        errorMessage={null}
        isScopeReady={true}
        onSubmit={vi.fn().mockResolvedValue(true)}
        onCancel={vi.fn()}
      />,
    );
  });

  expect(findTextarea(container).value).toBe("");
  expect(container.textContent).not.toContain(
    "コメント本文を入力してください。",
  );

  act(() => {
    root.unmount();
  });
  container.remove();
});
