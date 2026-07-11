import {
  act,
  type ReactNode,
  Suspense,
  startTransition,
  useLayoutEffect,
} from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import {
  type UseCommentsResult,
  useComments,
} from "@/features/comments/hooks/useComments";
import {
  addedComment,
  type CommentsHostProps,
  createConcurrentCommands,
  createDeferred,
  designScope,
  flushAsyncEffects,
  tasksScope,
} from "@/features/comments/hooks/useComments/__tests__/useComments.concurrent.fixture";
import type { Comment } from "@/features/comments/types/comment";

test.each([
  ["scope変更", designScope, CommentStatusFilter.All],
  ["filter変更", tasksScope, CommentStatusFilter.Resolved],
] as const)("%sの中断renderがAのlist・operation結果を誤破棄しない", async (_label, nextScope, nextStatusFilter) => {
  const listDeferred = createDeferred<{ comments: readonly Comment[] }>();
  const addDeferred = createDeferred<Comment>();
  const suspendedRenderAttempted = createDeferred<void>();
  const suspendedRender = new Promise<never>(() => undefined);
  const commands = createConcurrentCommands({
    listPromise: listDeferred.promise,
    addPromise: addDeferred.promise,
  });
  const committedResult = {
    current: undefined as unknown as UseCommentsResult,
  };

  function CommentsHost({
    commands: hostCommands,
    content,
    scope,
    statusFilter,
  }: CommentsHostProps): ReactNode {
    const result = useComments({
      commands: hostCommands,
      scope,
      statusFilter,
    });
    useLayoutEffect(() => {
      committedResult.current = result;
    });
    return content;
  }

  function SuspendRender(): never {
    suspendedRenderAttempted.resolve();
    throw suspendedRender;
  }

  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(
      <Suspense fallback={null}>
        <CommentsHost
          commands={commands}
          content={null}
          scope={tasksScope}
          statusFilter={CommentStatusFilter.All}
        />
      </Suspense>,
    );
  });
  await flushAsyncEffects();

  let reloadPromise: Promise<boolean> = Promise.resolve(false);
  act(() => {
    reloadPromise = committedResult.current.reloadComments();
  });
  let addPromise: Promise<Comment | null> = Promise.resolve(null);
  act(() => {
    addPromise = committedResult.current.addComment({
      anchor: addedComment.anchor,
      body: addedComment.body,
    });
  });

  act(() => {
    startTransition(() => {
      root.render(
        <Suspense fallback={null}>
          <CommentsHost
            commands={commands}
            content={<SuspendRender />}
            scope={nextScope}
            statusFilter={nextStatusFilter}
          />
        </Suspense>,
      );
    });
  });
  await suspendedRenderAttempted.promise;

  listDeferred.resolve({ comments: [] });
  let reloadSucceeded = false;
  await act(async () => {
    reloadSucceeded = await reloadPromise;
  });
  addDeferred.resolve(addedComment);
  let addResult: Comment | null = null;
  await act(async () => {
    addResult = await addPromise;
  });
  const comments = committedResult.current.comments;
  const operationStatus = committedResult.current.operationState.status;

  act(() => {
    root.render(
      <Suspense fallback={null}>
        <CommentsHost
          commands={commands}
          content={null}
          scope={tasksScope}
          statusFilter={CommentStatusFilter.All}
        />
      </Suspense>,
    );
  });
  act(() => {
    root.unmount();
  });
  container.remove();

  expect(reloadSucceeded).toBe(true);
  expect(addResult).toEqual(addedComment);
  expect(comments).toEqual([addedComment]);
  expect(operationStatus).toBe("idle");
});
