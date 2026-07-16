import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { vi } from "vitest";
import type { CommentCommands } from "@/features/comments/application/ports/commentCommands";
import {
  CommentScope,
  type CommentScope as CommentScopeType,
} from "@/features/comments/domain/commentScope";
import type { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import {
  type UseCommentsResult,
  useComments,
} from "@/features/comments/hooks/useComments";
import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
import { createCommentCommandTestDouble } from "@/features/comments/testing/comment-command-test-double";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";
import type {
  Comment,
  ListCommentsResponse,
} from "@/features/comments/types/comment";
import { SpecViewSelection } from "@/shared/domain/specViewSelection";
import { WorkspacePath } from "@/shared/domain/workspacePath";
import * as TestValues from "@/shared/testing/validatedValueObjects";

export type CommentsHostProps = Readonly<{
  commands: CommentCommands;
  content: ReactNode;
  scope: CommentScopeType;
  statusFilter: CommentStatusFilter;
}>;
export type Deferred<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}>;
export type UseCommentsHarness = Readonly<{
  current: UseCommentsResult;
  rerender: (props: Omit<CommentsHostProps, "content">) => void;
  unmount: () => void;
}>;
export const addedComment: Comment = createCommentTestFixture({
  id: "cmt_concurrent",
  anchor: createCommentAnchorTestFixture({
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 0,
    textHash: "sha256:c0ffee02",
    textSnippet: "Keep the committed selection",
    charRange: { start: 0, end: 28 },
  }),
  body: "Keep the committed selection",
  createdAt: "2026-07-11T12:00:00Z",
  updatedAt: "2026-07-11T12:00:00Z",
});
/** @returns Deferred promise controlled by a concurrent hook test. */
export function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
/**
 * @param initialProps - Initial comment hook dependencies.
 * @returns Hook harness supporting committed prop changes.
 */
export function renderUseComments(
  initialProps: Omit<CommentsHostProps, "content">,
): UseCommentsHarness {
  const container = document.createElement("div");
  const root = createRoot(container);
  const props = { current: initialProps };
  const result = { current: undefined as unknown as UseCommentsResult };

  function TestComponent(): null {
    result.current = useComments(props.current);
    return null;
  }

  act(() => {
    root.render(createElement(TestComponent));
  });

  return {
    get current() {
      return result.current;
    },
    rerender: (nextProps) => {
      props.current = nextProps;
      act(() => {
        root.render(createElement(TestComponent));
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
/**
 * @param options - Pending list and add command promises.
 * @returns Commands whose list reload and add operation stay pending.
 */
export function createConcurrentCommands(
  options: Readonly<{
    listPromise: Promise<ListCommentsResponse>;
    addPromise: Promise<Comment>;
  }>,
): CommentCommands {
  const baseCommands = createCommentCommandTestDouble({
    addComment: addedComment,
    listComments: { comments: [] },
  }).commands;
  return {
    ...baseCommands,
    listComments: vi
      .fn()
      .mockResolvedValueOnce({ comments: [] })
      .mockReturnValueOnce(options.listPromise),
    addComment: vi.fn().mockReturnValue(options.addPromise),
  };
}
/** Flushes passive effects and immediately resolved command promises. */
export async function flushAsyncEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
/**
 * @param fileKey - File key selected by the test render.
 * @returns Complete comment scope for the selected file.
 */
function createCommentScope(fileKey: "tasks" | "design"): CommentScopeType {
  const selection = SpecViewSelection.synchronize(SpecViewSelection.empty(), {
    workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
    specId: TestValues.specId("phase-2-comments"),
    fileKey,
  });
  return CommentScope.fromSelection(selection) as CommentScopeType;
}

export const tasksScope = createCommentScope("tasks");
export const designScope = createCommentScope("design");
