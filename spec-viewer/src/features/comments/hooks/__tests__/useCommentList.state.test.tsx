import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import { useCommentList } from "@/features/comments/hooks/useCommentList";
import { createCommentCommandTestDouble } from "@/features/comments/testing/comment-command-test-double";
import { CommentId } from "@/features/comments/types/comment";
import { configurePerformanceLoggerForTest } from "@/shared/lib/performance";
import type { CommentScope } from "@/features/comments/domain/commentScope";
import type { Comment, ListCommentsResponse } from "@/features/comments/types/comment";
import type { CommentCommands } from "@/shared/api/tauri";

const commentId = CommentId.fromString;

const activeScope: CommentScope = {
  workspacePath: "/workspace/spec-reviewer",
  specId: "phase-2-comments",
  fileKey: "tasks",
};

const designScope: CommentScope = {
  ...activeScope,
  fileKey: "design",
};

const firstComment: Comment = {
  id: commentId("cmt_1"),
  anchor: {
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 0,
    textHash: "sha256:first",
    textSnippet: "Clarify this task",
    charRange: {
      start: 0,
      end: 18,
    },
  },
  body: "Clarify this task",
  status: "open",
  resolved: false,
  createdAt: "2026-05-05T10:00:00Z",
  updatedAt: "2026-05-05T10:00:00Z",
};

const secondComment: Comment = {
  ...firstComment,
  id: commentId("cmt_2"),
  body: "Add acceptance criteria",
  createdAt: "2026-05-05T10:05:00Z",
  updatedAt: "2026-05-05T10:05:00Z",
};

type HookProps = Readonly<{
  scope: CommentScope | null;
  statusFilter?: CommentStatusFilter;
  commands: CommentCommands;
}>;

type HookResult<Props, Result> = Readonly<{
  current: Result;
  rerender: (nextProps: Props) => void;
  unmount: () => void;
}>;

type Deferred<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}>;

function renderHook<Props, Result>(
  hook: (props: Props) => Result,
  initialProps: Props,
): HookResult<Props, Result> {
  const container = document.createElement("div");
  const root = createRoot(container);
  const props = { current: initialProps };
  const result = { current: undefined as Result };

  function TestComponent(): null {
    result.current = hook(props.current);
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    get current() {
      return result.current;
    },
    rerender: (nextProps: Props) => {
      props.current = nextProps;
      act(() => {
        root.render(<TestComponent />);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

function renderUseCommentList(props: HookProps) {
  return renderHook(
    ({ commands, scope, statusFilter }) =>
      useCommentList({
        scope,
        statusFilter: statusFilter ?? CommentStatusFilter.All,
        commands,
      }),
    props,
  );
}

async function flushAsyncEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

function createCommands(
  overrides: Partial<CommentCommands> = {},
): CommentCommands {
  const double = createCommentCommandTestDouble();

  return {
    ...double.commands,
    ...overrides,
  };
}

test("useCommentListはscope未選択ならidleでコメントを読み込まない", async () => {
  const double = createCommentCommandTestDouble();
  const result = renderUseCommentList({
    scope: null,
    commands: double.commands,
  });

  await flushAsyncEffects();

  expect(result.current.listState.status).toBe("idle");
  expect(result.current.listState.comments).toEqual([]);
  expect(double.calls.listComments).toEqual([]);
  result.unmount();
});

test("useCommentListはready empty error状態へ遷移する", async () => {
  const readyDouble = createCommentCommandTestDouble({
    listComments: { comments: [firstComment] },
  });
  const emptyDouble = createCommentCommandTestDouble({
    listComments: { comments: [] },
  });
  const errorCommands = createCommands({
    listComments: vi.fn().mockRejectedValue("comment load failed"),
  });

  const readyResult = renderUseCommentList({
    scope: activeScope,
    commands: readyDouble.commands,
  });
  await flushAsyncEffects();
  expect(readyResult.current.listState.status).toBe("ready");
  expect(readyResult.current.listState.comments).toEqual([firstComment]);
  readyResult.unmount();

  const emptyResult = renderUseCommentList({
    scope: activeScope,
    commands: emptyDouble.commands,
  });
  await flushAsyncEffects();
  expect(emptyResult.current.listState.status).toBe("empty");
  expect(emptyResult.current.listState.comments).toEqual([]);
  emptyResult.unmount();

  const errorResult = renderUseCommentList({
    scope: activeScope,
    commands: errorCommands,
  });
  await flushAsyncEffects();
  expect(errorResult.current.listState).toMatchObject({
    status: "error",
    error: {
      code: "unknown",
      message: "comment load failed",
      raw: "comment load failed",
    },
  });
  errorResult.unmount();
});

test("useCommentListはscope変更後に古い一覧responseでstateを更新しない", async () => {
  const firstLoad = createDeferred<ListCommentsResponse>();
  const secondLoad = createDeferred<ListCommentsResponse>();
  const listComments = vi
    .fn()
    .mockReturnValueOnce(firstLoad.promise)
    .mockReturnValueOnce(secondLoad.promise);
  const commands = createCommands({ listComments });
  const result = renderUseCommentList({
    scope: activeScope,
    commands,
  });

  await flushAsyncEffects();
  result.rerender({
    scope: designScope,
    commands,
  });

  secondLoad.resolve({ comments: [secondComment] });
  await flushAsyncEffects();
  expect(result.current.listState.comments).toEqual([secondComment]);

  firstLoad.resolve({ comments: [firstComment] });
  await flushAsyncEffects();
  expect(result.current.listState.comments).toEqual([secondComment]);
  result.unmount();
});

test("useCommentListはloading中の更新で古い一覧responseを無効化する", async () => {
  const listLoad = createDeferred<ListCommentsResponse>();
  const commands = createCommands({
    listComments: vi.fn().mockReturnValue(listLoad.promise),
  });
  const result = renderUseCommentList({
    scope: activeScope,
    commands,
  });

  await flushAsyncEffects();
  expect(result.current.listState.status).toBe("loading");

  act(() => {
    result.current.updateCurrentScopeComments(() => [secondComment]);
  });
  expect(result.current.listState.comments).toEqual([secondComment]);

  listLoad.resolve({ comments: [firstComment] });
  await flushAsyncEffects();
  expect(result.current.listState.comments).toEqual([secondComment]);
  result.unmount();
});

test("useCommentListはsuccessとfailureでcomments.list performance spanを記録する", async () => {
  configurePerformanceLoggerForTest(true);
  const debugSpy = vi
    .spyOn(console, "debug")
    .mockImplementation(() => undefined);
  const successResult = renderUseCommentList({
    scope: activeScope,
    commands: createCommentCommandTestDouble({
      listComments: { comments: [firstComment] },
    }).commands,
  });

  await flushAsyncEffects();
  expect(debugSpy).toHaveBeenCalledWith(
    "[spec-viewer:perf]",
    expect.objectContaining({
      type: "span",
      phase: "comments.list",
      metadata: expect.objectContaining({
        commentCount: 1,
      }),
    }),
  );
  successResult.unmount();

  debugSpy.mockClear();
  const errorCommands = createCommands({
    listComments: vi.fn().mockRejectedValue("comment load failed"),
  });
  const errorResult = renderUseCommentList({
    scope: activeScope,
    commands: errorCommands,
  });

  await flushAsyncEffects();
  expect(debugSpy).toHaveBeenCalledWith(
    "[spec-viewer:perf]",
    expect.objectContaining({
      type: "span",
      phase: "comments.list",
      metadata: expect.objectContaining({
        error: true,
      }),
    }),
  );
  errorResult.unmount();
  debugSpy.mockRestore();
  configurePerformanceLoggerForTest(null);
});
