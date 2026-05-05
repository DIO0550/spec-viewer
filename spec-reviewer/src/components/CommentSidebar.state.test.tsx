import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type { Comment, CommentAnchor, CommentId } from "../types/comment";
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
    onSelectComment?: (commentId: CommentId) => void;
    onResolveComment?: (commentId: CommentId) => void;
    onReopenComment?: (commentId: CommentId) => void;
    onDeleteComment?: (commentId: CommentId) => void;
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
      onSelectComment={options.onSelectComment ?? vi.fn()}
      onResolveComment={options.onResolveComment ?? vi.fn()}
      onReopenComment={options.onReopenComment ?? vi.fn()}
      onDeleteComment={options.onDeleteComment ?? vi.fn()}
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

  expect(activeButton.textContent).toContain(
    "Clarify what counts as an active comment highlight.",
  );
  result.unmount();
});

test("CommentSidebarはコメント選択とresolveとdelete操作を発火する", () => {
  const onSelectComment = vi.fn();
  const onResolveComment = vi.fn();
  const onDeleteComment = vi.fn();
  const result = renderReadySidebar({
    onSelectComment,
    onResolveComment,
    onDeleteComment,
  });
  const selectButton = result.container.querySelector(
    '[aria-label="Select comment cmt_open"]',
  ) as HTMLButtonElement;
  const resolveButton = result.container.querySelector(
    '[aria-label="Resolve comment cmt_open"]',
  ) as HTMLButtonElement;
  const deleteButton = result.container.querySelector(
    '[aria-label="Delete comment cmt_open"]',
  ) as HTMLButtonElement;

  act(() => {
    selectButton.click();
    resolveButton.click();
    deleteButton.click();
  });

  expect(onSelectComment).toHaveBeenCalledWith("cmt_open");
  expect(onResolveComment).toHaveBeenCalledWith("cmt_open");
  expect(onDeleteComment).toHaveBeenCalledWith("cmt_open");
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
