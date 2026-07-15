import * as TestValues from "@/shared/testing/validatedValueObjects";
import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
import type { Comment } from "@/features/comments/types/comment";
import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";
import type {
  MarkdownBlockMetadata,
  SpecDocument,
} from "@/features/specs/types/spec";
import { MarkdownViewer } from "@/features/specs/components/MarkdownViewer";

const workspacePath = "/workspace/spec-reviewer";

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
    rerender: (nextComponent: ReactNode) => {
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

function createLoadingState(): SpecDocumentState {
  return {
    status: "loading",
    workspacePath,
    specId: TestValues.specId("phase-1-viewer"),
    fileKey: "tasks",
    correlationId: "cid-loading",
    document: null,
    error: null,
  };
}

function createReadyState(
  contents: string,
  blocks: readonly MarkdownBlockMetadata[] = [],
): SpecDocumentState {
  const document: SpecDocument = {
    key: "tasks",
    format: "markdown",
    path: "/workspace/spec-reviewer/docs/plans/tasks.md",
    contents,
    missing: false,
    blocks,
  };

  return {
    status: "ready",
    workspacePath,
    specId: TestValues.specId("phase-1-viewer"),
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

test("MarkdownViewerはloadingを挟んだ同一文書の再表示でもfirst readableを再通知する", () => {
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

  result.rerender(
    <MarkdownViewer
      state={createLoadingState()}
      selectedSpecLabel="Phase 1 Viewer"
      selectedFileLabel="Tasks"
      onReload={vi.fn()}
      onFirstReadable={onFirstReadable}
    />,
  );
  result.rerender(
    <MarkdownViewer
      state={createReadyState("# Tasks")}
      selectedSpecLabel="Phase 1 Viewer"
      selectedFileLabel="Tasks"
      onReload={vi.fn()}
      onFirstReadable={onFirstReadable}
    />,
  );

  expect(onFirstReadable).toHaveBeenCalledTimes(2);
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
  const oversizedCode = [
    "```ts",
    `const value = "${"あ".repeat(70_000)}";`,
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
test("MarkdownViewerはblockごとにMarkdown prefixを再encodeしない", () => {
  const blockCount = 200;
  const paragraphs = Array.from(
    { length: blockCount },
    (_, index) => `Paragraph ${index} 😀`,
  );
  const contents = paragraphs.join("\n\n");
  const encoder = new TextEncoder();
  let startByteOffset = 0;
  const blocks: readonly MarkdownBlockMetadata[] = paragraphs.map(
    (paragraph, blockIndex) => {
      const paragraphEndByteOffset =
        startByteOffset + encoder.encode(paragraph).byteLength;
      const endByteOffset =
        paragraphEndByteOffset + (blockIndex < blockCount - 1 ? 2 : 0);
      const block: MarkdownBlockMetadata = {
        blockType: "paragraph",
        blockIndex,
        textHash: `sha256:${blockIndex.toString(16).padStart(8, "0")}`,
        textSnippet: paragraph,
        sourceRange: {
          startByteOffset,
          endByteOffset,
        },
      };

      startByteOffset = endByteOffset;
      return block;
    },
  );
  const encodeSpy = vi.spyOn(TextEncoder.prototype, "encode");
  const result = renderComponent(
    <MarkdownViewer
      state={createReadyState(contents, blocks)}
      selectedSpecLabel="Phase 1 Viewer"
      selectedFileLabel="Tasks"
      onReload={vi.fn()}
    />,
  );
  const renderedBlocks = result.container.querySelectorAll(
    '[data-comment-block-type="paragraph"]',
  );

  expect(renderedBlocks).toHaveLength(blockCount);
  expect(renderedBlocks[blockCount - 1]?.getAttribute("data-text-hash")).toBe(
    `sha256:${(blockCount - 1).toString(16).padStart(8, "0")}`,
  );
  expect(encodeSpy.mock.calls.length).toBeLessThanOrEqual(8);
  result.unmount();
  encodeSpy.mockRestore();
});

test("MarkdownViewerはresolution targetごとにbackend blocksを再走査しない", () => {
  const blockCount = 120;
  const paragraphs = Array.from(
    { length: blockCount },
    (_, index) => `Resolved paragraph ${index}`,
  );
  const contents = paragraphs.join("\n\n");
  const encoder = new TextEncoder();
  let startByteOffset = 0;
  const blocks: readonly MarkdownBlockMetadata[] = paragraphs.map(
    (paragraph, blockIndex) => {
      const paragraphEndByteOffset =
        startByteOffset + encoder.encode(paragraph).byteLength;
      const endByteOffset =
        paragraphEndByteOffset + (blockIndex < blockCount - 1 ? 2 : 0);
      const block: MarkdownBlockMetadata = {
        blockType: "paragraph",
        blockIndex,
        textHash: `sha256:${blockIndex.toString(16).padStart(8, "0")}`,
        textSnippet: paragraph,
        sourceRange: {
          startByteOffset,
          endByteOffset,
        },
      };

      startByteOffset = endByteOffset;
      return block;
    },
  );
  const comments: readonly Comment[] = blocks.map((block) => ({
    id: TestValues.commentId(`cmt_resolution_${block.blockIndex}`),
    anchor: createCommentAnchorTestFixture({
      blockIndex: block.blockIndex,
      textHash: block.textHash,
      textSnippet: block.textSnippet,
    }),
    body: `Review ${block.blockIndex}`,
    status: "open",
    resolved: false,
    anchorResolution: {
      status: "resolved",
      reason: "exact_match",
      details: null,
      target: {
        blockType: "paragraph",
        blockIndex: block.blockIndex,
        textHash: block.textHash,
        textSnippet: block.textSnippet,
        sourceRange: block.sourceRange,
        score: 1,
      },
    },
    createdAt: TestValues.isoDateTime("2026-07-15T00:00:00Z"),
    updatedAt: TestValues.isoDateTime("2026-07-15T00:00:00Z"),
  }));
  let blockElementReads = 0;
  const trackedBlocks = new Proxy(blocks, {
    get(target, property, receiver) {
      if (typeof property === "string" && /^\d+$/.test(property)) {
        blockElementReads += 1;
      }

      return Reflect.get(target, property, receiver);
    },
  });
  const result = renderComponent(
    <MarkdownViewer
      state={createReadyState(contents, trackedBlocks)}
      selectedSpecLabel="Phase 1 Viewer"
      selectedFileLabel="Tasks"
      comments={comments}
      activeCommentId={null}
      onReload={vi.fn()}
    />,
  );

  expect(
    result.container.querySelectorAll("[data-comment-highlight]"),
  ).toHaveLength(blockCount);
  expect(blockElementReads).toBeLessThanOrEqual(blockCount * 8);
  result.unmount();
});
