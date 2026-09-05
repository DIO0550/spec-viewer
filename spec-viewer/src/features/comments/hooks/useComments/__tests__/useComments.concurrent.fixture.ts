import { act, type ReactNode } from "react";
import { vi } from "vitest";

import {
  CommentScope,
  type CommentScope as CommentScopeType,
} from "@/features/comments/domain/commentScope";
import type { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import { createCommentCommandTestDouble } from "@/features/comments/testing/comment-command-test-double";
import type { Comment } from "@/features/comments/domain/comment";
import type { ListCommentsResponse } from "@/features/comments/types/comment";
import { CommentId } from "@/features/comments/domain/commentId";
import { SpecViewSelection } from "@/features/specs/domain/specViewSelection";
import type { CommentCommands } from "@/lib/api/tauri";
import { WorkspacePath } from "@/domains/workspacePath";

export type CommentsHostProps = Readonly<{
  commands: CommentCommands;
  content: ReactNode;
  scope: CommentScopeType;
  statusFilter: CommentStatusFilter;
}>;

export type Deferred<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
}>;

export const addedComment: Comment = {
  id: CommentId.fromString("cmt_concurrent"),
  anchor: {
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 0,
    textHash: "sha256:concurrent",
    textSnippet: "Keep the committed selection",
    charRange: { start: 0, end: 28 },
  },
  body: "Keep the committed selection",
  status: "open",
  createdAt: "2026-07-11T12:00:00Z",
  updatedAt: "2026-07-11T12:00:00Z",
};

/** @returns Deferred promise controlled by a concurrent hook test. */
export function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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
function createCommentScope(
  fileKey: "tasks" | "requirements",
): CommentScopeType {
  const selection = SpecViewSelection.synchronize(SpecViewSelection.empty(), {
    workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
    specId: "phase-2-comments",
    fileKey,
  });
  return CommentScope.fromSelection(selection) as CommentScopeType;
}

export const tasksScope = createCommentScope("tasks");
export const designScope = createCommentScope("requirements");
