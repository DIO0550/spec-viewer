import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type { SpecDocumentState } from "../hooks/useSpecs";
import type { SpecDocument } from "../types/spec";
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
    },
  };
}

function createReadyState(contents: string | null): SpecDocumentState {
  const document: SpecDocument = {
    key: "tasks",
    path: "/workspace/spec-reviewer/docs/plans/tasks.md",
    contents,
    missing: false,
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

test("MarkdownViewerはMarkdown内の選択から追加コメント導線を表示する", () => {
  const result = renderViewer(
    createReadyState("A paragraph with selectable text."),
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
  expect(addButton?.textContent).toContain("Add comment");

  act(() => {
    addButton?.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    (addButton as HTMLButtonElement).click();
  });

  expect(result.container.textContent).toContain("Anchor ready");
  expect(result.container.textContent).toContain(
    "paragraph block 1, chars 2-11",
  );
  result.unmount();
});

test("MarkdownViewerは空ファイル状態を表示する", () => {
  const result = renderViewer(createReadyState(" \n\t "));

  expect(result.container.textContent).toContain("File is empty");
  result.unmount();
});

test("MarkdownViewerはmissing状態を表示する", () => {
  const missingDocument: SpecDocument = {
    key: "tasks",
    path: "/workspace/spec-reviewer/docs/plans/tasks.md",
    contents: null,
    missing: true,
  };
  const result = renderViewer({
    status: "missing",
    workspacePath,
    specId: "phase-1-viewer",
    fileKey: "tasks",
    document: missingDocument,
    error: null,
  });

  expect(result.container.textContent).toContain("File missing");
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

  expect(result.container.textContent).toContain("Could not load Markdown");
  expect(onReload).toHaveBeenCalledTimes(1);
  result.unmount();
});
