import { useCallback, useEffect, useState } from "react";

import { CommentListState } from "@/features/comments/domain/commentListState";
import {
  type CommentNavigationDirection,
  CommentSelection,
} from "@/features/comments/domain/commentSelection";
import type {
  Comment,
  CommentAnchorDisplayState,
  CommentId,
} from "@/features/comments/types/comment";

type UseCommentSelectionOptions = Readonly<{
  comments: readonly Comment[];
  listState: CommentListState;
  resetKey: string;
}>;

export type UseCommentSelectionResult = Readonly<{
  activeCommentId: CommentId | null;
  anchorDisplayStates: readonly CommentAnchorDisplayState[];
  /** @param commentId - Comment to highlight across the viewer and sidebar */
  activateComment: (commentId: CommentId) => void;
  /** Clears the highlighted comment. */
  clearActiveComment: () => void;
  /** @param commentId - Comment whose highlight should be cleared when active */
  clearIfActive: (commentId: CommentId) => void;
  /** @param direction - Wrap-around navigation direction over visible comments */
  selectAdjacentComment: (direction: CommentNavigationDirection) => void;
  /** @param states - Anchor display states derived from the rendered document */
  updateAnchorDisplayStates: (
    states: readonly CommentAnchorDisplayState[],
  ) => void;
}>;

/**
 * Tracks which comment is highlighted and how its anchors currently render.
 *
 * @param options - Visible comments, list state, and the view reset key
 * @returns Active comment selection state and navigation operations.
 */
export function useCommentSelection({
  comments,
  listState,
  resetKey,
}: UseCommentSelectionOptions): UseCommentSelectionResult {
  const [selectedCommentId, setSelectedCommentId] = useState<CommentId | null>(
    null,
  );
  const [anchorDisplayStates, setAnchorDisplayStates] = useState<
    readonly CommentAnchorDisplayState[]
  >([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies(resetKey): 表示ビューの切り替え（resetKey変更）を契機に選択状態を初期化するための意図的な依存
  useEffect(() => {
    setSelectedCommentId(null);
    setAnchorDisplayStates([]);
  }, [resetKey]);

  const activeCommentId = CommentSelection.resolveActiveCommentId({
    selectedCommentId,
    isListLoaded: CommentListState.isLoaded(listState),
    comments,
  });

  const activateComment = useCallback((commentId: CommentId): void => {
    setSelectedCommentId(commentId);
  }, []);

  const clearActiveComment = useCallback((): void => {
    setSelectedCommentId(null);
  }, []);

  const clearIfActive = useCallback((commentId: CommentId): void => {
    setSelectedCommentId((currentCommentId) =>
      currentCommentId === commentId ? null : currentCommentId,
    );
  }, []);

  const selectAdjacentComment = useCallback(
    (direction: CommentNavigationDirection): void => {
      const nextCommentId = CommentSelection.adjacentCommentId({
        comments,
        activeCommentId,
        direction,
      });

      if (nextCommentId === null) {
        return;
      }

      setSelectedCommentId(nextCommentId);
    },
    [activeCommentId, comments],
  );

  const updateAnchorDisplayStates = useCallback(
    (nextStates: readonly CommentAnchorDisplayState[]): void => {
      setAnchorDisplayStates(nextStates);
    },
    [],
  );

  return {
    activeCommentId,
    anchorDisplayStates,
    activateComment,
    clearActiveComment,
    clearIfActive,
    selectAdjacentComment,
    updateAnchorDisplayStates,
  };
}
