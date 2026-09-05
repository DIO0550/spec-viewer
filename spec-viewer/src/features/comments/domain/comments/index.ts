import type { Comment } from "@/features/comments/domain/comment";
import {
  CommentStatusFilter,
  type CommentStatusFilter as CommentStatusFilterType,
} from "@/features/comments/domain/commentStatusFilter";

declare const commentsBrand: unique symbol;

export type Comments = readonly Comment[] & {
  readonly [commentsBrand]: "Comments";
};

export const Comments = {
  /** @returns Branded comments collection with a readonly array shape. */
  create(comments: readonly Comment[]): Comments {
    return comments as Comments;
  },
  /** @returns The collection as a readonly comment array. */
  toArray(comments: Comments): readonly Comment[] {
    return comments;
  },
  /**
   * @param comments - Current visible comments
   * @param comment - Comment to append when displayable
   * @param statusFilter - Active status filter
   * @returns Comments with the displayable comment appended once.
   */
  appendDisplayable(
    comments: readonly Comment[],
    comment: Comment,
    statusFilter: CommentStatusFilterType,
  ): readonly Comment[] {
    if (!shouldDisplay(comment, statusFilter)) {
      return comments;
    }

    if (comments.some((currentComment) => currentComment.id === comment.id)) {
      return comments;
    }

    return Comments.create([...comments, comment]);
  },
  /**
   * @param comments - Current visible comments
   * @param comment - Incoming command result
   * @param statusFilter - Active status filter
   * @returns Comments with the comment inserted, replaced, or removed by filter.
   */
  upsertDisplayable(
    comments: readonly Comment[],
    comment: Comment,
    statusFilter: CommentStatusFilterType,
  ): readonly Comment[] {
    const currentComment = comments.find(
      (candidate) => candidate.id === comment.id,
    );
    const commentWithResolution = preserveAnchorResolution(
      currentComment,
      comment,
    );

    if (!shouldDisplay(commentWithResolution, statusFilter)) {
      if (currentComment === undefined) {
        return comments;
      }

      return Comments.create(
        comments.filter(
          (candidate) => candidate.id !== commentWithResolution.id,
        ),
      );
    }

    if (currentComment === undefined) {
      return Comments.create([...comments, commentWithResolution]);
    }

    return Comments.create(
      comments.map((candidate) =>
        candidate.id === commentWithResolution.id
          ? commentWithResolution
          : candidate,
      ),
    );
  },
} as const;

/** @returns Incoming comment with known anchor resolution preserved when omitted. */
function preserveAnchorResolution(
  current: Comment | undefined,
  next: Comment,
): Comment {
  if (next.anchorResolution !== undefined && next.anchorResolution !== null) {
    return next;
  }

  if (current?.anchorResolution === undefined) {
    return next;
  }

  return { ...next, anchorResolution: current.anchorResolution };
}

/** @returns True when the filter should include the comment. */
function shouldDisplay(
  comment: Comment,
  statusFilter: CommentStatusFilterType,
): boolean {
  return CommentStatusFilter.matches(statusFilter, comment.status);
}
