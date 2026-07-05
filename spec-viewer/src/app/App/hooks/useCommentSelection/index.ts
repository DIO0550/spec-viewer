import { useCallback, useEffect, useState } from "react";
import type {
  NavigationDirection,
  SpecViewResetKeys,
} from "@/app/App/hooks/types";
import type {
  AddCommentSubmitInput,
  Comment,
  CommentAnchorDisplayState,
  CommentId,
} from "@/features/comments";
import { CommentListState } from "@/features/comments/domain/commentListState";

/** useComments の戻り値のうち本フックが使う操作のみの狭い構造的型（DI テスト容易性のため）。 */
export type CommentSelectionCommentActions = Readonly<{
  /** Adds a new comment. @param input - Anchor and body of the comment to add. */
  addComment: (input: AddCommentSubmitInput) => Promise<Comment | null>;
  /** Updates a comment body. */
  updateComment: (
    input: Readonly<{ commentId: CommentId; body: string }>,
  ) => Promise<Comment | null>;
  /** Deletes a comment. @param commentId - Id of the comment to delete. */
  deleteComment: (commentId: CommentId) => Promise<boolean>;
  /** Resolves a comment. @param commentId - Id of the comment to resolve. */
  resolveComment: (commentId: CommentId) => Promise<Comment | null>;
  /** Reopens a resolved comment. @param commentId - Id of the comment to reopen. */
  reopenComment: (commentId: CommentId) => Promise<Comment | null>;
}>;

export type UseCommentSelectionOptions = Readonly<{
  comments: readonly Comment[];
  listState: CommentListState;
  commentActions: CommentSelectionCommentActions;
  /** Opens the comment sidebar. */
  openSidebar: () => void;
  resetKeys: SpecViewResetKeys;
}>;

export type UseCommentSelectionResult = Readonly<{
  activeCommentId: CommentId | null;
  commentAnchorDisplayStates: readonly CommentAnchorDisplayState[];
  /** Selects a comment and opens the sidebar. @param commentId - Id of the comment to select. */
  selectComment: (commentId: CommentId) => void;
  /** Clears the active comment selection. */
  clearActiveComment: () => void;
  /** Adds a comment and selects it. @param input - Anchor and body of the comment to add. */
  addComment: (input: AddCommentSubmitInput) => Promise<boolean>;
  /** Updates a comment body. @param commentId - Id of the target comment. @param body - New comment body. */
  updateComment: (commentId: CommentId, body: string) => Promise<boolean>;
  /** Resolves a comment. @param commentId - Id of the comment to resolve. */
  resolveComment: (commentId: CommentId) => void;
  /** Reopens a resolved comment. @param commentId - Id of the comment to reopen. */
  reopenComment: (commentId: CommentId) => void;
  /** Deletes a comment. @param commentId - Id of the comment to delete. */
  deleteComment: (commentId: CommentId) => void;
  /** Resolves an inline comment. @param commentId - Id of the comment to resolve. */
  resolveInlineComment: (commentId: CommentId) => Promise<boolean>;
  /** Reopens an inline comment. @param commentId - Id of the comment to reopen. */
  reopenInlineComment: (commentId: CommentId) => Promise<boolean>;
  /** Deletes an inline comment. @param commentId - Id of the comment to delete. */
  deleteInlineComment: (commentId: CommentId) => Promise<boolean>;
  /** Selects the adjacent comment. @param direction - Navigation direction. */
  selectAdjacentComment: (direction: NavigationDirection) => boolean;
  /** Replaces the comment anchor display states. */
  updateCommentAnchorDisplayStates: (
    states: readonly CommentAnchorDisplayState[],
  ) => void;
}>;

/**
 * @param options - Comment list, list state, comment actions, sidebar opener and reset keys.
 * @returns Active-comment selection state and comment interaction handlers.
 */
export function useCommentSelection(
  options: UseCommentSelectionOptions,
): UseCommentSelectionResult {
  const { comments, listState, commentActions, openSidebar, resetKeys } =
    options;

  const [activeCommentId, setActiveCommentId] = useState<CommentId | null>(
    null,
  );
  const [commentAnchorDisplayStates, setCommentAnchorDisplayStates] = useState<
    readonly CommentAnchorDisplayState[]
  >([]);

  useEffect(() => {
    setActiveCommentId(null);
    setCommentAnchorDisplayStates([]);
  }, [resetKeys.fileKey, resetKeys.specId, resetKeys.workspaceRoot]);

  useEffect(() => {
    if (!CommentListState.isLoaded(listState)) {
      return;
    }

    const hasActiveComment = comments.some(
      (comment) => comment.id === activeCommentId,
    );

    if (activeCommentId !== null && !hasActiveComment) {
      setActiveCommentId(null);
    }
  }, [activeCommentId, comments, listState]);

  const selectComment = useCallback(
    (commentId: CommentId): void => {
      setActiveCommentId(commentId);
      openSidebar();
    },
    [openSidebar],
  );

  const clearActiveComment = useCallback((): void => {
    setActiveCommentId(null);
  }, []);

  const updateCommentAnchorDisplayStates = useCallback(
    (nextStates: readonly CommentAnchorDisplayState[]): void => {
      setCommentAnchorDisplayStates(nextStates);
    },
    [],
  );

  const addComment = useCallback(
    async ({ anchor, body }: AddCommentSubmitInput): Promise<boolean> => {
      const addedComment = await commentActions.addComment({ anchor, body });

      if (addedComment === null) {
        return false;
      }

      setActiveCommentId(addedComment.id);
      return true;
    },
    [commentActions],
  );

  const updateComment = useCallback(
    async (commentId: CommentId, body: string): Promise<boolean> => {
      const updatedComment = await commentActions.updateComment({
        commentId,
        body,
      });

      return updatedComment !== null;
    },
    [commentActions],
  );

  const resolveComment = useCallback(
    (commentId: CommentId): void => {
      void commentActions.resolveComment(commentId);
    },
    [commentActions],
  );

  const reopenComment = useCallback(
    (commentId: CommentId): void => {
      void commentActions.reopenComment(commentId);
    },
    [commentActions],
  );

  const resolveInlineComment = useCallback(
    async (commentId: CommentId): Promise<boolean> => {
      const resolvedComment = await commentActions.resolveComment(commentId);

      return resolvedComment !== null;
    },
    [commentActions],
  );

  const reopenInlineComment = useCallback(
    async (commentId: CommentId): Promise<boolean> => {
      const reopenedComment = await commentActions.reopenComment(commentId);

      return reopenedComment !== null;
    },
    [commentActions],
  );

  const deleteInlineComment = useCallback(
    async (commentId: CommentId): Promise<boolean> => {
      if (commentId === activeCommentId) {
        setActiveCommentId(null);
      }

      return commentActions.deleteComment(commentId);
    },
    [activeCommentId, commentActions],
  );

  const deleteComment = useCallback(
    (commentId: CommentId): void => {
      if (commentId === activeCommentId) {
        setActiveCommentId(null);
      }

      void commentActions.deleteComment(commentId);
    },
    [activeCommentId, commentActions],
  );

  const selectAdjacentComment = useCallback(
    (direction: NavigationDirection): boolean => {
      if (comments.length === 0) {
        return false;
      }

      const currentIndex = comments.findIndex(
        (comment) => comment.id === activeCommentId,
      );
      const offset = direction === "next" ? 1 : -1;
      const nextIndex =
        currentIndex < 0
          ? selectFallbackCommentIndex(direction, comments.length)
          : (currentIndex + offset + comments.length) % comments.length;
      const nextCommentId = comments[nextIndex]?.id;

      if (nextCommentId === undefined) {
        return false;
      }

      setActiveCommentId(nextCommentId);
      return true;
    },
    [activeCommentId, comments],
  );

  return {
    activeCommentId,
    commentAnchorDisplayStates,
    selectComment,
    clearActiveComment,
    addComment,
    updateComment,
    resolveComment,
    reopenComment,
    deleteComment,
    resolveInlineComment,
    reopenInlineComment,
    deleteInlineComment,
    selectAdjacentComment,
    updateCommentAnchorDisplayStates,
  };
}

/** @returns The first or last comment index when no comment is active yet. */
function selectFallbackCommentIndex(
  direction: NavigationDirection,
  commentCount: number,
): number {
  if (direction === "next") {
    return 0;
  }

  return Math.max(commentCount - 1, 0);
}
