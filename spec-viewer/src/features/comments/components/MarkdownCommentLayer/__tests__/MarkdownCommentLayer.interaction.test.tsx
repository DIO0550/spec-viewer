import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { Comment } from "@/features/comments/domain/comment";
import { CommentId } from "@/features/comments/domain/commentId";
import { CommentOperationIdleState } from "@/features/comments/domain/commentOperation";
import {
  MarkdownCommentLayer,
  type MarkdownCommentLayerProps,
} from "@/features/comments/components/MarkdownCommentLayer";
import type {
  RenderedBlockModel,
  RenderedDocumentPort,
} from "@/features/specs";

const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

const commentId = CommentId.fromString;

function createComment(status: Comment["status"] = "open"): Comment {
  return {
    id: commentId("cmt_1"),
    anchor: {
      fileKey: "requirements",
      blockType: "paragraph",
      blockIndex: 0,
      textHash: "hash:0",
      textSnippet: "paragraph text",
      charRange: { start: 0, end: 9 },
    },
    body: "Review this paragraph",
    status,
    anchorResolution: null,
    createdAt: "2026-09-03T00:00:00Z",
    updatedAt: "2026-09-03T00:00:00Z",
  };
}

function createLayerProps(
  overrides: Partial<MarkdownCommentLayerProps> = {},
): MarkdownCommentLayerProps {
  return {
    fileKey: "requirements",
    comments: [],
    activeCommentId: null,
    addState: {
      isSaving: false,
      errorMessage: null,
      isScopeReady: true,
    },
    editState: {
      isSaving: false,
      operationState: CommentOperationIdleState.create(),
    },
    actions: {
      add: vi.fn().mockResolvedValue(true),
      update: vi.fn().mockResolvedValue(true),
      resolve: vi.fn().mockResolvedValue(true),
      delete: vi.fn().mockResolvedValue(true),
      select: vi.fn(),
      reportAnchorDisplayStates: vi.fn(),
    },
    children: (port) => <RenderedDocumentPortHarness port={port} />,
    ...overrides,
  };
}

const blockModel: RenderedBlockModel = {
  key: "paragraph:0",
  renderedType: "paragraph",
  metadata: {
    blockType: "paragraph",
    blockIndex: 0,
    textHash: "hash:0",
    textSnippet: "paragraph text",
    sourceRange: null,
  },
};

function RenderedDocumentPortHarness({
  port,
}: Readonly<{ port: RenderedDocumentPort }>) {
  const projection = port.projectBlock(blockModel);
  const decoratedText = (projection?.textDecorations ?? []).reduce(
    (children, decoration) => decoration.render(children),
    "paragraph text" as React.ReactNode,
  );
  const block = (
    <p
      data-block-type="paragraph"
      data-block-index="0"
      data-rendered-block-type="paragraph"
      data-text-hash="hash:0"
      data-text-snippet="paragraph text"
      {...projection?.attributes}
    >
      {decoratedText}
    </p>
  );

  useLayoutEffect(() => {
    port.onRenderedDocumentCommit();
  }, [port]);

  return (
    <div ref={port.rootRef}>
      {projection?.renderContainer(blockModel, block) ?? block}
      {port.renderOverlay()}
    </div>
  );
}

function renderLayer(props: MarkdownCommentLayerProps): Readonly<{
  container: HTMLDivElement;
  rerender: (nextProps: MarkdownCommentLayerProps) => void;
  unmount: () => void;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(<MarkdownCommentLayer {...props} />);
  });

  return {
    container,
    rerender: (nextProps) => {
      act(() => {
        root.render(<MarkdownCommentLayer {...nextProps} />);
      });
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function inputTextarea(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  expect(setter).toBeDefined();
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

test("block action から draft を作成して add action へ委譲する", async () => {
  const props = createLayerProps();
  const result = renderLayer(props);
  const addButton = result.container.querySelector<HTMLButtonElement>(
    '.markdown-block-comment-button[aria-label="コメント追加"]',
  );
  expect(addButton).not.toBeNull();

  act(() => addButton?.click());
  const textarea = result.container.querySelector<HTMLTextAreaElement>(
    ".add-comment-popover textarea",
  );
  expect(textarea).not.toBeNull();
  act(() => inputTextarea(textarea as HTMLTextAreaElement, "New review"));
  const saveButton = Array.from(
    result.container.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) => button.textContent?.includes("保存"));

  await act(async () => saveButton?.click());

  expect(props.actions.add).toHaveBeenCalledWith({
    anchor: {
      fileKey: "requirements",
      blockType: "paragraph",
      blockIndex: 0,
      textHash: "hash:0",
      textSnippet: "paragraph text",
      charRange: { start: 0, end: 14 },
    },
    body: "New review",
  });
  expect(result.container.querySelector('[role="dialog"]')).toBeNull();
  result.unmount();
});

test("annotation から edit dialog を開いて update action へ委譲する", async () => {
  const comment = createComment();
  const props = createLayerProps({ comments: [comment] });
  const result = renderLayer(props);
  const toggle = result.container.querySelector<HTMLButtonElement>(
    ".markdown-comment-annotation__toggle",
  );
  act(() => toggle?.click());
  const editButton = result.container.querySelector<HTMLButtonElement>(
    ".markdown-comment-annotation__select",
  );
  act(() => editButton?.click());

  const textarea = result.container.querySelector<HTMLTextAreaElement>(
    ".add-comment-popover--edit textarea",
  );
  expect(textarea?.value).toBe(comment.body);
  act(() => inputTextarea(textarea as HTMLTextAreaElement, "Updated body"));
  const form = result.container.querySelector<HTMLFormElement>(
    ".add-comment-popover--edit form",
  );
  await act(async () => form?.requestSubmit());

  expect(props.actions.update).toHaveBeenCalledWith(comment.id, "Updated body");
  result.unmount();
});

test("delete が false を返すと edit popover に error を表示する", async () => {
  const comment = createComment();
  const baseProps = createLayerProps({ comments: [comment] });
  const props = {
    ...baseProps,
    actions: {
      ...baseProps.actions,
      delete: vi.fn().mockResolvedValue(false),
    },
  };
  const result = renderLayer(props);
  const toggle = result.container.querySelector<HTMLButtonElement>(
    ".markdown-comment-annotation__toggle",
  );
  act(() => toggle?.click());
  const editButton = result.container.querySelector<HTMLButtonElement>(
    ".markdown-comment-annotation__select",
  );
  act(() => editButton?.click());
  const requestDeleteButton = result.container.querySelector<HTMLButtonElement>(
    ".add-comment-popover__status-actions .button--danger",
  );
  act(() => requestDeleteButton?.click());
  const confirmDeleteButton = result.container.querySelector<HTMLButtonElement>(
    ".add-comment-popover__confirm .button--danger",
  );

  await act(async () => confirmDeleteButton?.click());

  const error = result.container.querySelector(".add-comment-popover__error");
  expect(error).not.toBeNull();
  expect(error?.textContent).toContain("コメントを削除できませんでした");
  result.unmount();
});

test("comment preview は省略記号を含めて84文字以内に収める", () => {
  const comment = { ...createComment(), body: "x".repeat(85) };
  const result = renderLayer(createLayerProps({ comments: [comment] }));
  const toggle = result.container.querySelector<HTMLButtonElement>(
    ".markdown-comment-annotation__toggle",
  );

  act(() => toggle?.click());

  const preview = result.container.querySelector(
    ".markdown-comment-annotation__preview",
  );
  expect(preview?.textContent).toBe("x".repeat(81) + "...");
  expect(preview?.textContent).toHaveLength(84);
  result.unmount();
});

test("edit popover は表示中かつ操作可能な間だけ outside click listener を登録する", () => {
  const addEventListener = vi.spyOn(document, "addEventListener");
  const comment = createComment();
  const props = createLayerProps({ comments: [comment] });
  const result = renderLayer(props);

  expect(
    addEventListener.mock.calls.filter(([eventName]) => eventName === "mousedown"),
  ).toHaveLength(0);

  const toggle = result.container.querySelector<HTMLButtonElement>(
    ".markdown-comment-annotation__toggle",
  );
  act(() => toggle?.click());
  const editButton = result.container.querySelector<HTMLButtonElement>(
    ".markdown-comment-annotation__select",
  );
  act(() => editButton?.click());

  expect(
    addEventListener.mock.calls.filter(([eventName]) => eventName === "mousedown"),
  ).toHaveLength(1);

  result.rerender({
    ...props,
    editState: { ...props.editState, isSaving: true },
  });

  expect(
    addEventListener.mock.calls.filter(([eventName]) => eventName === "mousedown"),
  ).toHaveLength(1);
  result.unmount();
  addEventListener.mockRestore();
});

test("resolved comment は inline projection と annotation から除外する", () => {
  const result = renderLayer(
    createLayerProps({ comments: [createComment("resolved")] }),
  );

  expect(
    result.container.querySelector("[data-comment-highlight-range]"),
  ).toBeNull();
  expect(
    result.container.querySelector(".markdown-comment-annotation"),
  ).toBeNull();
  result.unmount();
});

test("同じ入力の親 rerender では port と callback の参照を維持する", () => {
  let currentPort: RenderedDocumentPort | null = null;
  const props = createLayerProps({
    children: (port) => {
      currentPort = port;
      return <RenderedDocumentPortHarness port={port} />;
    },
  });
  const result = renderLayer(props);
  const initialPort = currentPort as unknown as RenderedDocumentPort;
  const initialProjectBlock = initialPort.projectBlock;
  const initialRenderOverlay = initialPort.renderOverlay;

  result.rerender(props);

  const rerenderedPort = currentPort as unknown as RenderedDocumentPort;
  expect(rerenderedPort).toBe(initialPort);
  expect(rerenderedPort.projectBlock).toBe(initialProjectBlock);
  expect(rerenderedPort.renderOverlay).toBe(initialRenderOverlay);
  result.unmount();
});
