import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type { SpecDocumentState } from "../hooks/useSpecs";
import { createTextHash } from "../lib/comment-anchor-draft";
import type { Comment, CommentAnchorResolution } from "../types/comment";
import type { MarkdownBlockMetadata, SpecDocument } from "../types/spec";
import { MarkdownViewer } from "./MarkdownViewer";

const workspacePath = "/workspace/spec-reviewer";
const selectedSpecLabel = "Phase 1 Viewer";
const selectedFileLabel = "Tasks";

const richMarkdown = [
  "## Rendering Plan",
  "",
  "A paragraph with [docs](https://example.com/docs) and `<inline>` code.",
  "",
  "> Keep quoted context visible.",
  "",
  "- [x] Render Markdown",
  "- [ ] Keep task lists read-only",
  "",
  "```ts",
  "const enabled = true;",
  "```",
  "",
  "| Area | Status |",
  "| --- | --- |",
  "| Viewer | Ready |",
  "",
  "<script>alert('nope')</script>",
].join("\n");

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

function createReadyState(
  contents: string | null,
  blocks: readonly MarkdownBlockMetadata[] = [],
): SpecDocumentState {
  const document: SpecDocument = {
    key: "tasks",
    path: "/workspace/spec-reviewer/docs/plans/tasks.md",
    contents,
    missing: false,
    blocks,
  };

  return {
    status: "ready",
    workspacePath,
    specId: "phase-1-viewer",
    fileKey: "tasks",
    document,
    error: null,
  };
}

function createComment({
  id,
  blockIndex,
  text,
  resolved,
  anchorResolution = null,
  charRange = {
    start: 0,
    end: text.length,
  },
}: Readonly<{
  id: string;
  blockIndex: number;
  text: string;
  resolved: boolean;
  anchorResolution?: CommentAnchorResolution | null;
  charRange?: Readonly<{
    start: number;
    end: number;
  }>;
}>): Comment {
  return {
    id,
    anchor: {
      fileKey: "tasks",
      blockType: "paragraph",
      blockIndex,
      textHash: createTextHash(text),
      textSnippet: text,
      charRange,
    },
    body: `${id} body`,
    status: resolved ? "resolved" : "open",
    resolved,
    anchorResolution,
    createdAt: "2026-05-05T10:00:00Z",
    updatedAt: "2026-05-05T10:00:00Z",
  };
}

function renderViewer(
  state: SpecDocumentState,
  onReload = vi.fn(),
  onAddComment = vi.fn().mockResolvedValue(true),
  comments: readonly Comment[] = [],
  activeCommentId: string | null = null,
  onSelectComment = vi.fn(),
): RenderResult {
  return renderComponent(
    <MarkdownViewer
      state={state}
      selectedSpecLabel={selectedSpecLabel}
      selectedFileLabel={selectedFileLabel}
      comments={comments}
      activeCommentId={activeCommentId}
      onReload={onReload}
      onAddComment={onAddComment}
      onSelectComment={onSelectComment}
    />,
  );
}

test("MarkdownViewerはGFM要素を安全なHTMLとして表示する", () => {
  const result = renderViewer(createReadyState(richMarkdown));

  expect(result.container.querySelector("h2")?.textContent).toBe(
    "Rendering Plan",
  );
  expect(result.container.querySelector("blockquote")?.textContent).toContain(
    "Keep quoted context visible.",
  );
  expect(result.container.querySelector("pre code")?.textContent).toContain(
    "const enabled = true;",
  );
  expect(result.container.querySelector("table")?.textContent).toContain(
    "Viewer",
  );
  expect(result.container.querySelector("a")?.getAttribute("href")).toBe(
    "https://example.com/docs",
  );
  expect(result.container.querySelector("script")).toBeNull();
  result.unmount();
});

test("MarkdownViewerは言語指定されたコードブロックにシンタックスハイライト用classを付与する", () => {
  const result = renderViewer(createReadyState(richMarkdown));
  const codeBlock = result.container.querySelector("pre code");

  expect(codeBlock?.classList.contains("hljs")).toBe(true);
  expect(codeBlock?.querySelector(".hljs-keyword")?.textContent).toBe("const");
  result.unmount();
});

test("MarkdownViewerはタスクリストを読み取り専用として表示する", () => {
  const result = renderViewer(createReadyState(richMarkdown));
  const checkboxes = result.container.querySelectorAll(
    'input[type="checkbox"]',
  );

  expect(checkboxes).toHaveLength(2);
  expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
  expect((checkboxes[0] as HTMLInputElement).disabled).toBe(true);
  expect((checkboxes[1] as HTMLInputElement).disabled).toBe(true);
  result.unmount();
});

test("MarkdownViewerはコメントアンカー用のブロックメタデータを文書順で付与する", () => {
  const result = renderViewer(createReadyState(richMarkdown));
  const renderedDocument = result.container.querySelector(".markdown-rendered");
  const blockElements = Array.from(
    renderedDocument?.querySelectorAll("[data-block-type]") ?? [],
  );

  expect(
    blockElements.map((element) => element.getAttribute("data-block-type")),
  ).toEqual([
    "heading",
    "paragraph",
    "paragraph",
    "list-item",
    "list-item",
    "code",
    "table",
  ]);
  expect(
    blockElements.map((element) => element.getAttribute("data-block-index")),
  ).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
  result.unmount();
});

test("MarkdownViewerはbackend block metadataをコメントアンカー用data属性に反映する", () => {
  const blocks: readonly MarkdownBlockMetadata[] = [
    {
      blockType: "paragraph",
      blockIndex: 5,
      textHash: "sha256:backend5",
      textSnippet: "A paragraph with selectable text.",
      sourceRange: {
        startByteOffset: 10,
        endByteOffset: 43,
      },
    },
  ];
  const result = renderViewer(
    createReadyState("A paragraph with selectable text.", blocks),
  );
  const paragraph = result.container.querySelector(".markdown-rendered p");

  expect(paragraph?.getAttribute("data-block-index")).toBe("5");
  expect(paragraph?.getAttribute("data-comment-block-type")).toBe("paragraph");
  expect(paragraph?.getAttribute("data-text-hash")).toBe("sha256:backend5");
  expect(paragraph?.getAttribute("data-source-start-byte-offset")).toBe("10");
  expect(paragraph?.getAttribute("data-source-end-byte-offset")).toBe("43");
  result.unmount();
});

test("MarkdownViewerはコメント付きブロックを状態別にハイライトして選択できる", () => {
  const onSelectComment = vi.fn();
  const contents = [
    "## Highlight Plan",
    "",
    "Open comments should remain prominent.",
    "",
    "Resolved comments should stay quieter.",
  ].join("\n");
  const comments: readonly Comment[] = [
    createComment({
      id: "cmt_open",
      blockIndex: 1,
      text: "Open comments should remain prominent.",
      resolved: false,
    }),
    createComment({
      id: "cmt_resolved",
      blockIndex: 2,
      text: "Resolved comments should stay quieter.",
      resolved: true,
    }),
  ];
  const result = renderViewer(
    createReadyState(contents),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    comments,
    "cmt_open",
    onSelectComment,
  );
  const highlightedBlocks = result.container.querySelectorAll(
    '[data-comment-highlight="true"]',
  );
  const activeBlock = result.container.querySelector(
    '[data-comment-highlight-state="active"]',
  ) as HTMLElement;
  const resolvedBlock = result.container.querySelector(
    '[data-comment-highlight-state="resolved"]',
  );

  expect(highlightedBlocks).toHaveLength(2);
  expect(activeBlock.textContent).toContain(
    "Open comments should remain prominent.",
  );
  expect(resolvedBlock?.textContent).toContain(
    "Resolved comments should stay quieter.",
  );

  act(() => {
    activeBlock.click();
  });

  expect(onSelectComment).toHaveBeenCalledWith("cmt_open");
  result.unmount();
});

test("MarkdownViewerは既存コメントを本文右側のカードとして表示して選択できる", () => {
  const onSelectComment = vi.fn();
  const contents = "Existing comments should be visible beside the paragraph.";
  const comments: readonly Comment[] = [
    createComment({
      id: "cmt_open",
      blockIndex: 0,
      text: contents,
      resolved: false,
    }),
    createComment({
      id: "cmt_resolved",
      blockIndex: 0,
      text: contents,
      resolved: true,
    }),
  ];
  const result = renderViewer(
    createReadyState(contents),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    comments,
    "cmt_resolved",
    onSelectComment,
  );
  const annotationCards = result.container.querySelectorAll(
    ".markdown-comment-annotation",
  );
  const activeAnnotation = result.container.querySelector(
    '.markdown-comment-annotation[data-active="true"]',
  ) as HTMLButtonElement;

  expect(annotationCards).toHaveLength(2);
  expect(annotationCards[0]?.textContent).toContain("未解決");
  expect(annotationCards[0]?.textContent).toContain("cmt_open body");
  expect(activeAnnotation.textContent).toContain("解決済み");
  expect(activeAnnotation.textContent).toContain("cmt_resolved body");

  act(() => {
    activeAnnotation.click();
  });

  expect(onSelectComment).toHaveBeenCalledWith("cmt_resolved");
  expect(
    result.container.querySelector(".markdown-block-comment-button"),
  ).not.toBeNull();
  result.unmount();
});

test("MarkdownViewerはstaleとorphanedのコメントアンカー状態を通知する", () => {
  const onAnchorDisplayStatesChange = vi.fn();
  const contents = "A paragraph with changed anchor text.";
  const comments: readonly Comment[] = [
    createComment({
      id: "cmt_stale",
      blockIndex: 0,
      text: "The original anchor text.",
      resolved: false,
    }),
    createComment({
      id: "cmt_orphaned",
      blockIndex: 4,
      text: "A missing anchor.",
      resolved: false,
    }),
  ];
  const result = renderComponent(
    <MarkdownViewer
      state={createReadyState(contents)}
      selectedSpecLabel={selectedSpecLabel}
      selectedFileLabel={selectedFileLabel}
      comments={comments}
      activeCommentId={null}
      onReload={vi.fn()}
      onAddComment={vi.fn().mockResolvedValue(true)}
      onSelectComment={vi.fn()}
      onAnchorDisplayStatesChange={onAnchorDisplayStatesChange}
    />,
  );
  const staleBlock = result.container.querySelector(
    '[data-comment-highlight-state="stale"]',
  );

  expect(staleBlock?.textContent).toContain(
    "A paragraph with changed anchor text.",
  );
  expect(onAnchorDisplayStatesChange).toHaveBeenLastCalledWith([
    {
      commentId: "cmt_stale",
      status: "stale",
    },
    {
      commentId: "cmt_orphaned",
      status: "orphaned",
    },
  ]);
  result.unmount();
});

test("MarkdownViewerはexact解決済みアンカーの選択範囲をハイライトする", () => {
  const contents = "A paragraph with selectable text.";
  const comments: readonly Comment[] = [
    createComment({
      id: "cmt_exact",
      blockIndex: 0,
      text: contents,
      resolved: false,
      charRange: {
        start: 2,
        end: 11,
      },
      anchorResolution: {
        status: "resolved",
        reason: "exact_match",
        details: null,
        target: {
          blockType: "paragraph",
          blockIndex: 0,
          textHash: createTextHash(contents),
          textSnippet: contents,
          sourceRange: null,
          score: 100,
        },
      },
    }),
  ];
  const result = renderViewer(
    createReadyState(contents),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    comments,
  );
  const block = result.container.querySelector(
    '[data-comment-highlight-mode="range"]',
  );
  const range = result.container.querySelector(
    '[data-comment-highlight-range="true"]',
  );

  expect(block?.textContent).toContain(contents);
  expect(range?.textContent).toBe("paragraph");
  result.unmount();
});

test("MarkdownViewerはmoved/fuzzy/orphaned解決結果をtarget blockへ反映する", () => {
  const onAnchorDisplayStatesChange = vi.fn();
  const contents = [
    "Original paragraph moved away.",
    "",
    "Exact target paragraph.",
    "",
    "Fuzzy target paragraph with edits.",
  ].join("\n");
  const comments: readonly Comment[] = [
    createComment({
      id: "cmt_moved",
      blockIndex: 0,
      text: "Original paragraph moved away.",
      resolved: false,
      anchorResolution: {
        status: "moved",
        reason: "moved_by_hash",
        details: null,
        target: {
          blockType: "paragraph",
          blockIndex: 1,
          textHash: createTextHash("Exact target paragraph."),
          textSnippet: "Exact target paragraph.",
          sourceRange: null,
          score: 100,
        },
      },
    }),
    createComment({
      id: "cmt_fuzzy",
      blockIndex: 0,
      text: "Original fuzzy paragraph.",
      resolved: false,
      anchorResolution: {
        status: "fuzzy",
        reason: "fuzzy_match",
        details: "score 82",
        target: {
          blockType: "paragraph",
          blockIndex: 2,
          textHash: createTextHash("Fuzzy target paragraph with edits."),
          textSnippet: "Fuzzy target paragraph with edits.",
          sourceRange: null,
          score: 82,
        },
      },
    }),
    createComment({
      id: "cmt_orphaned",
      blockIndex: 9,
      text: "Deleted paragraph.",
      resolved: false,
      anchorResolution: {
        status: "orphaned",
        reason: "deleted_text",
        details: "deleted",
        target: null,
      },
    }),
  ];
  const result = renderComponent(
    <MarkdownViewer
      state={createReadyState(contents)}
      selectedSpecLabel={selectedSpecLabel}
      selectedFileLabel={selectedFileLabel}
      comments={comments}
      activeCommentId={null}
      onReload={vi.fn()}
      onAddComment={vi.fn().mockResolvedValue(true)}
      onSelectComment={vi.fn()}
      onAnchorDisplayStatesChange={onAnchorDisplayStatesChange}
    />,
  );
  const movedBlock = result.container.querySelector(
    '[data-comment-highlight-state="moved"]',
  );
  const fuzzyBlock = result.container.querySelector(
    '[data-comment-highlight-state="fuzzy"]',
  );

  expect(movedBlock?.textContent).toContain("Exact target paragraph.");
  expect(fuzzyBlock?.textContent).toContain(
    "Fuzzy target paragraph with edits.",
  );
  expect(onAnchorDisplayStatesChange).toHaveBeenLastCalledWith([
    {
      commentId: "cmt_moved",
      status: "moved",
    },
    {
      commentId: "cmt_fuzzy",
      status: "fuzzy",
    },
    {
      commentId: "cmt_orphaned",
      status: "orphaned",
    },
  ]);
  result.unmount();
});

test("MarkdownViewerはMarkdown内の選択から追加コメントを保存する", async () => {
  const onAddComment = vi.fn().mockResolvedValue(true);
  const result = renderViewer(
    createReadyState("A paragraph with selectable text."),
    vi.fn(),
    onAddComment,
  );
  const textNode = result.container.querySelector(
    ".markdown-rendered p",
  )?.firstChild;
  expect(textNode).toBeInstanceOf(Text);

  const range = document.createRange();
  range.setStart(textNode as Text, 2);
  range.setEnd(textNode as Text, 11);
  const selection = document.getSelection();
  expect(selection).not.toBeNull();

  const readySelection = selection as Selection;
  readySelection.removeAllRanges();
  readySelection.addRange(range);

  act(() => {
    document.dispatchEvent(new Event("selectionchange"));
  });

  const addButton = result.container.querySelector(
    ".text-selection-comment-button",
  );
  expect(addButton?.textContent).toContain("コメント追加");

  act(() => {
    addButton?.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    (addButton as HTMLButtonElement).click();
  });

  expect(result.container.textContent).toContain("コメント追加");
  expect(result.container.textContent).toContain(
    "paragraphブロック 1, 文字 2-11",
  );

  const textarea = result.container.querySelector(
    "textarea",
  ) as HTMLTextAreaElement;
  act(() => {
    textarea.value = " Please clarify this. ";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await act(async () => {
    (
      Array.from(result.container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("保存"),
      ) as HTMLButtonElement
    ).click();
  });

  expect(onAddComment).toHaveBeenCalledWith({
    anchor: expect.objectContaining({
      fileKey: "tasks",
      blockType: "paragraph",
      blockIndex: 0,
      textSnippet: "paragraph",
      charRange: {
        start: 2,
        end: 11,
      },
    }),
    body: "Please clarify this.",
  });
  expect(result.container.querySelector("textarea")).toBeNull();
  expect(document.getSelection()?.rangeCount).toBe(0);
  result.unmount();
});

test("MarkdownViewerはコードブロック内の選択から追加コメントを保存する", async () => {
  const onAddComment = vi.fn().mockResolvedValue(true);
  const result = renderViewer(
    createReadyState(["```ts", "const enabled = true;", "```"].join("\n")),
    vi.fn(),
    onAddComment,
  );
  const textNode = result.container.querySelector("pre code")?.childNodes[1];
  expect(textNode).toBeInstanceOf(Text);

  const range = document.createRange();
  range.setStart(textNode as Text, 1);
  range.setEnd(textNode as Text, 8);
  const selection = document.getSelection();
  expect(selection).not.toBeNull();

  const readySelection = selection as Selection;
  readySelection.removeAllRanges();
  readySelection.addRange(range);

  act(() => {
    document.dispatchEvent(new Event("selectionchange"));
  });

  const addButton = result.container.querySelector(
    ".text-selection-comment-button",
  );
  expect(addButton?.textContent).toContain("コメント追加");

  act(() => {
    addButton?.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    (addButton as HTMLButtonElement).click();
  });

  expect(result.container.textContent).toContain("code blockブロック 1");

  const textarea = result.container.querySelector(
    "textarea",
  ) as HTMLTextAreaElement;
  act(() => {
    textarea.value = " Keep this example selectable. ";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await act(async () => {
    (
      Array.from(result.container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("保存"),
      ) as HTMLButtonElement
    ).click();
  });

  expect(onAddComment).toHaveBeenCalledWith({
    anchor: expect.objectContaining({
      fileKey: "tasks",
      blockType: "code_block",
      blockIndex: 0,
      textSnippet: "enabled",
      charRange: {
        start: 6,
        end: 13,
      },
    }),
    body: "Keep this example selectable.",
  });
  expect(result.container.querySelector("textarea")).toBeNull();
  result.unmount();
});

test("MarkdownViewerはハイライト内の部分選択をコメント選択クリックとして扱わない", () => {
  const contents = "A paragraph with selectable text.";
  const onSelectComment = vi.fn();
  const result = renderViewer(
    createReadyState(contents),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    [
      createComment({
        id: "cmt_highlight",
        blockIndex: 0,
        text: contents,
        resolved: false,
        charRange: {
          start: 2,
          end: 11,
        },
      }),
    ],
    null,
    onSelectComment,
  );
  const paragraph = result.container.querySelector(".markdown-rendered p");
  const textNode = paragraph?.querySelector(
    "[data-comment-highlight-range]",
  )?.firstChild;
  expect(paragraph).not.toBeNull();
  expect(textNode).toBeInstanceOf(Text);

  const range = document.createRange();
  range.setStart(textNode as Text, 0);
  range.setEnd(textNode as Text, 9);
  const selection = document.getSelection();
  expect(selection).not.toBeNull();

  const readySelection = selection as Selection;
  readySelection.removeAllRanges();
  readySelection.addRange(range);

  act(() => {
    paragraph?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(readySelection.toString()).toBe("paragraph");
  expect(onSelectComment).not.toHaveBeenCalled();
  readySelection.removeAllRanges();
  result.unmount();
});

test("MarkdownViewerはMarkdownブロックのコメントボタンから追加コメントを保存する", async () => {
  const onAddComment = vi.fn().mockResolvedValue(true);
  const result = renderViewer(
    createReadyState("A paragraph with block comment affordance."),
    vi.fn(),
    onAddComment,
  );
  const addButton = result.container.querySelector(
    ".markdown-block-comment-button",
  ) as HTMLButtonElement;

  act(() => {
    addButton.click();
  });

  expect(result.container.textContent).toContain("コメント追加");
  expect(result.container.textContent).toContain(
    "paragraphブロック 1, 文字 0-42",
  );

  const textarea = result.container.querySelector(
    "textarea",
  ) as HTMLTextAreaElement;
  act(() => {
    textarea.value = " ブロック全体にコメントします。 ";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await act(async () => {
    (
      Array.from(result.container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("保存"),
      ) as HTMLButtonElement
    ).click();
  });

  expect(onAddComment).toHaveBeenCalledWith({
    anchor: expect.objectContaining({
      fileKey: "tasks",
      blockType: "paragraph",
      blockIndex: 0,
      textSnippet: "A paragraph with block comment affordance.",
      charRange: {
        start: 0,
        end: 42,
      },
    }),
    body: "ブロック全体にコメントします。",
  });
  result.unmount();
});

test("MarkdownViewerはコードブロックのコメントボタンから追加popoverを開く", () => {
  const result = renderViewer(
    createReadyState(["```ts", "const enabled = true;", "```"].join("\n")),
  );
  const codeBlock = result.container.querySelector("pre[data-block-type]");
  const target = codeBlock?.closest(".markdown-comment-target");
  const addButton = target?.querySelector(
    ".markdown-block-comment-button",
  ) as HTMLButtonElement | null;

  expect(codeBlock).not.toBeNull();
  expect(addButton).not.toBeNull();

  act(() => {
    addButton?.click();
  });

  expect(result.container.textContent).toContain("コメント追加");
  expect(result.container.textContent).toContain("code blockブロック 1");
  result.unmount();
});

test("MarkdownViewerはブロックコメント追加popoverを範囲外クリックで閉じる", () => {
  const result = renderViewer(createReadyState("Close this draft outside."));
  const addButton = result.container.querySelector(
    ".markdown-block-comment-button",
  ) as HTMLButtonElement;

  act(() => {
    addButton.click();
  });

  expect(result.container.querySelector("textarea")).not.toBeNull();

  act(() => {
    document.body.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
  });

  expect(result.container.querySelector("textarea")).toBeNull();
  result.unmount();
});

test("MarkdownViewerはコメント追加ボタンをキーボードでフォーカスできる", () => {
  const result = renderViewer(createReadyState("Focusable paragraph."));
  const addButton = result.container.querySelector(
    '[aria-label="コメント追加"]',
  ) as HTMLButtonElement;

  act(() => {
    addButton.focus();
  });

  expect(document.activeElement).toBe(addButton);
  result.unmount();
});

test("MarkdownViewerは空ファイル状態を表示する", () => {
  const result = renderViewer(createReadyState(" \n\t "));

  expect(result.container.textContent).toContain("ファイルは空です");
  result.unmount();
});

test("MarkdownViewerはmissing状態を表示する", () => {
  const missingDocument: SpecDocument = {
    key: "tasks",
    path: "/workspace/spec-reviewer/docs/plans/tasks.md",
    contents: null,
    missing: true,
    blocks: [],
  };
  const result = renderViewer({
    status: "missing",
    workspacePath,
    specId: "phase-1-viewer",
    fileKey: "tasks",
    document: missingDocument,
    error: null,
  });

  expect(result.container.textContent).toContain("ファイルが見つかりません");
  result.unmount();
});

test("MarkdownViewerは読み込み中に文書skeletonを表示する", () => {
  const result = renderViewer({
    status: "loading",
    workspacePath,
    specId: "phase-1-viewer",
    fileKey: "tasks",
    document: null,
    error: null,
  });

  expect(result.container.querySelector('[role="status"]')?.textContent).toBe(
    "Markdownを読み込み中",
  );
  expect(
    result.container.querySelector(".markdown-loading-skeleton"),
  ).not.toBeNull();
  result.unmount();
});

test("MarkdownViewerはerror状態で再読み込みイベントを発火する", () => {
  const onReload = vi.fn();
  const result = renderViewer(
    {
      status: "error",
      workspacePath,
      specId: "phase-1-viewer",
      fileKey: "tasks",
      document: null,
      error: {
        code: "markdownRead",
        message: "Markdown file could not be read.",
        raw: "Markdown file could not be read.",
      },
    },
    onReload,
  );
  const retryButton = result.container.querySelector("button");

  act(() => {
    retryButton?.click();
  });

  expect(result.container.textContent).toContain("Markdownを読み込めません");
  expect(onReload).toHaveBeenCalledTimes(1);
  result.unmount();
});
