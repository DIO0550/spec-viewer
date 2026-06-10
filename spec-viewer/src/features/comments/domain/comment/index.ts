import {
  type CommentStatus,
  CommentStatusFilter,
  type CommentStatusFilter as CommentStatusFilterType,
} from "@/features/comments/domain/commentStatusFilter";
import { Comments } from "@/features/comments/domain/comments";
import type {
  CommentAnchor,
  CommentAnchorResolution,
  CommentId,
  IsoDateTimeString,
} from "@/features/comments/types/comment";

export type Comment = Readonly<{
  id: CommentId;
  anchor: CommentAnchor;
  body: string;
  status: CommentStatus;
  resolved: boolean;
  anchorResolution?: CommentAnchorResolution | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}>;

export type CreateCommentInput = Comment;

export const Comment = {
  /** @returns New comment value preserving the existing IPC-compatible shape. */
  create(input: CreateCommentInput): Comment {
    return { ...input };
  },
  /**
   * @param comment - Existing comment value
   * @param body - Replacement body text
   * @returns Comment with only the body changed.
   */
  updateBody(comment: Comment, body: string): Comment {
    return { ...comment, body };
  },
  /** @returns Comment with resolved status and flag synchronized. */
  resolve(comment: Comment): Comment {
    return { ...comment, status: "resolved", resolved: true };
  },
  /** @returns Comment with open status and unresolved flag synchronized. */
  reopen(comment: Comment): Comment {
    return { ...comment, status: "open", resolved: false };
  },
  /** @returns Comment with resolved state inverted. */
  toggleResolved(comment: Comment): Comment {
    if (comment.resolved) {
      return Comment.reopen(comment);
    }

    return Comment.resolve(comment);
  },
  /**
   * @param current - Existing comment in local state
   * @param next - Incoming command result
   * @returns Incoming comment with known anchor resolution preserved when omitted.
   */
  preserveAnchorResolution(
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
  },
  /**
   * @param comment - Comment to evaluate
   * @param statusFilter - Active status filter
   * @returns True when the filter should include the comment.
   */
  shouldDisplay(
    comment: Comment,
    statusFilter: CommentStatusFilterType,
  ): boolean {
    return CommentStatusFilter.matches(statusFilter, comment.status);
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
    return Comments.appendDisplayable(comments, comment, statusFilter);
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
    return Comments.upsertDisplayable(comments, comment, statusFilter);
  },
  /**
   * @param comments - Current visible comments
   * @param commentId - Comment id to toggle locally
   * @param statusFilter - Active status filter
   * @returns Comments after an optimistic resolved-state toggle.
   */
  upsertOptimisticToggle(
    comments: readonly Comment[],
    commentId: CommentId,
    statusFilter: CommentStatusFilterType,
  ): readonly Comment[] {
    return Comments.upsertOptimisticToggle(comments, commentId, statusFilter);
  },
} as const;
