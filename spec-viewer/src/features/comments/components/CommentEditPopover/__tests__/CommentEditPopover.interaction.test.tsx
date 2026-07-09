import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import {
  CommentEditPopover,
  type CommentEditPopoverDraft,
} from "@/features/comments/components/CommentEditPopover";
import {
  CommentOperationFailedState,
  CommentOperationIdleState,
  CommentOperationSavingState,
} from "@/features/comments/domain/commentOperation";
import type { Comment, CommentId } from "@/features/comments/types/comment";
import { CommentId as CommentIdValue } from "@/features/comments/types/comment";

const CommentIdFromString = CommentIdValue.fromString;
const IdleOperationState = CommentOperationIdleState.create();

type RenderResult = Readonly<{
  container: HTMLDivElement;
  rerender: (component: ReactNode) => void;
  unmount: () => void;
}>;

type DeferredBoolean = Readonly<{
  promise: Promise<boolean>;
  resolve: (value: boolean) => void;
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
    rerender: (nextComponent) => {
      act(() => {
        root.render(nextComponent);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function createComment(overrides: Partial<Comment> = {}): Comment {
  const id = overrides.id ?? CommentIdFromString("cmt_edit");
  const resolved = overrides.resolved ?? false;

  return {
    id,
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
    body: "Existing body",
    status: resolved ? "resolved" : "open",
    resolved,
    anchorResolution: null,
    createdAt: "2026-05-05T10:00:00Z",
    updatedAt: "2026-05-05T10:00:00Z",
    ...overrides,
  };
}

function createDraft(
  commentOverrides: Partial<Comment> = {},
): CommentEditPopoverDraft {
  return {
    comment: createComment(commentOverrides),
  };
}

function createProps(
  overrides: Partial<Parameters<typeof CommentEditPopover>[0]> = {},
): Parameters<typeof CommentEditPopover>[0] {
  return {
    draft: createDraft(),
    style: { top: 10, left: 20 },
    isSaving: false,
    operationState: IdleOperationState,
    onSubmit: vi.fn().mockResolvedValue(true),
    onResolveComment: vi.fn().mockResolvedValue(true),
    onReopenComment: vi.fn().mockResolvedValue(true),
    onDeleteComment: vi.fn().mockResolvedValue(true),
    onCancel: vi.fn(),
    ...overrides,
  };
}

function renderPopover(
  overrides: Partial<Parameters<typeof CommentEditPopover>[0]> = {},
): RenderResult {
  return renderComponent(<CommentEditPopover {...createProps(overrides)} />);
}

function rerenderPopover(
  result: RenderResult,
  overrides: Partial<Parameters<typeof CommentEditPopover>[0]> = {},
): void {
  result.rerender(<CommentEditPopover {...createProps(overrides)} />);
}

function findPopover(container: ParentNode): HTMLElement {
  return container.querySelector(".add-comment-popover") as HTMLElement;
}

function findTextarea(container: ParentNode): HTMLTextAreaElement {
  return container.querySelector("textarea") as HTMLTextAreaElement;
}

function findButtonByText(
  container: ParentNode,
  text: string,
): HTMLButtonElement {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) => button.textContent === text) as HTMLButtonElement;
}

function findButtonContainingText(
  container: ParentNode,
  text: string,
): HTMLButtonElement {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>("button"),
  ).find(
    (button) => button.textContent?.includes(text) ?? false,
  ) as HTMLButtonElement;
}

function inputText(textarea: HTMLTextAreaElement, value: string): void {
  act(() => {
    textarea.value = value;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function createOperationErrorState(
  operation: "add" | "update" | "delete" | "resolve" | "reopen" | "toggle",
  targetCommentId: CommentId | null,
  message: string,
) {
  return CommentOperationFailedState.create(operation, targetCommentId, {
    feature: "comments",
    code: "unknown",
    message,
    cause: {
      command: "update_comment",
      code: "unknown",
      message,
      raw: null,
    },
  });
}

function createDeferredBoolean(): DeferredBoolean {
  let resolvePromise: (value: boolean) => void = () => {};
  const promise = new Promise<boolean>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: resolvePromise,
  };
}

test("CommentEditPopoverはdraft=nullでは描画せずhandlerを実行しない", () => {
  const onCancel = vi.fn();
  const result = renderPopover({
    draft: null,
    operationState: CommentOperationSavingState.create(
      "update",
      CommentIdFromString("cmt_edit"),
    ),
    onCancel,
  });

  act(() => {
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });

  expect(result.container.firstElementChild).toBeNull();
  expect(onCancel).not.toHaveBeenCalled();
  result.unmount();
});

test("CommentEditPopoverは初期表示でariaとstyleを渡しtextareaへfocusする", () => {
  const result = renderPopover({ style: { top: 24, left: 32 } });
  const popover = findPopover(result.container);
  const textarea = findTextarea(result.container);

  expect(popover.tagName).toBe("ASIDE");
  expect(popover.getAttribute("role")).toBe("dialog");
  expect(popover.getAttribute("aria-labelledby")).not.toBeNull();
  expect(popover.style.top).toBe("24px");
  expect(popover.style.left).toBe("32px");
  expect(result.container.querySelector("label")?.getAttribute("for")).toBe(
    textarea.id,
  );
  expect(textarea.value).toBe("Existing body");
  expect(document.activeElement).toBe(textarea);
  result.unmount();
});

test("CommentEditPopoverはsame comment rerenderで編集中の本文を維持する", () => {
  const sameCommentId = CommentIdFromString("cmt_same");
  const result = renderPopover({ draft: createDraft({ id: sameCommentId }) });
  const textarea = findTextarea(result.container);

  inputText(textarea, "Draft body in progress");
  rerenderPopover(result, {
    draft: createDraft({ id: sameCommentId, body: "Server body changed" }),
  });

  expect(findTextarea(result.container).value).toBe("Draft body in progress");
  result.unmount();
});

test("CommentEditPopoverは別commentへ切り替わると本文とvalidationと削除確認をresetする", async () => {
  const firstDraft = createDraft({ id: CommentIdFromString("cmt_first") });
  const secondDraft = createDraft({
    id: CommentIdFromString("cmt_second"),
    body: "Second body",
  });
  const result = renderPopover({ draft: firstDraft });
  const textarea = findTextarea(result.container);

  inputText(textarea, "   ");
  await act(async () => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        bubbles: true,
      }),
    );
  });
  act(() => {
    findButtonByText(result.container, "削除").click();
  });

  rerenderPopover(result, { draft: secondDraft });

  expect(findTextarea(result.container).value).toBe("Second body");
  expect(result.container.textContent).not.toContain(
    "コメント本文を入力してください",
  );
  expect(result.container.textContent).not.toContain(
    "このコメントを完全に削除しますか？",
  );
  result.unmount();
});

test("CommentEditPopoverはtrim済み本文をsubmitし空本文を保存しない", async () => {
  const onSubmit = vi.fn().mockResolvedValue(true);
  const result = renderPopover({ onSubmit });
  const textarea = findTextarea(result.container);

  inputText(textarea, "   ");
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
    "コメント本文を入力してください",
  );

  inputText(textarea, "  Updated body  ");
  await act(async () => {
    findButtonContainingText(result.container, "保存").click();
  });

  expect(onSubmit).toHaveBeenCalledWith(
    CommentIdFromString("cmt_edit"),
    "Updated body",
  );
  result.unmount();
});

test("CommentEditPopoverはupdate falseで更新失敗を表示する", async () => {
  const onSubmit = vi.fn().mockResolvedValue(false);
  const result = renderPopover({ onSubmit });
  const textarea = findTextarea(result.container);

  inputText(textarea, "Updated body");
  await act(async () => {
    findButtonContainingText(result.container, "保存").click();
  });

  expect(result.container.textContent).toContain(
    "コメントを更新できませんでした。再試行してください。",
  );
  expect(result.container.querySelector('[role="alert"]')).not.toBeNull();
  result.unmount();
});

test("CommentEditPopoverは未解決コメントのresolve handlerを呼ぶ", async () => {
  const onResolveComment = vi.fn().mockResolvedValue(true);
  const result = renderPopover({ onResolveComment });

  await act(async () => {
    findButtonContainingText(result.container, "解決する").click();
  });

  expect(onResolveComment).toHaveBeenCalledWith(
    CommentIdFromString("cmt_edit"),
  );
  result.unmount();
});

test("CommentEditPopoverは解決済みコメントのreopen handlerを呼ぶ", async () => {
  const onReopenComment = vi.fn().mockResolvedValue(true);
  const result = renderPopover({
    draft: createDraft({ resolved: true, status: "resolved" }),
    onReopenComment,
  });

  await act(async () => {
    findButtonContainingText(result.container, "再オープン").click();
  });

  expect(onReopenComment).toHaveBeenCalledWith(CommentIdFromString("cmt_edit"));
  result.unmount();
});

test("CommentEditPopoverはdelete confirmationから削除を実行しcancelで戻せる", async () => {
  const onDeleteComment = vi.fn().mockResolvedValue(true);
  const result = renderPopover({ onDeleteComment });

  act(() => {
    findButtonByText(result.container, "削除").click();
  });

  expect(onDeleteComment).not.toHaveBeenCalled();
  expect(result.container.textContent).toContain(
    "このコメントを完全に削除しますか？",
  );

  const cancelDeleteButton = result.container.querySelector(
    '[aria-label="コメント削除をキャンセル cmt_edit"]',
  ) as HTMLButtonElement;

  act(() => {
    cancelDeleteButton.click();
  });

  expect(result.container.textContent).not.toContain(
    "このコメントを完全に削除しますか？",
  );

  act(() => {
    findButtonByText(result.container, "削除").click();
  });
  const confirmDeleteButton = result.container.querySelector(
    '[aria-label="コメント削除を確定 cmt_edit"]',
  ) as HTMLButtonElement;

  await act(async () => {
    confirmDeleteButton.click();
  });

  expect(onDeleteComment).toHaveBeenCalledWith(CommentIdFromString("cmt_edit"));
  result.unmount();
});

test("CommentEditPopoverはdelete falseで削除失敗を表示する", async () => {
  const onDeleteComment = vi.fn().mockResolvedValue(false);
  const result = renderPopover({ onDeleteComment });

  act(() => {
    findButtonByText(result.container, "削除").click();
  });
  const confirmDeleteButton = result.container.querySelector(
    '[aria-label="コメント削除を確定 cmt_edit"]',
  ) as HTMLButtonElement;

  await act(async () => {
    confirmDeleteButton.click();
  });

  expect(result.container.textContent).toContain(
    "コメントを削除できませんでした。再試行してください。",
  );
  expect(result.container.querySelector('[role="alert"]')).not.toBeNull();
  result.unmount();
});

test("CommentEditPopoverはbusy中にdismissalと操作ボタンを無効化する", () => {
  const onCancel = vi.fn();
  const result = renderPopover({
    operationState: CommentOperationSavingState.create(
      "resolve",
      CommentIdFromString("cmt_edit"),
    ),
    onCancel,
  });
  const textarea = findTextarea(result.container);

  act(() => {
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    findPopover(result.container).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  expect(textarea.disabled).toBe(true);
  expect(findButtonContainingText(result.container, "解決する").disabled).toBe(
    true,
  );
  expect(findButtonByText(result.container, "削除").disabled).toBe(true);
  expect(findButtonContainingText(result.container, "保存").disabled).toBe(
    true,
  );
  expect(onCancel).not.toHaveBeenCalled();
  result.unmount();
});

test("CommentEditPopoverはoperation errorをcommentIdとoperationでscopeする", () => {
  const result = renderPopover({
    operationState: createOperationErrorState(
      "delete",
      CommentIdFromString("cmt_edit"),
      "対象コメントの削除に失敗しました。",
    ),
  });

  expect(result.container.textContent).toContain(
    "対象コメントの削除に失敗しました。",
  );

  rerenderPopover(result, {
    operationState: createOperationErrorState(
      "delete",
      CommentIdFromString("cmt_other"),
      "別コメントの削除に失敗しました。",
    ),
  });

  expect(result.container.textContent).not.toContain(
    "別コメントの削除に失敗しました。",
  );

  rerenderPopover(result, {
    operationState: createOperationErrorState(
      "add",
      CommentIdFromString("cmt_edit"),
      "追加失敗は編集に表示しません。",
    ),
  });

  expect(result.container.textContent).not.toContain(
    "追加失敗は編集に表示しません。",
  );
  result.unmount();
});

test("CommentEditPopoverはCtrlまたはMeta+Enterで保存しEscapeでcancelする", async () => {
  const onSubmit = vi.fn().mockResolvedValue(true);
  const onCancel = vi.fn();
  const result = renderPopover({ onSubmit, onCancel });
  const textarea = findTextarea(result.container);

  inputText(textarea, "Keyboard body");
  await act(async () => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        metaKey: true,
        bubbles: true,
      }),
    );
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
  act(() => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  expect(onSubmit).toHaveBeenCalledTimes(2);
  expect(onCancel).toHaveBeenCalledOnce();
  result.unmount();
});

test("CommentEditPopoverはoutside mousedownでcancelする", () => {
  const onCancel = vi.fn();
  const result = renderPopover({ onCancel });

  act(() => {
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });

  expect(onCancel).toHaveBeenCalledOnce();
  result.unmount();
});

test("CommentEditPopoverはsubmit Promise解決前に別commentへ切り替わるとstale errorを表示しない", async () => {
  const deferred = createDeferredBoolean();
  const onSubmit = vi.fn().mockReturnValue(deferred.promise);
  const result = renderPopover({ onSubmit });
  const textarea = findTextarea(result.container);

  inputText(textarea, "Pending body");
  await act(async () => {
    findButtonContainingText(result.container, "保存").click();
  });
  rerenderPopover(result, {
    draft: createDraft({
      id: CommentIdFromString("cmt_next"),
      body: "Next body",
    }),
  });
  await act(async () => {
    deferred.resolve(false);
    await deferred.promise;
  });

  expect(findTextarea(result.container).value).toBe("Next body");
  expect(result.container.textContent).not.toContain(
    "コメントを更新できませんでした。再試行してください。",
  );
  expect(onSubmit).toHaveBeenCalledWith(
    CommentIdFromString("cmt_edit"),
    "Pending body",
  );
  result.unmount();
});

test("CommentEditPopoverはsubmit Promise解決前にdraft=nullになっても描画を戻さない", async () => {
  const deferred = createDeferredBoolean();
  const onSubmit = vi.fn().mockReturnValue(deferred.promise);
  const result = renderPopover({ onSubmit });
  const textarea = findTextarea(result.container);

  inputText(textarea, "Pending body");
  await act(async () => {
    findButtonContainingText(result.container, "保存").click();
  });
  rerenderPopover(result, { draft: null });
  await act(async () => {
    deferred.resolve(false);
    await deferred.promise;
  });

  expect(result.container.firstElementChild).toBeNull();
  expect(onSubmit).toHaveBeenCalledWith(
    CommentIdFromString("cmt_edit"),
    "Pending body",
  );
  result.unmount();
});
