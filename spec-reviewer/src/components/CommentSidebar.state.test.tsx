import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type {
  Comment,
  CommentAnchor,
  CommentAnchorDisplayState,
  CommentId,
} from "../types/comment";
import { CommentSidebar } from "./CommentSidebar";

const anchor: CommentAnchor = {
  fileKey: "tasks",
  blockType: "paragraph",
  blockIndex: 2,
  textHash: "sha256:comment-anchor",
  textSnippet: "Users can scan comments for the active spec file",
  charRange: {
    start: 0,
    end: 22,
  },
};

const openComment: Comment = {
  id: "cmt_open",
  anchor,
  body: "Clarify what counts as an active comment highlight.",
  status: "open",
  resolved: false,
  createdAt: "2026-05-05T10:00:00Z",
  updatedAt: "2026-05-05T10:15:00Z",
};

const resolvedComment: Comment = {
  ...openComment,
  id: "cmt_resolved",
  body: "This acceptance item is covered.",
  status: "resolved",
  resolved: true,
  createdAt: "2026-05-05T11:00:00Z",
  updatedAt: "2026-05-05T11:30:00Z",
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

function renderReadySidebar(
  options: Readonly<{
    comments?: readonly Comment[];
    activeCommentId?: CommentId | null;
    anchorDisplayStates?: readonly CommentAnchorDisplayState[];
    onSelectComment?: (commentId: CommentId) => void;
    onResolveComment?: (commentId: CommentId) => void;
    onReopenComment?: (commentId: CommentId) => void;
    onDeleteComment?: (commentId: CommentId) => void;
    onUpdateComment?: (commentId: CommentId, body: string) => void;
  }> = {},
): RenderResult {
  return renderComponent(
    <CommentSidebar
      listState={{
        status: "ready",
        scope: {
          workspacePath: "/workspace/spec-reviewer",
          specId: "phase-2-comments",
          fileKey: "tasks",
        },
        statusFilter: "all",
        comments: options.comments ?? [openComment, resolvedComment],
        error: null,
      }}
      mutationState={{
        status: "idle",
        operation: null,
        commentId: null,
        error: null,
      }}
      activeCommentId={options.activeCommentId ?? null}
      anchorDisplayStates={options.anchorDisplayStates ?? []}
      onSelectComment={options.onSelectComment ?? vi.fn()}
      onResolveComment={options.onResolveComment ?? vi.fn()}
      onReopenComment={options.onReopenComment ?? vi.fn()}
      onDeleteComment={options.onDeleteComment ?? vi.fn()}
      onUpdateComment={options.onUpdateComment ?? vi.fn()}
      onReload={vi.fn()}
    />,
  );
}

test("CommentSidebarは読み込み中状態をrole statusで表示する", () => {
  const result = renderComponent(
    <CommentSidebar
      listState={{
        status: "loading",
        scope: {
          workspacePath: "/workspace/spec-reviewer",
          specId: "phase-2-comments",
          fileKey: "tasks",
        },
        statusFilter: "all",
        comments: [],
        error: null,
      }}
      mutationState={{
        status: "idle",
        operation: null,
        commentId: null,
        error: null,
      }}
      activeCommentId={null}
      onSelectComment={vi.fn()}
      onResolveComment={vi.fn()}
      onReopenComment={vi.fn()}
      onDeleteComment={vi.fn()}
      onUpdateComment={vi.fn()}
      onReload={vi.fn()}
    />,
  );

  expect(result.container.querySelector('[role="status"]')?.textContent).toBe(
    "Loading comments",
  );
  result.unmount();
});

test("CommentSidebarは未選択scopeでは空の案内を表示する", () => {
  const result = renderComponent(
    <CommentSidebar
      listState={{
        status: "idle",
        scope: null,
        statusFilter: "all",
        comments: [],
        error: null,
      }}
      mutationState={{
        status: "idle",
        operation: null,
        commentId: null,
        error: null,
      }}
      activeCommentId={null}
      onSelectComment={vi.fn()}
      onResolveComment={vi.fn()}
      onReopenComment={vi.fn()}
      onDeleteComment={vi.fn()}
      onUpdateComment={vi.fn()}
      onReload={vi.fn()}
    />,
  );

  expect(result.container.textContent).toContain("Select a spec file");
  result.unmount();
});

test("CommentSidebarは読み込み失敗をalertで表示して再読み込みできる", () => {
  const onReload = vi.fn();
  const result = renderComponent(
    <CommentSidebar
      listState={{
        status: "error",
        scope: {
          workspacePath: "/workspace/spec-reviewer",
          specId: "phase-2-comments",
          fileKey: "tasks",
        },
        statusFilter: "all",
        comments: [],
        error: {
          code: "commentRepository",
          message: "Comment store could not be read.",
          raw: "Comment store could not be read.",
        },
      }}
      mutationState={{
        status: "idle",
        operation: null,
        commentId: null,
        error: null,
      }}
      activeCommentId={null}
      onSelectComment={vi.fn()}
      onResolveComment={vi.fn()}
      onReopenComment={vi.fn()}
      onDeleteComment={vi.fn()}
      onUpdateComment={vi.fn()}
      onReload={onReload}
    />,
  );
  const retryButton = result.container.querySelector(
    "button",
  ) as HTMLButtonElement;

  act(() => {
    retryButton.click();
  });

  expect(
    result.container.querySelector('[role="alert"]')?.textContent,
  ).toContain("Comment store could not be read.");
  expect(onReload).toHaveBeenCalledOnce();
  result.unmount();
});

test("CommentSidebarはコメントなし状態を表示する", () => {
  const result = renderComponent(
    <CommentSidebar
      listState={{
        status: "empty",
        scope: {
          workspacePath: "/workspace/spec-reviewer",
          specId: "phase-2-comments",
          fileKey: "tasks",
        },
        statusFilter: "all",
        comments: [],
        error: null,
      }}
      mutationState={{
        status: "idle",
        operation: null,
        commentId: null,
        error: null,
      }}
      activeCommentId={null}
      onSelectComment={vi.fn()}
      onResolveComment={vi.fn()}
      onReopenComment={vi.fn()}
      onDeleteComment={vi.fn()}
      onUpdateComment={vi.fn()}
      onReload={vi.fn()}
    />,
  );

  expect(result.container.textContent).toContain("No comments yet");
  result.unmount();
});

test("CommentSidebarはopenとresolvedの件数とコメント本文を表示する", () => {
  const result = renderReadySidebar();

  expect(result.container.textContent).toContain("Open1");
  expect(result.container.textContent).toContain("Resolved1");
  expect(result.container.textContent).toContain(
    "Clarify what counts as an active comment highlight.",
  );
  expect(result.container.textContent).toContain(
    "This acceptance item is covered.",
  );
  expect(
    result.container.querySelector('time[datetime="2026-05-05T10:15:00Z"]'),
  ).not.toBeNull();
  result.unmount();
});

test("CommentSidebarは選択中コメントをaria-currentで表現する", () => {
  const result = renderReadySidebar({ activeCommentId: "cmt_open" });
  const activeButton = result.container.querySelector(
    '[aria-current="true"]',
  ) as HTMLButtonElement;
  const activeThread = activeButton.closest("article") as HTMLElement;

  expect(activeThread.textContent).toContain(
    "Clarify what counts as an active comment highlight.",
  );
  result.unmount();
});

test("CommentSidebarはstaleとmissingのアンカー状態を表示する", () => {
  const result = renderReadySidebar({
    anchorDisplayStates: [
      {
        commentId: "cmt_open",
        status: "stale",
      },
      {
        commentId: "cmt_resolved",
        status: "missing",
      },
    ],
  });

  expect(result.container.textContent).toContain("Anchor stale");
  expect(result.container.textContent).toContain("Anchor missing");
  result.unmount();
});

test("CommentSidebarはコメント選択とresolve操作を発火する", () => {
  const onSelectComment = vi.fn();
  const onResolveComment = vi.fn();
  const result = renderReadySidebar({
    onSelectComment,
    onResolveComment,
  });
  const selectButton = result.container.querySelector(
    '[aria-label="Select comment cmt_open"]',
  ) as HTMLButtonElement;
  const resolveButton = result.container.querySelector(
    '[aria-label="Resolve comment cmt_open"]',
  ) as HTMLButtonElement;

  act(() => {
    selectButton.click();
    resolveButton.click();
  });

  expect(onSelectComment).toHaveBeenCalledWith("cmt_open");
  expect(onResolveComment).toHaveBeenCalledWith("cmt_open");
  result.unmount();
});

test("CommentSidebarはresolvedコメントのreopen操作を発火する", () => {
  const onReopenComment = vi.fn();
  const result = renderReadySidebar({ onReopenComment });
  const reopenButton = result.container.querySelector(
    '[aria-label="Reopen comment cmt_resolved"]',
  ) as HTMLButtonElement;

  act(() => {
    reopenButton.click();
  });

  expect(onReopenComment).toHaveBeenCalledWith("cmt_resolved");
  result.unmount();
});

test("CommentSidebarはコメント本文を編集して保存できる", () => {
  const onUpdateComment = vi.fn();
  const result = renderReadySidebar({ onUpdateComment });
  const editButton = result.container.querySelector(
    '[aria-label="Edit comment cmt_open"]',
  ) as HTMLButtonElement;

  act(() => {
    editButton.click();
  });

  const editor = result.container.querySelector(
    '[aria-label="Comment body for cmt_open"]',
  ) as HTMLTextAreaElement;

  act(() => {
    editor.value = "Clarify the acceptance detail before merge.";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const saveButton = result.container.querySelector(
    '[aria-label="Save comment cmt_open"]',
  ) as HTMLButtonElement;

  act(() => {
    saveButton.click();
  });

  expect(onUpdateComment).toHaveBeenCalledWith(
    "cmt_open",
    "Clarify the acceptance detail before merge.",
  );
  expect(result.container.querySelector("textarea")).toBeNull();
  result.unmount();
});

test("CommentSidebarは空本文の保存時にvalidation messageを表示する", () => {
  const onUpdateComment = vi.fn();
  const result = renderReadySidebar({ onUpdateComment });
  const editButton = result.container.querySelector(
    '[aria-label="Edit comment cmt_open"]',
  ) as HTMLButtonElement;

  act(() => {
    editButton.click();
  });

  const editor = result.container.querySelector(
    '[aria-label="Comment body for cmt_open"]',
  ) as HTMLTextAreaElement;

  act(() => {
    editor.value = "   ";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const saveButton = result.container.querySelector(
    '[aria-label="Save comment cmt_open"]',
  ) as HTMLButtonElement;

  act(() => {
    saveButton.click();
  });

  expect(onUpdateComment).not.toHaveBeenCalled();
  expect(result.container.querySelector('[role="alert"]')?.textContent).toBe(
    "Comment body cannot be empty.",
  );
  result.unmount();
});

test("CommentSidebarは編集をキャンセルすると元の本文表示へ戻る", () => {
  const result = renderReadySidebar();
  const editButton = result.container.querySelector(
    '[aria-label="Edit comment cmt_open"]',
  ) as HTMLButtonElement;

  act(() => {
    editButton.click();
  });

  const editor = result.container.querySelector(
    '[aria-label="Comment body for cmt_open"]',
  ) as HTMLTextAreaElement;

  act(() => {
    editor.value = "Temporary draft";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const cancelButton = result.container.querySelector(
    '[aria-label="Cancel editing comment cmt_open"]',
  ) as HTMLButtonElement;

  act(() => {
    cancelButton.click();
  });

  expect(result.container.textContent).toContain(
    "Clarify what counts as an active comment highlight.",
  );
  expect(result.container.querySelector("textarea")).toBeNull();
  result.unmount();
});

test("CommentSidebarは確認後にコメント削除を発火する", () => {
  const onDeleteComment = vi.fn();
  const result = renderReadySidebar({ onDeleteComment });
  const deleteButton = result.container.querySelector(
    '[aria-label="Delete comment cmt_open"]',
  ) as HTMLButtonElement;

  act(() => {
    deleteButton.click();
  });

  expect(result.container.textContent).toContain(
    "Delete this comment permanently?",
  );

  const confirmButton = result.container.querySelector(
    '[aria-label="Confirm delete comment cmt_open"]',
  ) as HTMLButtonElement;

  act(() => {
    confirmButton.click();
  });

  expect(onDeleteComment).toHaveBeenCalledWith("cmt_open");
  result.unmount();
});
