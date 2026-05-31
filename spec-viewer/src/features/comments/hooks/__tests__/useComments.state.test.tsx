import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { createCommentCommandTestDouble } from "@/features/comments/testing/comment-command-test-double";
import { configurePerformanceLoggerForTest } from "@/shared/lib/performance";
import type { CommentCommands } from "@/shared/api/tauri";
import type {
  Comment,
  CommentAnchor,
  ListCommentsResponse,
} from "@/features/comments/types/comment";
import { CommentId } from "@/features/comments/types/comment";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import type { SpecFileKey } from "@/features/specs/types/spec";
import { useCommentOperations } from "@/features/comments/hooks/useCommentOperations";
import { useComments } from "@/features/comments/hooks/useComments";

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

const resolvedComment: Comment = {
  ...firstComment,
  status: "resolved",
  resolved: true,
  updatedAt: "2026-05-05T10:10:00Z",
};

const optimisticResolvedComment: Comment = {
  ...firstComment,
  status: "resolved",
  resolved: true,
};

type HookProps = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
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
    ({ workspacePath, specId, fileKey, statusFilter, commands }) =>
      useComments({
        workspacePath,
        specId,
        fileKey,
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
    toggleCommentResolved: resolvedComment,
  });

  return {
    ...double.commands,
    ...overrides,
  };
}

test("useCommentsはscope未選択ならidleでコメントを読み込まない", async () => {
  const double = createCommentCommandTestDouble();
  const result = renderUseComments({
    workspacePath: null,
    specId: "phase-2-comments",
    fileKey: "tasks",
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
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
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
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
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
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
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
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
    commands,
  });

  await flushAsyncEffects();

  expect(result.current.listState).toMatchObject({
    status: "error",
    error: {
      code: "unknown",
      message: "comment load failed",
      raw: "comment load failed",
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
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
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
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
    commands: createCommands({ listComments }),
  });

  await flushAsyncEffects();
  result.rerender({
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "design",
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
    fileKey: "design",
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
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
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
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
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
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
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
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "design",
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
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
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
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
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
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
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
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
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
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
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

test("useCommentsはresolve toggleを楽観更新して成功結果で確定する", async () => {
  const toggleDeferred = createDeferred<Comment>();
  const commands = createCommands({
    toggleCommentResolved: vi.fn().mockReturnValue(toggleDeferred.promise),
  });
  const result = renderUseComments({
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
    commands,
  });

  await flushAsyncEffects();

  let togglePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    togglePromise = result.current.toggleCommentResolved(commentId("cmt_1"));
  });

  expect(result.current.comments).toEqual([optimisticResolvedComment]);

  toggleDeferred.resolve(resolvedComment);
  await act(async () => {
    await togglePromise;
  });

  expect(result.current.comments).toEqual([resolvedComment]);
  expect(result.current.operationState.status).toBe("idle");
  result.unmount();
});

test("useCommentOperationsはscope未選択時にtoggleの楽観更新を行わない", async () => {
  const updateCurrentScopeComments = vi.fn();
  const reloadComments = vi.fn().mockResolvedValue(true);
  const commands = createCommands({
    toggleCommentResolved: vi.fn().mockResolvedValue(resolvedComment),
  });
  const result = renderHook(
    () =>
      useCommentOperations({
        scope: null,
        scopeKey: "no-scope",
        statusFilter: CommentStatusFilter.All,
        commands,
        currentComments: [firstComment],
        updateCurrentScopeComments,
        reloadComments,
      }),
    undefined,
  );

  let toggleResult: Comment | null = resolvedComment;
  await act(async () => {
    toggleResult = await result.current.toggleCommentResolved(
      commentId("cmt_1"),
    );
  });

  expect(toggleResult).toBeNull();
  expect(result.current.operationState.status).toBe("idle");
  expect(updateCurrentScopeComments).not.toHaveBeenCalled();
  expect(commands.toggleCommentResolved).not.toHaveBeenCalled();
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
        currentComments: [],
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

test("useCommentsはresolve toggle失敗時に楽観更新を巻き戻す", async () => {
  const toggleDeferred = createDeferred<Comment>();
  const commands = createCommands({
    toggleCommentResolved: vi.fn().mockReturnValue(toggleDeferred.promise),
  });
  const result = renderUseComments({
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
    commands,
  });

  await flushAsyncEffects();

  let togglePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    togglePromise = result.current.toggleCommentResolved(commentId("cmt_1"));
  });

  expect(result.current.comments).toEqual([optimisticResolvedComment]);

  toggleDeferred.reject("toggle failed");
  await act(async () => {
    await togglePromise;
  });

  expect(result.current.comments).toEqual([firstComment]);
  expect(result.current.operationState).toEqual({
    status: "error",
    operation: "toggle",
    commentId: commentId("cmt_1"),
    error: {
      code: "unknown",
      message: "toggle failed",
      raw: "toggle failed",
    },
  });
  result.unmount();
});

test("useCommentsはscope変更後に失敗したoperation errorを表示しない", async () => {
  const toggleDeferred = createDeferred<Comment>();
  const listComments = vi
    .fn()
    .mockResolvedValueOnce({ comments: [firstComment] })
    .mockResolvedValueOnce({ comments: [secondComment] });
  const commands = createCommands({
    listComments,
    toggleCommentResolved: vi.fn().mockReturnValue(toggleDeferred.promise),
  });
  const result = renderUseComments({
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "tasks",
    commands,
  });

  await flushAsyncEffects();

  let togglePromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    togglePromise = result.current.toggleCommentResolved(commentId("cmt_1"));
  });

  result.rerender({
    workspacePath: "/workspace/spec-reviewer",
    specId: "phase-2-comments",
    fileKey: "design",
    commands,
  });
  await flushAsyncEffects();

  toggleDeferred.reject("toggle failed");
  await act(async () => {
    await expect(togglePromise).resolves.toBeNull();
  });

  expect(result.current.comments).toEqual([secondComment]);
  expect(result.current.operationState.status).toBe("idle");
  result.unmount();
});
