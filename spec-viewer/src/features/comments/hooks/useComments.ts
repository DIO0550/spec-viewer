import { useMemo } from "react";

import {
  commentCommands as defaultCommentCommands,
  type CommentCommands,
} from "@/shared/api/tauri";
import { CommentScope } from "@/features/comments/domain/commentScope";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import {
  useCommentList,
  type CommentListState,
} from "@/features/comments/hooks/useCommentList";
import {
  useCommentMutations,
  type AddCommentInput,
  type CommentMutationState,
  type UpdateCommentInput,
} from "@/features/comments/hooks/useCommentMutations";
import type { CommentId } from "@/features/comments/types/comment";
import type { Comment } from "@/features/comments/types/comment";
import type { SpecFileKey } from "@/features/specs/types/spec";
import type { NormalizedCommandError } from "@/shared/types/ipc";

export type {
  AddCommentInput,
  CommentMutationOperation,
  CommentMutationState,
  UpdateCommentInput,
} from "@/features/comments/hooks/useCommentMutations";
export type { CommentListState } from "@/features/comments/hooks/useCommentList";

export type UseCommentsOptions = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  statusFilter?: CommentStatusFilter | null;
  correlationId?: string | null;
  commands?: CommentCommands;
}>;

export type UseCommentsResult = Readonly<{
  listState: CommentListState;
  mutationState: CommentMutationState;
  comments: readonly Comment[];
  isLoading: boolean;
  isSaving: boolean;
  isEmpty: boolean;
  error: NormalizedCommandError | null;
  mutationError: NormalizedCommandError | null;
  reloadComments: () => Promise<boolean>;
  addComment: (input: AddCommentInput) => Promise<Comment | null>;
  updateComment: (input: UpdateCommentInput) => Promise<Comment | null>;
  deleteComment: (commentId: CommentId) => Promise<boolean>;
  resolveComment: (commentId: CommentId) => Promise<Comment | null>;
  reopenComment: (commentId: CommentId) => Promise<Comment | null>;
  toggleCommentResolved: (commentId: CommentId) => Promise<Comment | null>;
}>;

const defaultStatusFilter: CommentStatusFilter = CommentStatusFilter.All;

/** @returns Comment loading and mutation state for the selected spec file. */
export function useComments(options: UseCommentsOptions): UseCommentsResult {
  const statusFilter =
    CommentStatusFilter.parse(options.statusFilter) ?? defaultStatusFilter;
  const commands = options.commands ?? defaultCommentCommands;
  const scope = useMemo(
    () =>
      CommentScope.create({
        workspacePath: options.workspacePath,
        specId: options.specId,
        fileKey: options.fileKey,
      }),
    [options.fileKey, options.specId, options.workspacePath],
  );
  const {
    listState,
    reloadComments,
    scopeKey,
    updateCurrentScopeComments,
  } = useCommentList({
    scope,
    statusFilter,
    commands,
    correlationId: options.correlationId,
  });

  const commentOperations = useCommentMutations({
    scope,
    scopeKey,
    statusFilter,
    commands,
    currentComments: listState.comments,
    updateCurrentScopeComments,
    reloadComments,
  });

  return {
    listState,
    mutationState: commentOperations.operationState,
    comments: listState.comments,
    isLoading: listState.status === "loading",
    isSaving: commentOperations.operationState.status === "saving",
    isEmpty: listState.status === "empty",
    error: listState.error,
    mutationError: commentOperations.operationState.error,
    reloadComments,
    addComment: commentOperations.addComment,
    updateComment: commentOperations.updateComment,
    deleteComment: commentOperations.deleteComment,
    resolveComment: commentOperations.resolveComment,
    reopenComment: commentOperations.reopenComment,
    toggleCommentResolved: commentOperations.toggleCommentResolved,
  };
}
