import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { Comment } from "@/features/comments/domain/comment";
import type {
  CommentAnchorResolution,
  CommentBlockType,
} from "@/features/comments/domain/commentAnchor";
import {
  type CommentId,
  CommentId as CommentIdValue,
} from "@/features/comments/domain/commentId";
import {
  CommentOperationFailedState,
  CommentOperationIdleState,
  type CommentOperationKind,
  CommentOperationSavingState,
  type CommentOperationState,
} from "@/features/comments/domain/commentOperation";
import { createTextHash } from "@/features/comments/lib/comment-anchor-draft";
import { MarkdownViewer } from "@/features/specs/components/MarkdownViewer";
import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";
import type {
  MarkdownBlockMetadata,
  SpecDocument,
} from "@/features/specs/types/spec";
import { createTestMarkdownBlocks } from "./markdownBlockFixture";

const commentId = CommentIdValue.fromString;

const workspacePath = "/workspace/spec-reviewer";
const selectedSpecLabel = "Phase 1 Viewer";
const selectedFileLabel = "Tasks";
const idleOperationState = CommentOperationIdleState.create();

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
  rerender: (component: ReactNode) => void;
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

function createReadyState(
  contents: string | null,
  blocks?: readonly MarkdownBlockMetadata[],
  format: SpecDocument["format"] = "markdown",
  documentPath: string = format === "html"
    ? "/workspace/spec-reviewer/docs/plans/tasks.html"
    : "/workspace/spec-reviewer/docs/plans/tasks.md",
): SpecDocumentState {
  const document: SpecDocument = {
    key: "tasks",
    format,
    path: documentPath,
    contents,
    missing: false,
    blocks: blocks ?? createTestMarkdownBlocks(contents),
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
  status = "open",
  anchorResolution = null,
  charRange = {
    start: 0,
    end: text.length,
  },
  blockType = "paragraph",
}: Readonly<{
  id: string;
  blockIndex: number;
  text: string;
  status?: Comment["status"];
  anchorResolution?: CommentAnchorResolution | null;
  charRange?: Readonly<{
    start: number;
    end: number;
  }>;
  blockType?: CommentBlockType;
}>): Comment {
  return {
    id: commentId(id),
    anchor: {
      fileKey: "tasks",
      blockType,
      blockIndex,
      textHash: createTextHash(text),
      textSnippet: text,
      charRange,
    },
    body: `${id} body`,
    status,
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
  activeCommentId: CommentId | null = null,
  onSelectComment = vi.fn(),
  onUpdateComment = vi.fn().mockResolvedValue(true),
  operationState: CommentOperationState = idleOperationState,
  onResolveComment = vi.fn().mockResolvedValue(true),
  onReopenComment = vi.fn().mockResolvedValue(true),
  onDeleteComment = vi.fn().mockResolvedValue(true),
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
      onUpdateComment={onUpdateComment}
      operationState={operationState}
      onResolveComment={onResolveComment}
      onReopenComment={onReopenComment}
      onDeleteComment={onDeleteComment}
      onSelectComment={onSelectComment}
    />,
  );
}

function createClientRect({
  top,
  left,
  width,
  height,
}: Readonly<{
  top: number;
  left: number;
  width: number;
  height: number;
}>): DOMRect {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function createOperationErrorState(
  operation: CommentOperationKind,
  targetCommentId: CommentId,
  message: string,
): CommentOperationState {
  return CommentOperationFailedState.create(operation, targetCommentId, {
    code: "unknown",
    message,
    raw: null,
  });
}

function openFirstCommentEditPopover(container: HTMLElement): HTMLElement {
  const annotation = container.querySelector(
    ".markdown-comment-annotation",
  ) as HTMLElement;
  const toggle = annotation.querySelector(
    ".markdown-comment-annotation__toggle",
  ) as HTMLButtonElement;

  act(() => {
    toggle.click();
  });

  const select = annotation.querySelector(
    ".markdown-comment-annotation__select",
  ) as HTMLButtonElement;

  act(() => {
    select.click();
  });

  return container.querySelector(".add-comment-popover") as HTMLElement;
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

test("MarkdownViewerはHTML文書をsandbox iframeで閲覧表示する", () => {
  const result = renderViewer(
    createReadyState(
      '<nav><a href="#overview">Overview</a><a href="tasks.html#preview">Preview</a></nav><h1 id="overview">Overview</h1><h2 id="preview">Preview</h2><p>HTML body</p>',
      [],
      "html",
    ),
  );
  const iframe = result.container.querySelector(
    ".html-rendered",
  ) as HTMLIFrameElement | null;

  expect(iframe?.getAttribute("sandbox")).toBe("");
  expect(iframe?.getAttribute("srcdoc")).toContain(
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
  );
  expect(iframe?.getAttribute("srcdoc")).toContain(
    '<base href="about:srcdoc" />',
  );
  expect(iframe?.getAttribute("srcdoc")).toContain(
    "--spec-viewer-html-zoom: 1;",
  );
  expect(iframe?.getAttribute("srcdoc")).toContain(
    '<nav><a href="#overview">Overview</a><a href="#preview">Preview</a></nav><h1 id="overview">Overview</h1><h2 id="preview">Preview</h2><p>HTML body</p>',
  );
  expect(iframe?.getAttribute("srcdoc")).not.toContain(
    'href="tasks.html#preview"',
  );
  expect(
    result.container.querySelector(".markdown-viewer--html"),
  ).not.toBeNull();
  expect(result.container.querySelector(".markdown-rendered")).toBeNull();
  expect(
    result.container.querySelector(".markdown-block-comment-button"),
  ).toBeNull();
  expect(
    result.container.querySelector(".markdown-document-search"),
  ).not.toBeNull();
  result.unmount();
});

test("MarkdownViewerは特定HTML文書のscript実行を許可する", () => {
  const requirementsResult = renderViewer(
    createReadyState(
      "<main><h1>Requirements</h1></main><script>window.__requirementsRendered = true;</script>",
      [],
      "html",
      "/workspace/spec-reviewer/docs/plans/requirements.html",
    ),
  );
  const requirementsIframe = requirementsResult.container.querySelector(
    ".html-rendered",
  ) as HTMLIFrameElement | null;

  expect(requirementsIframe?.getAttribute("sandbox")).toBe("allow-scripts");
  expect(requirementsIframe?.getAttribute("srcdoc")).toContain(
    "window.__requirementsRendered = true;",
  );
  requirementsResult.unmount();

  const result = renderViewer(
    createReadyState(
      "<main><h1>Test Cases</h1></main><script>window.__testCasesRendered = true;</script>",
      [],
      "html",
      "/workspace/spec-reviewer/docs/plans/test-cases.html",
    ),
  );
  const iframe = result.container.querySelector(
    ".html-rendered",
  ) as HTMLIFrameElement | null;

  expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts");
  expect(iframe?.getAttribute("srcdoc")).toContain(
    "window.__testCasesRendered = true;",
  );
  result.unmount();
});

test("MarkdownViewerはHTML文書の本文検索件数とhighlight付きsrcdocを表示する", () => {
  const result = renderViewer(
    createReadyState(
      [
        "<main>",
        "<h1>Test Cases</h1>",
        "<p>Alpha case body.</p>",
        '<p data-noise="Alpha case">Second alpha case.</p>',
        "<script>alpha case script noise</script>",
        "<style>.alpha-case { color: red; }</style>",
        "</main>",
      ].join(""),
      [],
      "html",
    ),
  );
  const searchInput = result.container.querySelector(
    '[aria-label="文書検索"]',
  ) as HTMLInputElement;

  act(() => {
    searchInput.value = " alpha case ";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const iframe = result.container.querySelector(
    ".html-rendered",
  ) as HTMLIFrameElement | null;
  const srcdoc = iframe?.getAttribute("srcdoc") ?? "";

  expect(result.container.textContent).toContain("1/2");
  const srcdocDocument = new DOMParser().parseFromString(srcdoc, "text/html");

  expect(
    srcdocDocument.querySelectorAll("mark[data-document-search-match]"),
  ).toHaveLength(2);
  expect(
    srcdocDocument.querySelector('[data-document-search-match-active="true"]'),
  ).not.toBeNull();
  expect(srcdocDocument.querySelector("script")?.textContent).toBe(
    "alpha case script noise",
  );
  expect(
    srcdocDocument.querySelector("style:not(#spec-viewer-html-preview-style)")
      ?.textContent,
  ).toBe(".alpha-case { color: red; }");
  result.unmount();
});

test("MarkdownViewerはHTML文書検索の次前操作とクリアを処理する", () => {
  const result = renderViewer(
    createReadyState("<main><p>Alpha beta alpha.</p></main>", [], "html"),
  );
  const searchInput = result.container.querySelector(
    '[aria-label="文書検索"]',
  ) as HTMLInputElement;

  act(() => {
    searchInput.value = "alpha";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const nextButton = result.container.querySelector(
    '[aria-label="次の一致へ"]',
  ) as HTMLButtonElement;

  act(() => {
    nextButton.click();
  });

  let iframe = result.container.querySelector(
    ".html-rendered",
  ) as HTMLIFrameElement | null;
  let srcdoc = iframe?.getAttribute("srcdoc") ?? "";

  expect(result.container.textContent).toContain("2/2");
  expect(srcdoc).toContain("beta <mark");

  const clearButton = result.container.querySelector(
    '[aria-label="文書検索をクリア"]',
  ) as HTMLButtonElement;

  act(() => {
    clearButton.click();
  });

  iframe = result.container.querySelector(
    ".html-rendered",
  ) as HTMLIFrameElement | null;
  srcdoc = iframe?.getAttribute("srcdoc") ?? "";

  const clearedSrcdocDocument = new DOMParser().parseFromString(
    srcdoc,
    "text/html",
  );

  expect(searchInput.value).toBe("");
  expect(result.container.textContent).toContain("0件");
  expect(
    clearedSrcdocDocument.querySelector("mark[data-document-search-match]"),
  ).toBeNull();
  result.unmount();
});

test("MarkdownViewerはHTML文書の拡大率を変更できる", () => {
  const result = renderViewer(
    createReadyState("<h1>Preview</h1><p>HTML body</p>", [], "html"),
  );
  const zoomInButton = result.container.querySelector(
    '[aria-label="HTMLを拡大"]',
  ) as HTMLButtonElement;
  const zoomOutput = result.container.querySelector(
    '[aria-label="HTML拡大率"]',
  );

  expect(zoomOutput?.textContent).toBe("100%");

  act(() => {
    zoomInButton.click();
  });

  const iframe = result.container.querySelector(
    ".html-rendered",
  ) as HTMLIFrameElement | null;

  expect(zoomOutput?.textContent).toBe("110%");
  expect(iframe?.getAttribute("srcdoc")).toContain(
    "--spec-viewer-html-zoom: 1.1;",
  );
  result.unmount();
});

test("MarkdownViewerはUnderstanding Quiz HTMLをgenericなHTML文書として表示する", () => {
  const result = renderViewer(
    createReadyState(
      '<main><button type="button">Check answer</button><script>window.quizReady = true;</script></main>',
      [],
      "html",
      "/workspace/spec-reviewer/.plugin-workspace/.specs/reference/understanding-quiz-plan.html",
    ),
  );
  const iframe = result.container.querySelector(
    ".html-rendered",
  ) as HTMLIFrameElement | null;

  expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts");
  expect(iframe?.getAttribute("srcdoc")).toContain("window.quizReady = true;");
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

test("MarkdownViewerはbackend block metadata欠落をcontract violationとして扱う", () => {
  expect(() =>
    renderViewer(createReadyState("Metadata is required.", [])),
  ).toThrow(/Markdown block metadata contract violation/);
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

test("MarkdownViewerはコメント付きブロックを状態別にハイライトする", () => {
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
    }),
    createComment({
      id: "cmt_resolved",
      status: "resolved",
      blockIndex: 2,
      text: "Resolved comments should stay quieter.",
    }),
  ];
  const result = renderViewer(
    createReadyState(contents),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    comments,
    commentId("cmt_open"),
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

  expect(highlightedBlocks).toHaveLength(1);
  expect(activeBlock.textContent).toContain(
    "Open comments should remain prominent.",
  );
  expect(resolvedBlock).toBeNull();

  expect(activeBlock.getAttribute("role")).toBeNull();
  expect(activeBlock.getAttribute("tabindex")).toBe("-1");
  result.unmount();
});

test("MarkdownViewerはリスト項目の本文より前にコメントボタンを置かない", () => {
  const result = renderViewer(createReadyState("- Selectable list text"));
  const listItem = result.container.querySelector(
    '.markdown-rendered li[data-block-type="list-item"]',
  );
  const blockCommentButton = listItem?.querySelector(
    ".markdown-block-comment-button",
  );

  expect(blockCommentButton?.previousSibling).toBeInstanceOf(Text);
  expect(blockCommentButton?.previousSibling?.textContent).toContain(
    "Selectable list text",
  );
  expect(listItem?.textContent).toContain("Selectable list text");
  result.unmount();
});

test("MarkdownViewerは段落本文より前にコメントボタンを置かない", () => {
  const result = renderViewer(createReadyState("Selectable paragraph text."));
  const target = result.container.querySelector(".markdown-comment-target");
  const paragraph = target?.querySelector("p");
  const blockCommentButton = target?.querySelector(
    ".markdown-block-comment-button",
  );

  expect(paragraph?.textContent).toBe("Selectable paragraph text.");
  expect(blockCommentButton?.previousElementSibling).toBe(paragraph);
  result.unmount();
});

test("MarkdownViewerは現在のMarkdown文書を検索して一致箇所を移動できる", () => {
  const result = renderViewer(
    createReadyState(["Alpha beta alpha.", "", "Gamma Alpha"].join("\n")),
  );
  const searchInput = result.container.querySelector(
    '[aria-label="文書検索"]',
  ) as HTMLInputElement;

  act(() => {
    searchInput.value = "alpha";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const nextButton = result.container.querySelector(
    '[aria-label="次の一致へ"]',
  ) as HTMLButtonElement;
  const renderedDocument = result.container.querySelector(
    ".markdown-rendered",
  ) as HTMLDivElement;

  expect(
    result.container.querySelectorAll("[data-document-search-match]"),
  ).toHaveLength(3);
  expect(result.container.textContent).toContain("1/3");
  expect(
    result.container.querySelector('[data-document-search-match-active="true"]')
      ?.textContent,
  ).toBe("Alpha");

  const queryAllSpy = vi.spyOn(renderedDocument, "querySelectorAll");
  act(() => {
    nextButton.click();
  });

  expect(queryAllSpy).not.toHaveBeenCalled();
  expect(result.container.textContent).toContain("2/3");
  expect(
    result.container.querySelector('[data-document-search-match-active="true"]')
      ?.textContent,
  ).toBe("alpha");

  const clearButton = result.container.querySelector(
    '[aria-label="文書検索をクリア"]',
  ) as HTMLButtonElement;

  act(() => {
    clearButton.click();
  });

  queryAllSpy.mockRestore();
  expect(searchInput.value).toBe("");
  expect(
    result.container.querySelectorAll("[data-document-search-match]"),
  ).toHaveLength(0);
  result.unmount();
});

test("MarkdownViewerは既存コメントを本文右側のカードから編集できる", async () => {
  const onSelectComment = vi.fn();
  const onUpdateComment = vi.fn().mockResolvedValue(true);
  const contents = "Existing comments should be visible beside the paragraph.";
  const comments: readonly Comment[] = [
    createComment({
      id: "cmt_open",
      blockIndex: 0,
      text: contents,
    }),
    createComment({
      id: "cmt_resolved",
      status: "resolved",
      blockIndex: 0,
      text: contents,
    }),
  ];
  const result = renderViewer(
    createReadyState(contents),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    comments,
    commentId("cmt_open"),
    onSelectComment,
    onUpdateComment,
  );
  const annotationCards = result.container.querySelectorAll(
    ".markdown-comment-annotation",
  );
  const activeAnnotation = result.container.querySelector(
    '.markdown-comment-annotation[data-active="true"]',
  ) as HTMLElement;
  const activeAnnotationToggle = activeAnnotation.querySelector(
    ".markdown-comment-annotation__toggle",
  ) as HTMLButtonElement;

  expect(annotationCards).toHaveLength(1);
  expect(annotationCards[0]?.textContent).toContain("未解決");
  expect(annotationCards[0]?.textContent).not.toContain("cmt_open body");
  expect(activeAnnotationToggle.getAttribute("aria-expanded")).toBe("false");
  expect(result.container.textContent).not.toContain("解決済み");
  expect(result.container.textContent).not.toContain("cmt_resolved body");

  act(() => {
    activeAnnotationToggle.click();
  });

  const activeAnnotationSelect = activeAnnotation.querySelector(
    ".markdown-comment-annotation__select",
  ) as HTMLButtonElement;

  expect(activeAnnotationToggle.getAttribute("aria-expanded")).toBe("true");
  expect(activeAnnotation.textContent).toContain("cmt_open body");

  act(() => {
    activeAnnotationSelect.click();
  });

  expect(onSelectComment).not.toHaveBeenCalled();
  expect(result.container.textContent).toContain("コメント編集");

  const editor = result.container.querySelector(
    ".add-comment-popover textarea",
  ) as HTMLTextAreaElement;

  expect(editor.value).toBe("cmt_open body");

  await act(async () => {
    editor.value = "Updated inline comment body";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const saveButton = Array.from(
    result.container.querySelectorAll<HTMLButtonElement>(
      ".add-comment-popover__actions button",
    ),
  )[1] as HTMLButtonElement;

  await act(async () => {
    saveButton.click();
  });

  expect(onUpdateComment).toHaveBeenCalledWith(
    commentId("cmt_open"),
    "Updated inline comment body",
  );
  expect(
    result.container.querySelector(".markdown-block-comment-button"),
  ).not.toBeNull();
  result.unmount();
});

test("MarkdownViewerは編集ポップオーバーから未解決コメントを解決できる", async () => {
  const onResolveComment = vi.fn().mockResolvedValue(true);
  const contents = "Existing comments should be visible beside the paragraph.";
  const comments: readonly Comment[] = [
    createComment({
      id: "cmt_open",
      blockIndex: 0,
      text: contents,
    }),
  ];
  const result = renderViewer(
    createReadyState(contents),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    comments,
    commentId("cmt_open"),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    idleOperationState,
    onResolveComment,
  );
  const popover = openFirstCommentEditPopover(result.container);
  const resolveButton = Array.from(
    popover.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) =>
    button.textContent?.includes("解決する"),
  ) as HTMLButtonElement;

  await act(async () => {
    resolveButton.click();
  });

  expect(onResolveComment).toHaveBeenCalledWith(commentId("cmt_open"));
  result.unmount();
});

test("MarkdownViewerはコメント解決後に左ビューの表示から外す", async () => {
  const onResolveComment = vi.fn().mockResolvedValue(true);
  const contents = "Resolved comments should disappear from the viewer.";
  const openComment = createComment({
    id: "cmt_open",
    blockIndex: 0,
    text: contents,
  });
  const resolvedComment = createComment({
    id: "cmt_open",
    status: "resolved",
    blockIndex: 0,
    text: contents,
  });
  const renderMarkdownViewer = (comments: readonly Comment[]): ReactNode => (
    <MarkdownViewer
      state={createReadyState(contents)}
      selectedSpecLabel={selectedSpecLabel}
      selectedFileLabel={selectedFileLabel}
      comments={comments}
      activeCommentId={commentId("cmt_open")}
      onReload={vi.fn()}
      onAddComment={vi.fn().mockResolvedValue(true)}
      onUpdateComment={vi.fn().mockResolvedValue(true)}
      operationState={idleOperationState}
      onResolveComment={onResolveComment}
      onReopenComment={vi.fn().mockResolvedValue(true)}
      onDeleteComment={vi.fn().mockResolvedValue(true)}
      onSelectComment={vi.fn()}
    />
  );
  const result = renderComponent(renderMarkdownViewer([openComment]));
  const popover = openFirstCommentEditPopover(result.container);
  const resolveButton = Array.from(
    popover.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) =>
    button.textContent?.includes("解決する"),
  ) as HTMLButtonElement;

  await act(async () => {
    resolveButton.click();
  });

  result.rerender(renderMarkdownViewer([resolvedComment]));

  expect(
    result.container.querySelectorAll(".markdown-comment-annotation"),
  ).toHaveLength(0);
  expect(result.container.querySelector(".add-comment-popover")).toBeNull();
  result.unmount();
});

test("MarkdownViewerは親ビュー再描画後も編集中の本文を維持する", async () => {
  const contents = "Existing comments should keep draft edits during rerender.";
  const createDraftComment = (): Comment =>
    createComment({
      id: "cmt_draft",
      blockIndex: 0,
      text: contents,
    });
  const renderMarkdownViewer = (comments: readonly Comment[]): ReactNode => (
    <MarkdownViewer
      state={createReadyState(contents)}
      selectedSpecLabel={selectedSpecLabel}
      selectedFileLabel={selectedFileLabel}
      comments={comments}
      activeCommentId={commentId("cmt_draft")}
      onReload={vi.fn()}
      onAddComment={vi.fn().mockResolvedValue(true)}
      onUpdateComment={vi.fn().mockResolvedValue(true)}
      operationState={idleOperationState}
      onResolveComment={vi.fn().mockResolvedValue(true)}
      onReopenComment={vi.fn().mockResolvedValue(true)}
      onDeleteComment={vi.fn().mockResolvedValue(true)}
      onSelectComment={vi.fn()}
    />
  );
  const result = renderComponent(renderMarkdownViewer([createDraftComment()]));
  const popover = openFirstCommentEditPopover(result.container);
  const editor = popover.querySelector("textarea") as HTMLTextAreaElement;

  await act(async () => {
    editor.value = "Draft body in progress";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });

  result.rerender(renderMarkdownViewer([createDraftComment()]));

  expect(editor.value).toBe("Draft body in progress");
  result.unmount();
});

test("MarkdownViewerは初期表示の解決済みコメントを左ビューから非表示にする", () => {
  const contents = "Resolved comments should be visible beside the paragraph.";
  const comments: readonly Comment[] = [
    createComment({
      id: "cmt_resolved",
      status: "resolved",
      blockIndex: 0,
      text: contents,
    }),
  ];
  const result = renderViewer(
    createReadyState(contents),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    comments,
    commentId("cmt_resolved"),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    idleOperationState,
    vi.fn().mockResolvedValue(true),
    vi.fn().mockResolvedValue(true),
  );

  expect(
    result.container.querySelectorAll(".markdown-comment-annotation"),
  ).toHaveLength(0);
  expect(result.container.querySelector("[data-comment-highlight]")).toBeNull();
  expect(result.container.textContent).not.toContain("解決済み");
  result.unmount();
});

test("MarkdownViewerは編集ポップオーバーの削除初回クリックで確認UIだけを表示する", () => {
  const onDeleteComment = vi.fn().mockResolvedValue(true);
  const contents = "Delete confirmation should protect inline comments.";
  const comments: readonly Comment[] = [
    createComment({
      id: "cmt_delete",
      blockIndex: 0,
      text: contents,
    }),
  ];
  const result = renderViewer(
    createReadyState(contents),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    comments,
    commentId("cmt_delete"),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    idleOperationState,
    vi.fn().mockResolvedValue(true),
    vi.fn().mockResolvedValue(true),
    onDeleteComment,
  );
  const popover = openFirstCommentEditPopover(result.container);
  const requestDeleteButton = Array.from(
    popover.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) => button.textContent === "削除") as HTMLButtonElement;

  act(() => {
    requestDeleteButton.click();
  });

  expect(onDeleteComment).not.toHaveBeenCalled();
  expect(popover.textContent).toContain("このコメントを完全に削除しますか？");
  result.unmount();
});

test("MarkdownViewerは編集ポップオーバーの削除確認後にコメントを削除できる", async () => {
  const onDeleteComment = vi.fn().mockResolvedValue(true);
  const contents = "Delete confirmation should call delete after confirmation.";
  const comments: readonly Comment[] = [
    createComment({
      id: "cmt_delete",
      blockIndex: 0,
      text: contents,
    }),
  ];
  const result = renderViewer(
    createReadyState(contents),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    comments,
    commentId("cmt_delete"),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    idleOperationState,
    vi.fn().mockResolvedValue(true),
    vi.fn().mockResolvedValue(true),
    onDeleteComment,
  );
  const popover = openFirstCommentEditPopover(result.container);
  const requestDeleteButton = Array.from(
    popover.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) => button.textContent === "削除") as HTMLButtonElement;

  act(() => {
    requestDeleteButton.click();
  });

  const confirmDeleteButton = popover.querySelector(
    '[aria-label="コメント削除を確定 cmt_delete"]',
  ) as HTMLButtonElement;

  await act(async () => {
    confirmDeleteButton.click();
  });

  expect(onDeleteComment).toHaveBeenCalledWith(commentId("cmt_delete"));
  result.unmount();
});

test("MarkdownViewerは対象コメントの操作中に編集ポップオーバーの操作を無効化する", () => {
  const contents = "Busy comments should disable inline edit actions.";
  const comments: readonly Comment[] = [
    createComment({
      id: "cmt_busy",
      blockIndex: 0,
      text: contents,
    }),
  ];
  const operationState = CommentOperationSavingState.create(
    "resolve",
    commentId("cmt_busy"),
  );
  const result = renderViewer(
    createReadyState(contents),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    comments,
    commentId("cmt_busy"),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    operationState,
  );
  const popover = openFirstCommentEditPopover(result.container);
  const textarea = popover.querySelector("textarea") as HTMLTextAreaElement;
  const closeButton = popover.querySelector(
    '[aria-label="コメント編集をキャンセル"]',
  ) as HTMLButtonElement;
  const statusButton = Array.from(
    popover.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) =>
    button.textContent?.includes("解決する"),
  ) as HTMLButtonElement;
  const deleteButton = Array.from(
    popover.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) => button.textContent === "削除") as HTMLButtonElement;
  const saveButton = Array.from(
    popover.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) => button.textContent?.includes("保存")) as HTMLButtonElement;

  expect(textarea.disabled).toBe(true);
  expect(closeButton.disabled).toBe(true);
  expect(statusButton.disabled).toBe(true);
  expect(deleteButton.disabled).toBe(true);
  expect(saveButton.disabled).toBe(true);
  result.unmount();
});

test("MarkdownViewerは対象コメントの操作エラーを編集ポップオーバーに表示する", () => {
  const contents = "Failed delete should surface in the inline edit popover.";
  const comments: readonly Comment[] = [
    createComment({
      id: "cmt_error",
      blockIndex: 0,
      text: contents,
    }),
  ];
  const operationState = createOperationErrorState(
    "delete",
    commentId("cmt_error"),
    "削除に失敗しました。",
  );
  const result = renderViewer(
    createReadyState(contents),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    comments,
    commentId("cmt_error"),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    operationState,
  );
  const popover = openFirstCommentEditPopover(result.container);

  expect(popover.textContent).toContain("削除に失敗しました。");
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
    }),
    createComment({
      id: "cmt_orphaned",
      blockIndex: 4,
      text: "A missing anchor.",
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

test("MarkdownViewerはインラインコード内のコメント範囲に背景色を重ねない", () => {
  const contents = "A paragraph with `inlineCode` and selectable text.";
  const comments: readonly Comment[] = [
    createComment({
      id: "cmt_inline_code",
      blockIndex: 0,
      text: contents,
      charRange: {
        start: contents.indexOf("inlineCode"),
        end: contents.indexOf("inlineCode") + "inlineCode".length,
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
  const inlineCode = result.container.querySelector(
    ".markdown-rendered p code",
  );

  expect(inlineCode?.textContent).toBe("inlineCode");
  expect(
    inlineCode?.querySelector("[data-comment-highlight-range]"),
  ).toBeNull();
  result.unmount();
});

test("MarkdownViewerはコードブロックコメントを範囲色ではなくブロック目印で示す", () => {
  const code = "const enabled = true;";
  const contents = ["```ts", code, "```"].join("\n");
  const comments: readonly Comment[] = [
    createComment({
      id: "cmt_code",
      blockIndex: 0,
      text: code,
      blockType: "code_block",
      charRange: {
        start: code.indexOf("enabled"),
        end: code.indexOf("enabled") + "enabled".length,
      },
    }),
  ];
  const result = renderViewer(
    createReadyState(contents),
    vi.fn(),
    vi.fn().mockResolvedValue(true),
    comments,
  );
  const codeBlock = result.container.querySelector(".markdown-rendered pre");

  expect(codeBlock?.getAttribute("data-comment-highlight")).toBe("true");
  expect(codeBlock?.getAttribute("data-comment-highlight-mode")).toBe("block");
  expect(codeBlock?.querySelector("[data-comment-highlight-range]")).toBeNull();
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
  const commentTarget = result.container.querySelector(
    ".markdown-comment-target",
  ) as HTMLElement;
  const targetRectSpy = vi
    .spyOn(commentTarget, "getBoundingClientRect")
    .mockReturnValue(
      createClientRect({
        top: 100,
        left: 40,
        width: 600,
        height: 32,
      }),
    );
  const innerWidthSpy = vi
    .spyOn(window, "innerWidth", "get")
    .mockReturnValue(700);
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

  expect(
    result.container.querySelector(".text-selection-comment-button"),
  ).toBeNull();

  act(() => {
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });

  const addButton = result.container.querySelector(
    ".text-selection-comment-button",
  );
  expect(addButton?.textContent).toContain("コメント追加");
  expect((addButton as HTMLElement).style.left).toBe("552px");
  expect((addButton as HTMLElement).style.transform).toBe("none");

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
  expect(
    (result.container.querySelector(".add-comment-popover") as HTMLElement)
      .style.left,
  ).toBe("310px");

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
  innerWidthSpy.mockRestore();
  targetRectSpy.mockRestore();
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

  expect(
    result.container.querySelector(".text-selection-comment-button"),
  ).toBeNull();

  act(() => {
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
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

test("MarkdownViewerは別ブロックのコメントdraftへ切り替えると追加popoverを初期化する", async () => {
  const result = renderViewer(
    createReadyState(["First paragraph.", "", "Second paragraph."].join("\n")),
  );
  const addButtons = result.container.querySelectorAll(
    ".markdown-block-comment-button",
  );

  act(() => {
    (addButtons[0] as HTMLButtonElement).click();
  });

  const firstTextarea = result.container.querySelector(
    ".add-comment-popover textarea",
  ) as HTMLTextAreaElement;
  act(() => {
    firstTextarea.value = "   ";
    firstTextarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await act(async () => {
    firstTextarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        bubbles: true,
      }),
    );
  });

  expect(result.container.textContent).toContain(
    "保存するコメントを入力してください。",
  );

  const refreshedAddButtons = result.container.querySelectorAll(
    ".markdown-block-comment-button",
  );
  act(() => {
    (refreshedAddButtons[1] as HTMLButtonElement).click();
  });

  const nextTextarea = result.container.querySelector(
    ".add-comment-popover textarea",
  ) as HTMLTextAreaElement;
  expect(nextTextarea.value).toBe("");
  expect(result.container.textContent).toContain("paragraphブロック 2");
  expect(result.container.textContent).not.toContain(
    "保存するコメントを入力してください。",
  );
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
