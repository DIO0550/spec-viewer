import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { Comment } from "@/features/comments/domain/comment";
import { CommentId } from "@/features/comments/domain/commentId";
import type { CommentAnchorDraft } from "@/features/comments/types/comment";
import {
  type MarkdownViewerCommentActions,
  useMarkdownViewerComments,
} from "@/features/comments/hooks/useMarkdownViewerComments";

const commentId = CommentId.fromString;

function createComment(id = "cmt_1"): Comment {
  return {
    id: commentId(id),
    anchor: {
      fileKey: "requirements",
      blockType: "paragraph",
      blockIndex: 0,
      textHash: "hash:0",
      textSnippet: "paragraph",
      charRange: { start: 0, end: 9 },
    },
    body: `${id} body`,
    status: "open",
    anchorResolution: null,
    createdAt: "2026-09-03T00:00:00Z",
    updatedAt: "2026-09-03T00:00:00Z",
  };
}

function createAnchorDraft(): CommentAnchorDraft {
  return {
    anchor: createComment().anchor,
    selectionBounds: { top: 10, left: 20, width: 30, height: 12 },
  };
}

function createActions(
  overrides: Partial<MarkdownViewerCommentActions> = {},
): MarkdownViewerCommentActions {
  return {
    add: vi.fn().mockResolvedValue(true),
    update: vi.fn().mockResolvedValue(true),
    resolve: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(true),
    select: vi.fn(),
    reportAnchorDisplayStates: vi.fn(),
    ...overrides,
  };
}

type HookHandle<TResult, TProps> = Readonly<{
  result: { current: TResult };
  rerender: (props: TProps) => void;
  unmount: () => void;
}>;

function renderHook<TResult, TProps = undefined>(
  render: (props: TProps) => TResult,
  options?: Readonly<{ initialProps: TProps }>,
): HookHandle<TResult, TProps> {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = {
    current: undefined as unknown as TResult,
  };

  function TestComponent(props: Readonly<{ hookProps: TProps }>): null {
    result.current = render(props.hookProps);
    return null;
  }

  act(() => {
    root.render(<TestComponent hookProps={options?.initialProps as TProps} />);
  });

  return {
    result,
    rerender: (hookProps) => {
      act(() => {
        root.render(<TestComponent hookProps={hookProps} />);
      });
    },
    unmount: () => {
      act(() => root.unmount());
    },
  };
}

test("render commit 後に anchor state を報告し projection を更新する", () => {
  const comment = createComment();
  const actions = createActions();
  const readAnchorDisplayStates = vi.fn(() => [
    { commentId: comment.id, status: "exact" as const },
  ]);
  const { result } = renderHook(() =>
    useMarkdownViewerComments({
      fileKey: "requirements",
      comments: [comment],
      activeCommentId: null,
      actions,
      readAnchorDisplayStates,
      scrollActiveComment: vi.fn(),
    }),
  );

  act(() => {
    result.current.reconcileRenderedDocument();
  });

  expect(readAnchorDisplayStates).toHaveBeenCalledTimes(1);
  expect(actions.reportAnchorDisplayStates).toHaveBeenLastCalledWith([
    { commentId: comment.id, status: "exact" },
  ]);
  expect(result.current.projections.has("paragraph:0")).toBe(true);
});

test("初回 render commit の anchor state を mount effect で上書きしない", () => {
  const comment = createComment();
  const actions = createActions();

  function useControllerWithRenderCommit() {
    const controller = useMarkdownViewerComments({
      fileKey: "requirements",
      comments: [comment],
      activeCommentId: null,
      actions,
      readAnchorDisplayStates: () => [
        { commentId: comment.id, status: "stale" as const },
      ],
      scrollActiveComment: vi.fn(),
    });

    useLayoutEffect(() => {
      controller.reconcileRenderedDocument();
    }, [controller.reconcileRenderedDocument]);

    return controller;
  }

  const { result } = renderHook(useControllerWithRenderCommit);

  expect(result.current.anchorDisplayStates).toEqual([
    { commentId: comment.id, status: "stale" },
  ]);
  expect(result.current.projections.get("paragraph:0")?.state).toBe("stale");
});

test("fileKey が変わると draft と anchor state を reset する", () => {
  const comment = createComment();
  const actions = createActions();
  const options = {
    comments: [comment],
    activeCommentId: null,
    actions,
    readAnchorDisplayStates: () => [
      { commentId: comment.id, status: "exact" as const },
    ],
    scrollActiveComment: vi.fn(),
  } as const;
  const { result, rerender } = renderHook(
    ({ fileKey }: { fileKey: "requirements" | "tasks" }) =>
      useMarkdownViewerComments({ fileKey, ...options }),
    {
      initialProps: { fileKey: "requirements" } as Readonly<{
        fileKey: "requirements" | "tasks";
      }>,
    },
  );

  act(() => {
    result.current.beginAnchorDraft(createAnchorDraft());
    result.current.beginEditDraft({
      comment,
      selectionBounds: { top: 1, left: 2, width: 3, height: 4 },
    });
    result.current.reconcileRenderedDocument();
  });
  rerender({ fileKey: "tasks" });

  expect(result.current.anchorDraft).toBeNull();
  expect(result.current.editDraft).toBeNull();
  expect(result.current.anchorDisplayStates).toEqual([]);
});

test.each([
  ["add", true, true],
  ["add", false, false],
  ["update", true, true],
  ["update", false, false],
  ["delete", true, true],
  ["delete", false, false],
] as const)("%s が %s のとき対応 draft の close=%s", async (operation, succeeds, closes) => {
  const comment = createComment();
  const actions = createActions({
    [operation]: vi.fn().mockResolvedValue(succeeds),
  });
  const { result } = renderHook(() =>
    useMarkdownViewerComments({
      fileKey: "requirements",
      comments: [comment],
      activeCommentId: null,
      actions,
      readAnchorDisplayStates: () => [],
      scrollActiveComment: vi.fn(),
    }),
  );

  act(() => {
    const prepareDraft = {
      add: () => result.current.beginAnchorDraft(createAnchorDraft()),
      update: () =>
        result.current.beginEditDraft({
          comment,
          selectionBounds: { top: 1, left: 2, width: 3, height: 4 },
        }),
      delete: () =>
        result.current.beginEditDraft({
          comment,
          selectionBounds: { top: 1, left: 2, width: 3, height: 4 },
        }),
    } as const;
    prepareDraft[operation]();
  });
  await act(async () => {
    const submissions = {
      add: () =>
        result.current.submitAdd({ anchor: comment.anchor, body: "new" }),
      update: () => result.current.submitUpdate(comment.id, "updated"),
      delete: () => result.current.submitDelete(comment.id),
    } as const;
    await submissions[operation]();
  });

  const remainingDraft =
    operation === "add" ? result.current.anchorDraft : result.current.editDraft;
  expect(remainingDraft === null).toBe(closes);
});

test("active comment の変更を注入された scroll callback へ委譲する", () => {
  const comment = createComment();
  const actions = createActions();
  const scrollActiveComment = vi.fn();
  renderHook(() =>
    useMarkdownViewerComments({
      fileKey: "requirements",
      comments: [comment],
      activeCommentId: comment.id,
      actions,
      readAnchorDisplayStates: () => [],
      scrollActiveComment,
    }),
  );

  expect(scrollActiveComment).toHaveBeenCalledWith(comment);
});
