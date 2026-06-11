import type { Comment, CommentId } from "@/features/comments/types/comment";

export type CommentNavigationDirection = "next" | "previous";

const FIRST_COMMENT_INDEX = 0;

type ResolveActiveCommentIdInput = Readonly<{
  selectedCommentId: CommentId | null;
  isListLoaded: boolean;
  comments: readonly Comment[];
}>;

type AdjacentCommentIdInput = Readonly<{
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  direction: CommentNavigationDirection;
}>;

/** @returns The first or last comment index when no comment is active yet. */
function fallbackCommentIndex(
  direction: CommentNavigationDirection,
  commentCount: number,
): number {
  if (direction === "next") {
    return FIRST_COMMENT_INDEX;
  }

  return Math.max(commentCount - 1, FIRST_COMMENT_INDEX);
}

export const CommentSelection = {
  /**
   * @param input - Stored selection, list readiness, and visible comments
   * @returns The selected comment id, or null when it left the loaded list.
   */
  resolveActiveCommentId({
    selectedCommentId,
    isListLoaded,
    comments,
  }: ResolveActiveCommentIdInput): CommentId | null {
    if (selectedCommentId === null) {
      return null;
    }

    if (!isListLoaded) {
      return selectedCommentId;
    }

    const hasSelectedComment = comments.some(
      (comment) => comment.id === selectedCommentId,
    );

    if (!hasSelectedComment) {
      return null;
    }

    return selectedCommentId;
  },
  /**
   * @param input - Visible comments, active selection, and navigation direction
   * @returns The wrapped adjacent comment id, or null when no comments exist.
   */
  adjacentCommentId({
    comments,
    activeCommentId,
    direction,
  }: AdjacentCommentIdInput): CommentId | null {
    if (comments.length === 0) {
      return null;
    }

    const currentIndex = comments.findIndex(
      (comment) => comment.id === activeCommentId,
    );
    const offset = direction === "next" ? 1 : -1;
    const nextIndex =
      currentIndex < 0
        ? fallbackCommentIndex(direction, comments.length)
        : (currentIndex + offset + comments.length) % comments.length;

    return comments[nextIndex]?.id ?? null;
  },
} as const;
