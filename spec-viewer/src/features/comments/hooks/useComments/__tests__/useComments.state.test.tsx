import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { Comment } from "@/features/comments/domain/comment";
import type { CommentAnchor } from "@/features/comments/domain/commentAnchor";
import { CommentId } from "@/features/comments/domain/commentId";
import type { CommentScope } from "@/features/comments/domain/commentScope";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import { useCommentOperations } from "@/features/comments/hooks/useCommentOperations";
import { useComments } from "@/features/comments/hooks/useComments";
import { createCommentCommandTestDouble } from "@/features/comments/testing/comment-command-test-double";
import type { ListCommentsResponse } from "@/features/comments/types/comment";
import type { CommentCommands } from "@/lib/api/tauri";
import { configurePerformanceLoggerForTest } from "@/lib/performance";

const commentId = CommentId.fromString;

const anchor: CommentAnchor = {
  fileKey: "tasks",
  blockType: "paragraph",
  blockIndex: 0,
  textHash: "sha256:first",
  textSnippet: "Clarify this task",
  charRange: {
    start: 0,
    end: 18,
  },
};

const firstComment: Comment = {
  id: commentId("cmt_1"),
  anchor,
  body: "Clarify this task",
  status: "open",
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

const resolvedComment: Comment = {
  ...firstComment,
  status: "resolved",
  updatedAt: "2026-05-05T10:10:00Z",
};

const tasksScope: CommentScope = {
  workspacePath: "/workspace/spec-reviewer",
  specId: "phase-2-comments",
  fileKey: "tasks",
};

const designScope: CommentScope = {
  ...tasksScope,
  fileKey: "requirements",
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

function renderUseComments(props: HookProps) {
  return renderHook(
    ({ scope, statusFilter, commands }) =>
      useComments({
        scope,
        statusFilter,
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
  const double = createCommentCommandTestDouble({
    listComments: { comments: [firstComment] },
    addComment: secondComment,
    updateComment: {
      ...firstComment,
      body: "Updated body",
      updatedAt: "2026-05-05T10:15:00Z",
    },
    resolveComment: resolvedComment,
    reopenComment: firstComment,
  });

  return {
    ...double.commands,
    ...overrides,
  };
}

test("useCommentsはscope未選択ならidleでコメントを読み込まない", async () => {
  const double = createCommentCommandTestDouble();
  const result = renderUseComments({
    scope: null,
    commands: double.commands,
  });

  await flushAsyncEffects();

  expect(result.current.listState.status).toBe("idle");
  expect(result.current.comments).toEqual([]);
  expect(double.calls.listComments).toEqual([]);
  result.unmount();
});

test("useCommentsはscopeが揃うとコメント一覧を読み込む", async () => {
  const double = createCommentCommandTestDouble({
    listComments: { comments: [firstComment] },
  });
  const result = renderUseComments({
    scope: tasksScope,
    commands: double.commands,
  });

  await flushAsyncEffects();

  expect(result.current.listState.status).toBe("ready");
  expect(result.current.comments).toEqual([firstComment]);
  expect(double.calls.listComments).toEqual([
    {
      workspacePath: "/workspace/spec-reviewer",
      specId: "phase-2-comments",
      fileKey: "tasks",
      statusFilter: "all",
    },
  ]);
  result.unmount();
});

test.each([
  [CommentStatusFilter.Open, "open"],
  [CommentStatusFilter.Resolved, "resolved"],
] as const)("useCommentsは%s filterを文字列payloadとして一覧requestへ渡す", async (statusFilter, expectedStatusFilter) => {
  const double = createCommentCommandTestDouble();
  const result = renderUseComments({
    scope: tasksScope,
    statusFilter,
    commands: double.commands,
  });

  await flushAsyncEffects();

  expect(double.calls.listComments).toEqual([
    {
      workspacePath: "/workspace/spec-reviewer",
      specId: "phase-2-comments",
      fileKey: "tasks",
      statusFilter: expectedStatusFilter,
    },
  ]);
  result.unmount();
});

test("useCommentsは空のコメント一覧をempty状態として返す", async () => {
  const double = createCommentCommandTestDouble({
    listComments: { comments: [] },
  });
  const result = renderUseComments({
    scope: tasksScope,
    commands: double.commands,
  });

  await flushAsyncEffects();

  expect(result.current.listState.status).toBe("empty");
  expect(result.current.comments).toEqual([]);
  result.unmount();
});

test("useCommentsは読み込み失敗をerror状態として返す", async () => {
  const commands = createCommands({
    listComments: vi.fn().mockRejectedValue("comment load failed"),
  });
  const result = renderUseComments({
    scope: tasksScope,
    commands,
  });

  await flushAsyncEffects();

  expect(result.current.listState).toMatchObject({
    status: "error",
    error: {
      feature: "comments",
      code: "unknown",
      message: "comment load failed",
      cause: {
        command: "list_comments",
        code: "unknown",
        message: "comment load failed",
        raw: "comment load failed",
      },
    },
  });
  result.unmount();
});

test("useCommentsは読み込み失敗時もperformance spanを記録する", async () => {
  configurePerformanceLoggerForTest(true);
  const debugSpy = vi
    .spyOn(console, "debug")
    .mockImplementation(() => undefined);
  const commands = createCommands({
    listComments: vi.fn().mockRejectedValue("comment load failed"),
  });
  const result = renderUseComments({
    scope: tasksScope,
    commands,
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
  result.unmount();
  debugSpy.mockRestore();
  configurePerformanceLoggerForTest(null);
});

test("useCommentsはscope変更時にリセットして再読み込みする", async () => {
  const secondLoad = createDeferred<ListCommentsResponse>();
  const listComments = vi
    .fn()
    .mockResolvedValueOnce({ comments: [firstComment] })
    .mockReturnValueOnce(secondLoad.promise);
  const result = renderUseComments({
    scope: tasksScope,
    commands: createCommands({ listComments }),
  });

  await flushAsyncEffects();
  result.rerender({
    scope: designScope,
    commands: createCommands({ listComments }),
  });

  expect(result.current.listState.status).toBe("loading");
  expect(result.current.comments).toEqual([]);

  secondLoad.resolve({ comments: [secondComment] });
  await flushAsyncEffects();

  expect(result.current.comments).toEqual([secondComment]);
  expect(listComments).toHaveBeenLastCalledWith({
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "requirements",
    statusFilter: "all",
  });
  result.unmount();
});

test("useCommentsはコメント追加中のsaving状態と追加後の一覧を返す", async () => {
  const addDeferred = createDeferred<Comment>();
  const commands = createCommands({
    addComment: vi.fn().mockReturnValue(addDeferred.promise),
  });
  const result = renderUseComments({
    scope: tasksScope,
    commands,
  });

  await flushAsyncEffects();

  let addPromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    addPromise = result.current.addComment({
      anchor: secondComment.anchor,
      body: secondComment.body,
    });
  });

  expect(result.current.operationState).toEqual({
    status: "saving",
    operation: "add",
    commentId: null,
    error: null,
  });

  addDeferred.resolve(secondComment);
  await act(async () => {
    await addPromise;
  });

  expect(result.current.comments).toEqual([firstComment, secondComment]);
  expect(result.current.operationState.status).toBe("idle");
  result.unmount();
});

test("useCommentsはloading中のコメント追加成功を古い一覧responseで上書きしない", async () => {
  const listDeferred = createDeferred<ListCommentsResponse>();
  const addDeferred = createDeferred<Comment>();
  const commands = createCommands({
    listComments: vi.fn().mockReturnValue(listDeferred.promise),
    addComment: vi.fn().mockReturnValue(addDeferred.promise),
  });
  const result = renderUseComments({
    scope: tasksScope,
    commands,
  });

  await flushAsyncEffects();
  expect(result.current.listState.status).toBe("loading");

  let addPromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    addPromise = result.current.addComment({
      anchor: secondComment.anchor,
      body: secondComment.body,
    });
  });

  addDeferred.resolve(secondComment);
  await act(async () => {
    await expect(addPromise).resolves.toEqual(secondComment);
  });

  expect(result.current.comments).toEqual([secondComment]);
  expect(result.current.listState.status).toBe("ready");

  listDeferred.resolve({ comments: [firstComment] });
  await flushAsyncEffects();

  expect(result.current.comments).toEqual([secondComment]);
  result.unmount();
});

test("useCommentsはscope変更後に完了したコメント追加を現在の一覧へ反映しない", async () => {
  const addDeferred = createDeferred<Comment>();
  const commands = createCommands({
    addComment: vi.fn().mockReturnValue(addDeferred.promise),
  });
  const result = renderUseComments({
    scope: tasksScope,
    commands,
  });

  await flushAsyncEffects();

  let addPromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    addPromise = result.current.addComment({
      anchor: secondComment.anchor,
      body: secondComment.body,
    });
  });

  result.rerender({
    scope: designScope,
    commands,
  });
  await flushAsyncEffects();

  addDeferred.resolve(secondComment);
  await act(async () => {
    await expect(addPromise).resolves.toBeNull();
  });

  expect(result.current.comments).toEqual([firstComment]);
  expect(result.current.operationState.status).toBe("idle");
  result.unmount();
});

test("useCommentsはコメント本文を更新して一覧へ反映する", async () => {
  const commands = createCommands();
  const result = renderUseComments({
    scope: tasksScope,
    commands,
  });

  await flushAsyncEffects();
  await act(async () => {
    await result.current.updateComment({
      commentId: commentId("cmt_1"),
      body: "Updated body",
    });
  });

  expect(result.current.comments[0]?.body).toBe("Updated body");
  result.unmount();
});

test("useCommentsは同一scopeで古いoperation完了を現在の一覧へ反映しない", async () => {
  const updateDeferred = createDeferred<Comment>();
  const resolveDeferred = createDeferred<Comment>();
  const commands = createCommands({
    updateComment: vi.fn().mockReturnValue(updateDeferred.promise),
    resolveComment: vi.fn().mockReturnValue(resolveDeferred.promise),
  });
  const result = renderUseComments({
    scope: tasksScope,
    commands,
  });

  await flushAsyncEffects();

  let updatePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    updatePromise = result.current.updateComment({
      commentId: commentId("cmt_1"),
      body: "Updated body",
    });
  });
  expect(result.current.operationState.operation).toBe("update");

  let resolvePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    resolvePromise = result.current.resolveComment(commentId("cmt_1"));
  });
  expect(result.current.operationState.operation).toBe("resolve");

  resolveDeferred.resolve(resolvedComment);
  await act(async () => {
    await expect(resolvePromise).resolves.toEqual(resolvedComment);
  });
  expect(result.current.comments).toEqual([resolvedComment]);
  expect(result.current.operationState.status).toBe("idle");

  updateDeferred.resolve({
    ...firstComment,
    body: "Updated body",
    updatedAt: "2026-05-05T10:15:00Z",
  });
  await act(async () => {
    await expect(updatePromise).resolves.toBeNull();
  });

  expect(result.current.comments).toEqual([resolvedComment]);
  expect(result.current.operationState.status).toBe("idle");
  result.unmount();
});

test("useCommentsはコメント削除後に一覧を再取得する", async () => {
  const listComments = vi
    .fn()
    .mockResolvedValueOnce({ comments: [firstComment, secondComment] })
    .mockResolvedValueOnce({ comments: [secondComment] });
  const commands = createCommands({ listComments });
  const result = renderUseComments({
    scope: tasksScope,
    commands,
  });

  await flushAsyncEffects();
  await act(async () => {
    await result.current.deleteComment(commentId("cmt_1"));
  });

  expect(result.current.comments).toEqual([secondComment]);
  expect(listComments).toHaveBeenCalledTimes(2);
  result.unmount();
});

test("useCommentsは削除未成立なら一覧を維持してsaving状態を解除する", async () => {
  const listComments = vi.fn().mockResolvedValue({ comments: [firstComment] });
  const commands = createCommands({
    deleteComment: vi.fn().mockResolvedValue({ deleted: false }),
    listComments,
  });
  const result = renderUseComments({
    scope: tasksScope,
    commands,
  });

  await flushAsyncEffects();
  let deleteResult = true;
  await act(async () => {
    deleteResult = await result.current.deleteComment(commentId("cmt_1"));
  });

  expect(deleteResult).toBe(false);
  expect(result.current.comments).toEqual([firstComment]);
  expect(result.current.operationState.status).toBe("idle");
  expect(listComments).toHaveBeenCalledTimes(1);
  result.unmount();
});

test("useCommentsはresolveとreopenを一覧へ反映する", async () => {
  const commands = createCommands();
  const result = renderUseComments({
    scope: tasksScope,
    commands,
  });

  await flushAsyncEffects();
  await act(async () => {
    await result.current.resolveComment(commentId("cmt_1"));
  });
  expect(result.current.comments).toEqual([resolvedComment]);

  await act(async () => {
    await result.current.reopenComment(commentId("cmt_1"));
  });
  expect(result.current.comments).toEqual([firstComment]);
  result.unmount();
});

test("useCommentOperationsはreloadComments変更時に進行中operationを無効化する", async () => {
  const addDeferred = createDeferred<Comment>();
  const commands = createCommands({
    addComment: vi.fn().mockReturnValue(addDeferred.promise),
  });
  const updateCurrentScopeComments = vi.fn();
  const firstReloadComments = vi.fn().mockResolvedValue(true);
  const secondReloadComments = vi.fn().mockResolvedValue(true);
  const result = renderHook(
    ({
      reloadComments,
    }: Readonly<{ reloadComments: () => Promise<boolean> }>) =>
      useCommentOperations({
        scope: {
          workspacePath: "/workspace/spec-reviewer",
          specId: "phase-2-comments",
          fileKey: "tasks",
        },
        scopeKey: "/workspace/spec-reviewer:phase-2-comments:tasks",
        statusFilter: CommentStatusFilter.All,
        commands,
        updateCurrentScopeComments,
        reloadComments,
      }),
    { reloadComments: firstReloadComments },
  );

  let addPromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    addPromise = result.current.addComment({
      anchor: secondComment.anchor,
      body: secondComment.body,
    });
  });
  expect(result.current.operationState.status).toBe("saving");

  result.rerender({ reloadComments: secondReloadComments });

  expect(result.current.operationState.status).toBe("idle");

  addDeferred.resolve(secondComment);
  await act(async () => {
    await expect(addPromise).resolves.toBeNull();
  });
  expect(updateCurrentScopeComments).not.toHaveBeenCalled();
  result.unmount();
});

test("useCommentsはscope変更後に失敗したoperation errorを表示しない", async () => {
  const resolveDeferred = createDeferred<Comment>();
  const listComments = vi
    .fn()
    .mockResolvedValueOnce({ comments: [firstComment] })
    .mockResolvedValueOnce({ comments: [secondComment] });
  const commands = createCommands({
    listComments,
    resolveComment: vi.fn().mockReturnValue(resolveDeferred.promise),
  });
  const result = renderUseComments({
    scope: tasksScope,
    commands,
  });

  await flushAsyncEffects();

  let resolvePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    resolvePromise = result.current.resolveComment(commentId("cmt_1"));
  });

  result.rerender({
    scope: designScope,
    commands,
  });
  await flushAsyncEffects();

  resolveDeferred.reject("resolve failed");
  await act(async () => {
    await expect(resolvePromise).resolves.toBeNull();
  });

  expect(result.current.comments).toEqual([secondComment]);
  expect(result.current.operationState.status).toBe("idle");
  result.unmount();
});
