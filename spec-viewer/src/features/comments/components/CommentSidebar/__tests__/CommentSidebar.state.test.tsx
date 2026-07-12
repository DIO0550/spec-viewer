import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type {
  Comment,
  CommentAnchor,
  CommentAnchorDisplayState,
  CommentExportScope,
  CommentId,
} from "@/features/comments/types/comment";
import { CommentId as CommentIdValue } from "@/features/comments/types/comment";
import {
  type CommentExportState,
  CommentSidebar,
} from "@/features/comments/components/CommentSidebar";
import { toCommentFeatureError } from "@/features/comments/infra/tauri/commentErrorMapper";

const commentId = CommentIdValue.fromString;

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
  id: commentId("cmt_open"),
  anchor,
  body: "Clarify what counts as an active comment highlight.",
  status: "open",
  resolved: false,
  createdAt: "2026-05-05T10:00:00Z",
  updatedAt: "2026-05-05T10:15:00Z",
};

const resolvedComment: Comment = {
  ...openComment,
  id: commentId("cmt_resolved"),
  body: "This acceptance item is covered.",
  status: "resolved",
  resolved: true,
  createdAt: "2026-05-05T11:00:00Z",
  updatedAt: "2026-05-05T11:30:00Z",
};

const fuzzyComment: Comment = {
  ...openComment,
  id: commentId("cmt_fuzzy"),
  body: "Re-check this moved paragraph before final review.",
  createdAt: "2026-05-05T12:00:00Z",
  updatedAt: "2026-05-05T12:15:00Z",
};

const staleComment: Comment = {
  ...openComment,
  id: commentId("cmt_stale"),
  body: "Original snippet changed after this comment was created.",
  createdAt: "2026-05-05T13:00:00Z",
  updatedAt: "2026-05-05T13:15:00Z",
};

const orphanedComment: Comment = {
  ...openComment,
  id: commentId("cmt_orphaned"),
  body: "This anchor can no longer be found in the document.",
  createdAt: "2026-05-05T14:00:00Z",
  updatedAt: "2026-05-05T14:15:00Z",
};

const overviewComment: Comment = {
  ...openComment,
  id: commentId("cmt_overview"),
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
    onCopyLlmPrompt?: (scope: CommentExportScope) => void;
    onCopyMcpFeedback?: () => void;
    onReload?: () => void;
  }> = {},
): RenderResult {
  return renderComponent(
    <CommentSidebar
      listState={{
        status: "ready",
        comments: options.comments ?? [openComment, resolvedComment],
        error: null,
      }}
      operationState={{
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
      onReload={options.onReload ?? vi.fn()}
      onExportComments={options.onExportComments}
      onCopyLlmPrompt={options.onCopyLlmPrompt}
      onCopyMcpFeedback={options.onCopyMcpFeedback}
    />,
  );
}

function renderEmptySidebar(
  options: Readonly<{
    exportState?: CommentExportState;
    onExportComments?: (scope: CommentExportScope) => void;
    onCopyLlmPrompt?: (scope: CommentExportScope) => void;
    onCopyMcpFeedback?: () => void;
  }> = {},
): RenderResult {
  return renderComponent(
    <CommentSidebar
      listState={{
        status: "empty",
        comments: [],
        error: null,
      }}
      operationState={{
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
      activeCommentId={null}
      onSelectComment={vi.fn()}
      onResolveComment={vi.fn()}
      onReopenComment={vi.fn()}
      onDeleteComment={vi.fn()}
      onUpdateComment={vi.fn()}
      onReload={vi.fn()}
      onExportComments={options.onExportComments}
      onCopyLlmPrompt={options.onCopyLlmPrompt}
      onCopyMcpFeedback={options.onCopyMcpFeedback}
    />,
  );
}

function openSecondaryActions(result: RenderResult): void {
  const moreButton = result.container.querySelector(
    '[aria-label="その他"]',
  ) as HTMLButtonElement;

  act(() => {
    moreButton.click();
  });
}

test("CommentSidebarは読み込み中状態をrole statusで表示する", () => {
  const result = renderComponent(
    <CommentSidebar
      listState={{
        status: "loading",
        comments: [],
        error: null,
      }}
      operationState={{
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
    "コメントを読み込み中",
  );
  expect(
    result.container.querySelectorAll(".loading-skeleton__bar").length,
  ).toBeGreaterThan(0);
  result.unmount();
});

test("CommentSidebarはヘッダーの再読み込み操作を発火する", () => {
  const onReload = vi.fn();
  const result = renderReadySidebar({ onReload });
  const reloadButton = result.container.querySelector(
    '[aria-label="コメントを再読み込み"]',
  ) as HTMLButtonElement;

  act(() => {
    reloadButton.click();
  });

  expect(onReload).toHaveBeenCalledTimes(1);

  result.unmount();
});

test("CommentSidebarは未選択scopeでは空の案内を表示する", () => {
  const result = renderComponent(
    <CommentSidebar
      listState={{
        status: "idle",
        comments: [],
        error: null,
      }}
      operationState={{
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

  expect(result.container.textContent).toContain("Specファイルを選択");
  result.unmount();
});

test("CommentSidebarは読み込み失敗をalertで表示して再読み込みできる", () => {
  const onReload = vi.fn();
  const result = renderComponent(
    <CommentSidebar
      listState={{
        status: "error",
        comments: [],
        error: toCommentFeatureError("list", {
          code: "commentRepository",
          message: "Comment store could not be read.",
        }),
      }}
      operationState={{
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
  const result = renderEmptySidebar();

  expect(result.container.textContent).toContain("コメントはまだありません");
  expect(result.container.textContent).toContain(
    "Markdown本文の行にあるコメントボタンから追加できます",
  );
  result.unmount();
});

test("CommentSidebarは空状態でexport操作を常設表示しない", () => {
  const result = renderEmptySidebar({
    onExportComments: vi.fn(),
    onCopyLlmPrompt: vi.fn(),
    onCopyMcpFeedback: vi.fn(),
  });

  expect(result.container.textContent).toContain("コメントはまだありません");
  expect(
    result.container.querySelector(
      '[aria-label="このファイルのコメントを書き出す"]',
    ),
  ).toBeNull();
  expect(
    result.container.querySelector(
      '[aria-label="ファイルのAI用プロンプトをコピー"]',
    ),
  ).toBeNull();

  openSecondaryActions(result);

  expect(
    result.container.querySelector(
      '[aria-label="このファイルのコメントを書き出す"]',
    ),
  ).not.toBeNull();
  expect(
    result.container.querySelector(
      '[aria-label="ファイルのAI用プロンプトをコピー"]',
    ),
  ).not.toBeNull();
  result.unmount();
});

test("CommentSidebarはopenとresolvedの件数とコメント本文を表示する", () => {
  const result = renderReadySidebar();

  expect(result.container.textContent).toContain("未解決1");
  expect(result.container.textContent).toContain("解決済み1");
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
  const onCopyLlmPrompt = vi.fn();
  const onCopyMcpFeedback = vi.fn();
  const result = renderReadySidebar({
    exportState: {
      status: "success",
      operation: "file",
      message: "Exported 2 comments to /tmp/tasks-comments.md",
    },
    onExportComments,
    onCopyLlmPrompt,
    onCopyMcpFeedback,
  });

  expect(
    result.container.querySelector(
      '[aria-label="このファイルのコメントを書き出す"]',
    ),
  ).toBeNull();

  openSecondaryActions(result);

  const fileExportButton = result.container.querySelector(
    '[aria-label="このファイルのコメントを書き出す"]',
  ) as HTMLButtonElement;
  const specExportButton = result.container.querySelector(
    '[aria-label="この仕様のコメントを書き出す"]',
  ) as HTMLButtonElement;
  const workspaceExportButton = result.container.querySelector(
    '[aria-label="ワークスペースのコメントを書き出す"]',
  ) as HTMLButtonElement;
  const filePromptButton = result.container.querySelector(
    '[aria-label="ファイルのAI用プロンプトをコピー"]',
  ) as HTMLButtonElement;
  const mcpFeedbackButton = result.container.querySelector(
    '[aria-label="現在のファイルのMCP feedback payloadをコピー"]',
  ) as HTMLButtonElement;

  act(() => {
    fileExportButton.click();
    specExportButton.click();
    workspaceExportButton.click();
    filePromptButton.click();
    mcpFeedbackButton.click();
  });

  expect(onExportComments).toHaveBeenNthCalledWith(1, "file");
  expect(onExportComments).toHaveBeenNthCalledWith(2, "spec");
  expect(onExportComments).toHaveBeenNthCalledWith(3, "workspace");
  expect(onCopyLlmPrompt).toHaveBeenCalledWith("file");
  expect(onCopyMcpFeedback).toHaveBeenCalledTimes(1);
  expect(result.container.querySelector('[role="status"]')?.textContent).toBe(
    "Exported 2 comments to /tmp/tasks-comments.md",
  );
  result.unmount();
});

test("CommentSidebarはMCP feedback dry-runコピー中状態を表示する", () => {
  const result = renderReadySidebar({
    exportState: {
      status: "saving",
      operation: "mcpFeedback",
      message: "Preparing MCP feedback dry-run payload",
    },
    onCopyMcpFeedback: vi.fn(),
  });

  openSecondaryActions(result);

  const mcpFeedbackButton = result.container.querySelector(
    '[aria-label="現在のファイルのMCP feedback payloadをコピー"]',
  ) as HTMLButtonElement;

  expect(mcpFeedbackButton.disabled).toBe(true);
  expect(mcpFeedbackButton.textContent).toContain("コピー中");
  result.unmount();
});

test("CommentSidebarはAI適用placeholderをdisabledで表示する", () => {
  const result = renderReadySidebar({
    onCopyLlmPrompt: vi.fn(),
  });

  openSecondaryActions(result);

  const applyWithAiButton = result.container.querySelector(
    '[aria-label="コメントをAIで適用"]',
  ) as HTMLButtonElement;

  expect(applyWithAiButton.disabled).toBe(true);
  expect(applyWithAiButton.textContent).toContain("AI適用");
  expect(result.container.textContent).toContain(
    "AI用プロンプトのコピーは利用できます。AI適用はprovider連携で差分プレビューを生成できるようになってから有効になります。",
  );
  expect(result.container.textContent).toContain(
    "Markdownの書き込みには明示的な確認が必要です。",
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
  const result = renderReadySidebar({ activeCommentId: commentId("cmt_open") });
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
        commentId: commentId("cmt_open"),
        status: "moved",
      },
      {
        commentId: commentId("cmt_resolved"),
        status: "orphaned",
      },
    ],
  });

  expect(result.container.textContent).toContain("アンカー移動");
  expect(result.container.textContent).toContain("位置不明アンカー");
  result.unmount();
});

test("CommentSidebarは選択した状態フィルターのコメントだけを表示する", () => {
  const result = renderReadySidebar({
    comments: [openComment, resolvedComment],
  });
  const resolvedFilter = result.container.querySelector(
    '[aria-label="解決済みコメントを表示"]',
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
        commentId: commentId("cmt_fuzzy"),
        status: "fuzzy",
      },
      {
        commentId: commentId("cmt_stale"),
        status: "stale",
      },
      {
        commentId: commentId("cmt_orphaned"),
        status: "orphaned",
      },
    ],
  });
  const fuzzyFilter = result.container.querySelector(
    '[aria-label="曖昧なアンカーのコメントを表示"]',
  ) as HTMLButtonElement;
  const resolvedFilter = result.container.querySelector(
    '[aria-label="解決済みコメントを表示"]',
  ) as HTMLButtonElement;

  expect(fuzzyFilter.textContent).toBe("曖昧1");

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
    "解決済みフィルターに一致するコメントはありません。",
  );
  result.unmount();
});

test("CommentSidebarは検索語でコメント本文を絞り込み件数とクリアボタンを表示する", () => {
  const result = renderReadySidebar({
    comments: [openComment, resolvedComment, overviewComment],
  });
  const searchInput = result.container.querySelector(
    '[aria-label="コメント検索"]',
  ) as HTMLInputElement;

  act(() => {
    searchInput.value = "release risk";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const clearButton = result.container.querySelector(
    '[aria-label="コメント検索をクリア"]',
  ) as HTMLButtonElement;

  expect(result.container.textContent).toContain("1件");
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
        commentId: commentId("cmt_overview"),
        status: "orphaned",
      },
    ],
  });
  const searchInput = result.container.querySelector(
    '[aria-label="コメント検索"]',
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
    searchInput.value = "位置不明アンカー";
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
    '[aria-label="解決済みコメントを表示"]',
  ) as HTMLButtonElement;
  const searchInput = result.container.querySelector(
    '[aria-label="コメント検索"]',
  ) as HTMLInputElement;

  act(() => {
    resolvedFilter.click();
  });

  act(() => {
    searchInput.value = "active comment";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  expect(result.container.textContent).toContain(
    "に一致するコメントはありません。",
  );
  expect(result.container.textContent).toContain("active comment");
  expect(result.container.textContent).toContain("解決済み");
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
    '[aria-label="コメントを選択 cmt_open"]',
  ) as HTMLButtonElement;
  const resolveButton = result.container.querySelector(
    '[aria-label="解決する cmt_open"]',
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
    '[aria-label="再オープン cmt_resolved"]',
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
    '[aria-label="コメントを編集 cmt_open"]',
  ) as HTMLButtonElement;

  act(() => {
    editButton.click();
  });

  const editor = result.container.querySelector(
    '[aria-label="コメント本文 cmt_open"]',
  ) as HTMLTextAreaElement;

  act(() => {
    editor.value = "Clarify the acceptance detail before merge.";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const saveButton = result.container.querySelector(
    '[aria-label="保存 cmt_open"]',
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
    '[aria-label="コメントを編集 cmt_open"]',
  ) as HTMLButtonElement;

  act(() => {
    editButton.click();
  });

  const editor = result.container.querySelector(
    '[aria-label="コメント本文 cmt_open"]',
  ) as HTMLTextAreaElement;

  act(() => {
    editor.value = "   ";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const saveButton = result.container.querySelector(
    '[aria-label="保存 cmt_open"]',
  ) as HTMLButtonElement;

  act(() => {
    saveButton.click();
  });

  expect(onUpdateComment).not.toHaveBeenCalled();
  expect(result.container.querySelector('[role="alert"]')?.textContent).toBe(
    "コメント本文を入力してください。",
  );
  result.unmount();
});

test("CommentSidebarは編集をキャンセルすると元の本文表示へ戻る", () => {
  const result = renderReadySidebar();
  const editButton = result.container.querySelector(
    '[aria-label="コメントを編集 cmt_open"]',
  ) as HTMLButtonElement;

  act(() => {
    editButton.click();
  });

  const editor = result.container.querySelector(
    '[aria-label="コメント本文 cmt_open"]',
  ) as HTMLTextAreaElement;

  act(() => {
    editor.value = "Temporary draft";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const cancelButton = result.container.querySelector(
    '[aria-label="キャンセル cmt_open"]',
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
    '[aria-label="削除 cmt_open"]',
  ) as HTMLButtonElement;

  act(() => {
    deleteButton.click();
  });

  expect(result.container.textContent).toContain(
    "このコメントを完全に削除しますか？",
  );

  const confirmButton = result.container.querySelector(
    '[aria-label="コメント削除を確定 cmt_open"]',
  ) as HTMLButtonElement;

  act(() => {
    confirmButton.click();
  });

  expect(onDeleteComment).toHaveBeenCalledWith("cmt_open");
  result.unmount();
});
