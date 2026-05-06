import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type {
  Comment,
  CommentAnchor,
  CommentAnchorDisplayState,
  CommentExportScope,
  CommentId,
} from "../types/comment";
import { CommentSidebar, type CommentExportState } from "./CommentSidebar";

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

const fuzzyComment: Comment = {
  ...openComment,
  id: "cmt_fuzzy",
  body: "Re-check this moved paragraph before final review.",
  createdAt: "2026-05-05T12:00:00Z",
  updatedAt: "2026-05-05T12:15:00Z",
};

const staleComment: Comment = {
  ...openComment,
  id: "cmt_stale",
  body: "Original snippet changed after this comment was created.",
  createdAt: "2026-05-05T13:00:00Z",
  updatedAt: "2026-05-05T13:15:00Z",
};

const orphanedComment: Comment = {
  ...openComment,
  id: "cmt_orphaned",
  body: "This anchor can no longer be found in the document.",
  createdAt: "2026-05-05T14:00:00Z",
  updatedAt: "2026-05-05T14:15:00Z",
};

const overviewComment: Comment = {
  ...openComment,
  id: "cmt_overview",
  anchor: {
    ...anchor,
    fileKey: "design",
    textSnippet: "Searchable orphaned snippet for release notes",
  },
  body: "Summarize release risk for reviewers.",
  createdAt: "2026-05-05T15:00:00Z",
  updatedAt: "2026-05-05T15:15:00Z",
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
    exportState?: CommentExportState;
    onExportComments?: (scope: CommentExportScope) => void;
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
      exportState={
        options.exportState ?? {
          status: "idle",
          operation: null,
          message: null,
        }
      }
      activeCommentId={options.activeCommentId ?? null}
      anchorDisplayStates={options.anchorDisplayStates ?? []}
      onSelectComment={options.onSelectComment ?? vi.fn()}
      onResolveComment={options.onResolveComment ?? vi.fn()}
      onReopenComment={options.onReopenComment ?? vi.fn()}
      onDeleteComment={options.onDeleteComment ?? vi.fn()}
      onUpdateComment={options.onUpdateComment ?? vi.fn()}
      onReload={vi.fn()}
      onExportComments={options.onExportComments}
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
  expect(
    result.container.querySelectorAll(".loading-skeleton__bar").length,
  ).toBeGreaterThan(0);
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

test("CommentSidebarは矢印キーで隣のcomment threadを選択する", () => {
  const onSelectComment = vi.fn();
  const result = renderReadySidebar({ onSelectComment });
  const selectors = result.container.querySelectorAll(
    ".comment-thread__select",
  );

  act(() => {
    (selectors[0] as HTMLButtonElement).focus();
    selectors[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
  });

  expect(document.activeElement).toBe(selectors[1]);
  expect(onSelectComment).toHaveBeenCalledWith("cmt_resolved");
  result.unmount();
});

test("CommentSidebarはコメントexport操作を発火して状態を表示する", () => {
  const onExportComments = vi.fn();
  const result = renderReadySidebar({
    exportState: {
      status: "success",
      operation: "file",
      message: "Exported 2 comments to /tmp/tasks-comments.md",
    },
    onExportComments,
  });
  const fileExportButton = result.container.querySelector(
    '[aria-label="Export current file comments"]',
  ) as HTMLButtonElement;
  const specExportButton = result.container.querySelector(
    '[aria-label="Export current spec comments"]',
  ) as HTMLButtonElement;
  const workspaceExportButton = result.container.querySelector(
    '[aria-label="Export workspace comments"]',
  ) as HTMLButtonElement;

  act(() => {
    fileExportButton.click();
    specExportButton.click();
    workspaceExportButton.click();
  });

  expect(onExportComments).toHaveBeenNthCalledWith(1, "file");
  expect(onExportComments).toHaveBeenNthCalledWith(2, "spec");
  expect(onExportComments).toHaveBeenNthCalledWith(3, "workspace");
  expect(result.container.querySelector('[role="status"]')?.textContent).toBe(
    "Exported 2 comments to /tmp/tasks-comments.md",
  );
  result.unmount();
});

test("CommentSidebarはexport失敗をalertで表示する", () => {
  const result = renderReadySidebar({
    exportState: {
      status: "error",
      operation: "workspace",
      message: "failed to write comment export",
    },
    onExportComments: vi.fn(),
  });

  expect(result.container.querySelector('[role="alert"]')?.textContent).toBe(
    "failed to write comment export",
  );
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

test("CommentSidebarはreconciliationのアンカー状態を表示する", () => {
  const result = renderReadySidebar({
    anchorDisplayStates: [
      {
        commentId: "cmt_open",
        status: "moved",
      },
      {
        commentId: "cmt_resolved",
        status: "orphaned",
      },
    ],
  });

  expect(result.container.textContent).toContain("Anchor moved");
  expect(result.container.textContent).toContain("Anchor orphaned");
  result.unmount();
});

test("CommentSidebarは選択した状態フィルターのコメントだけを表示する", () => {
  const result = renderReadySidebar({
    comments: [openComment, resolvedComment],
  });
  const resolvedFilter = result.container.querySelector(
    '[aria-label="Show resolved comments"]',
  ) as HTMLButtonElement;

  act(() => {
    resolvedFilter.click();
  });

  expect(resolvedFilter.getAttribute("aria-pressed")).toBe("true");
  expect(result.container.textContent).toContain(
    "This acceptance item is covered.",
  );
  expect(result.container.textContent).not.toContain(
    "Clarify what counts as an active comment highlight.",
  );
  result.unmount();
});

test("CommentSidebarはアンカー状態フィルターの件数と空状態を表示する", () => {
  const result = renderReadySidebar({
    comments: [openComment, fuzzyComment, staleComment, orphanedComment],
    anchorDisplayStates: [
      {
        commentId: "cmt_fuzzy",
        status: "fuzzy",
      },
      {
        commentId: "cmt_stale",
        status: "stale",
      },
      {
        commentId: "cmt_orphaned",
        status: "orphaned",
      },
    ],
  });
  const fuzzyFilter = result.container.querySelector(
    '[aria-label="Show fuzzy anchor comments"]',
  ) as HTMLButtonElement;
  const resolvedFilter = result.container.querySelector(
    '[aria-label="Show resolved comments"]',
  ) as HTMLButtonElement;

  expect(fuzzyFilter.textContent).toBe("Fuzzy1");

  act(() => {
    fuzzyFilter.click();
  });

  expect(result.container.textContent).toContain(
    "Re-check this moved paragraph before final review.",
  );
  expect(result.container.textContent).not.toContain(
    "Original snippet changed after this comment was created.",
  );

  act(() => {
    resolvedFilter.click();
  });

  expect(result.container.textContent).toContain(
    "No comments match the Resolved filter.",
  );
  result.unmount();
});

test("CommentSidebarは検索語でコメント本文を絞り込み件数とクリアボタンを表示する", () => {
  const result = renderReadySidebar({
    comments: [openComment, resolvedComment, overviewComment],
  });
  const searchInput = result.container.querySelector(
    '[aria-label="Search comments"]',
  ) as HTMLInputElement;

  act(() => {
    searchInput.value = "release risk";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const clearButton = result.container.querySelector(
    '[aria-label="Clear comment search"]',
  ) as HTMLButtonElement;

  expect(result.container.textContent).toContain("1 result");
  expect(result.container.textContent).toContain(
    "Summarize release risk for reviewers.",
  );
  expect(result.container.textContent).not.toContain(
    "Clarify what counts as an active comment highlight.",
  );
  expect(result.container.querySelectorAll("mark").length).toBeGreaterThan(0);

  act(() => {
    clearButton.click();
  });

  expect(searchInput.value).toBe("");
  expect(result.container.textContent).toContain(
    "Clarify what counts as an active comment highlight.",
  );
  result.unmount();
});

test("CommentSidebarはfile keyとorphaned snippetと状態ラベルを検索対象にする", () => {
  const result = renderReadySidebar({
    comments: [openComment, resolvedComment, overviewComment, orphanedComment],
    anchorDisplayStates: [
      {
        commentId: "cmt_overview",
        status: "orphaned",
      },
    ],
  });
  const searchInput = result.container.querySelector(
    '[aria-label="Search comments"]',
  ) as HTMLInputElement;

  act(() => {
    searchInput.value = "design";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  expect(result.container.textContent).toContain(
    "Summarize release risk for reviewers.",
  );
  expect(result.container.textContent).not.toContain(
    "This anchor can no longer be found in the document.",
  );

  act(() => {
    searchInput.value = "searchable orphaned snippet";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  expect(result.container.textContent).toContain(
    "Summarize release risk for reviewers.",
  );

  act(() => {
    searchInput.value = "anchor orphaned";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  expect(result.container.textContent).toContain(
    "Summarize release risk for reviewers.",
  );
  result.unmount();
});

test("CommentSidebarは検索とフィルターを組み合わせて一致なし状態を表示する", () => {
  const result = renderReadySidebar({
    comments: [openComment, resolvedComment],
  });
  const resolvedFilter = result.container.querySelector(
    '[aria-label="Show resolved comments"]',
  ) as HTMLButtonElement;
  const searchInput = result.container.querySelector(
    '[aria-label="Search comments"]',
  ) as HTMLInputElement;

  act(() => {
    resolvedFilter.click();
  });

  act(() => {
    searchInput.value = "active comment";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  expect(result.container.textContent).toContain("No comments match");
  expect(result.container.textContent).toContain("active comment");
  expect(result.container.textContent).toContain("Resolved filter");
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
