import { createRef, type ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { MarkdownViewer } from "@/features/specs/components/MarkdownViewer";
import type { RenderedDocumentPort } from "@/features/specs";
import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";
import type {
  MarkdownBlockMetadata,
  SpecDocument,
} from "@/features/specs/types/spec";
import { createTestMarkdownBlocks } from "./markdownBlockFixture";

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
  rerender: (component: ReactNode) => void;
  unmount: () => void;
}>;

/** Updates a textarea through the same native input path React observes. */

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

function renderViewer(
  state: SpecDocumentState,
  onReload = vi.fn(),
): RenderResult {
  return renderComponent(
    <MarkdownViewer
      state={state}
      selectedSpecLabel={selectedSpecLabel}
      selectedFileLabel={selectedFileLabel}
      onReload={onReload}
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

test("MarkdownViewerは安定したブロックメタデータを文書順で付与する", () => {
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
test("MarkdownViewerはbackend block metadataを公開data属性に反映する", () => {
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
  expect(paragraph?.getAttribute("data-rendered-block-type")).toBe("paragraph");
  expect(paragraph?.getAttribute("data-text-hash")).toBe("sha256:backend5");
  expect(paragraph?.getAttribute("data-source-start-byte-offset")).toBe("10");
  expect(paragraph?.getAttribute("data-source-end-byte-offset")).toBe("43");
  result.unmount();
});

test("MarkdownViewerはgeneric portのprojectionとcommit通知だけを適用する", () => {
  const rootRef = createRef<HTMLDivElement>();
  const onRenderedDocumentCommit = vi.fn();
  const port: RenderedDocumentPort = {
    rootRef,
    isOverlayOpen: true,
    projectBlock: (block) => ({
      attributes: { "data-test-projection": block.key },
      textDecorations: [
        {
          key: "test-decoration",
          start: 2,
          end: 11,
          render: (children) => (
            <mark data-test-decoration="true">{children}</mark>
          ),
        },
      ],
      renderContainer: (_block, children) => (
        <section data-test-container="true">{children}</section>
      ),
    }),
    onRenderedDocumentCommit,
    renderOverlay: () => <div data-test-overlay="true" />,
  };
  const result = renderComponent(
    <MarkdownViewer
      state={createReadyState("A projected paragraph.")}
      selectedSpecLabel={selectedSpecLabel}
      selectedFileLabel={selectedFileLabel}
      renderedDocumentPort={port}
      onReload={vi.fn()}
    />,
  );
  const paragraph = result.container.querySelector(".markdown-rendered p");

  expect(paragraph?.getAttribute("data-test-projection")).toBe("paragraph:0");
  expect(
    result.container.querySelector("[data-test-decoration]")?.textContent,
  ).toBe("projected");
  expect(result.container.querySelector("[data-test-container] p")).toBe(
    paragraph,
  );
  expect(result.container.querySelector("[data-test-overlay]")).not.toBeNull();
  expect(
    result.container
      .querySelector(".markdown-viewer")
      ?.getAttribute("data-viewer-overlay-open"),
  ).toBe("true");
  expect(rootRef.current).not.toBeNull();
  expect(onRenderedDocumentCommit).toHaveBeenCalledOnce();
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

test("MarkdownViewerはmermaidコードブロックを図として表示する", () => {
  const mermaidMarkdown = [
    "```mermaid",
    "flowchart LR",
    "  Source --> Review",
    "```",
  ].join("\n");
  const result = renderViewer(createReadyState(mermaidMarkdown));
  const diagramBlock = result.container.querySelector(
    '[data-block-type="code"]',
  );

  expect(diagramBlock?.classList.contains("markdown-rendered__mermaid")).toBe(
    true,
  );
  expect(diagramBlock?.getAttribute("data-block-index")).toBe("0");
  expect(
    diagramBlock?.querySelector('figure[aria-label="Mermaid図"]'),
  ).not.toBeNull();
  expect(diagramBlock?.querySelector("pre code")).toBeNull();
  result.unmount();
});
