import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type { SpecDocumentState } from "../hooks/useSpecs";
import type { SpecDocument } from "../types/spec";
import { MarkdownViewer } from "./MarkdownViewer";

const workspacePath = "/workspace/spec-reviewer";

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

function createReadyState(contents: string): SpecDocumentState {
  const document: SpecDocument = {
    key: "tasks",
    format: "markdown",
    path: "/workspace/spec-reviewer/docs/plans/tasks.md",
    contents,
    missing: false,
    blocks: [],
  };

  return {
    status: "ready",
    workspacePath,
    specId: "phase-1-viewer",
    fileKey: "tasks",
    correlationId: "cid-1",
    document,
    error: null,
  };
}

test("MarkdownViewerは初回本文表示後にfirst readableを通知する", () => {
  const onFirstReadable = vi.fn();
  const result = renderComponent(
    <MarkdownViewer
      state={createReadyState("# Tasks")}
      selectedSpecLabel="Phase 1 Viewer"
      selectedFileLabel="Tasks"
      onReload={vi.fn()}
      onFirstReadable={onFirstReadable}
    />,
  );

  expect(onFirstReadable).toHaveBeenCalledTimes(1);
  result.unmount();
});

test("MarkdownViewerは巨大Markdownでsyntax highlightを無効にする", () => {
  const oversizedCode = [
    "```ts",
    `const value = "${"x".repeat(210_000)}";`,
    "```",
  ].join("\n");
  const result = renderComponent(
    <MarkdownViewer
      state={createReadyState(oversizedCode)}
      selectedSpecLabel="Phase 1 Viewer"
      selectedFileLabel="Tasks"
      onReload={vi.fn()}
    />,
  );
  const codeBlock = result.container.querySelector("pre code");

  expect(codeBlock?.classList.contains("hljs")).toBe(false);
  result.unmount();
});

test("MarkdownViewerは非ASCIIの実バイト数が大きいMarkdownでsyntax highlightを無効にする", () => {
  const oversizedCode = ["```ts", `const value = "${"あ".repeat(70_000)}";`, "```"].join(
    "\n",
  );
  const result = renderComponent(
    <MarkdownViewer
      state={createReadyState(oversizedCode)}
      selectedSpecLabel="Phase 1 Viewer"
      selectedFileLabel="Tasks"
      onReload={vi.fn()}
    />,
  );
  const codeBlock = result.container.querySelector("pre code");

  expect(codeBlock?.classList.contains("hljs")).toBe(false);
  result.unmount();
});
