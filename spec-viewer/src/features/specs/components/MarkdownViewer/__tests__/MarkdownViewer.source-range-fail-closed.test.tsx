import * as TestValues from "@/shared/testing/validatedValueObjects";
import type { ComponentType, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { MarkdownViewer } from "@/features/specs/components/MarkdownViewer";
import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";
import type { MarkdownBlockMetadata } from "@/features/specs/types/spec";

type MarkdownComponent = ComponentType<{
  node?: unknown;
  children?: ReactNode;
}>;

type ReactMarkdownMockProps = Readonly<{
  components?: Readonly<{ p?: MarkdownComponent }>;
}>;

vi.mock("react-markdown", () => ({
  default: ({ components }: ReactMarkdownMockProps) => {
    const Paragraph = components?.p;

    if (Paragraph === undefined) {
      return null;
    }

    const nodeWithoutPosition = {
      type: "element",
      tagName: "p",
      properties: {},
      children: [],
    };

    return (
      <>
        <blockquote>
          <Paragraph node={nodeWithoutPosition}>Nested paragraph.</Paragraph>
        </blockquote>
        <Paragraph node={nodeWithoutPosition}>After paragraph.</Paragraph>
      </>
    );
  },
}));

test("MarkdownViewerはrender nodeのsource range欠落時に順序fallbackしない", () => {
  const blocks: readonly MarkdownBlockMetadata[] = [
    {
      blockType: "paragraph",
      blockIndex: 0,
      textHash: "sha256:11111111",
      textSnippet: "Nested paragraph.",
      sourceRange: null,
    },
    {
      blockType: "paragraph",
      blockIndex: 1,
      textHash: "sha256:22222222",
      textSnippet: "After paragraph.",
      sourceRange: null,
    },
  ];
  const state: SpecDocumentState = {
    status: "ready",
    workspacePath: "/workspace/spec-reviewer",
    specId: TestValues.specId("phase-1-viewer"),
    fileKey: "tasks",
    document: {
      key: "tasks",
      format: "markdown",
      path: "/workspace/spec-reviewer/docs/plans/tasks.md",
      contents: "Nested paragraph.\n\nAfter paragraph.",
      missing: false,
      blocks,
    },
    error: null,
  };
  const container = document.createElement("div");
  const root = createRoot(container);

  document.body.append(container);
  act(() => {
    root.render(
      <MarkdownViewer
        state={state}
        selectedSpecLabel="Phase 1 Viewer"
        selectedFileLabel="Tasks"
        onReload={vi.fn()}
        onAddComment={vi.fn().mockResolvedValue(true)}
      />,
    );
  });

  const paragraphs = container.querySelectorAll(".markdown-rendered p");

  expect(paragraphs).toHaveLength(2);
  for (const paragraph of paragraphs) {
    expect(paragraph.getAttribute("data-comment-block-type")).toBeNull();
    expect(paragraph.getAttribute("data-text-hash")).toBeNull();
    expect(paragraph.getAttribute("data-comment-highlight")).toBeNull();
  }
  expect(container.querySelector(".markdown-block-comment-button")).toBeNull();

  act(() => root.unmount());
  container.remove();
});
