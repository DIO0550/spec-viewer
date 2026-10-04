import { CommentThread } from "@/features/comments/components/CommentThread";
import type { Comment } from "@/features/comments/domain/comment";
import type { CommentId } from "@/features/comments/domain/commentId";
import type { CommentOperationState } from "@/features/comments/domain/commentOperation";
import type { CommentAnchorDisplayStatus } from "@/features/comments/types/comment";

export type CommentSectionActions = Readonly<{
  /**
   * Selects the given comment.
   * @param commentId - The comment to select.
   */
  onSelectComment: (commentId: CommentId) => void;
  /**
   * Marks the given comment as resolved.
   * @param commentId - The comment to resolve.
   */
  onResolveComment: (commentId: CommentId) => void;
  /**
   * Reopens the given resolved comment.
   * @param commentId - The comment to reopen.
   */
  onReopenComment: (commentId: CommentId) => void;
  /**
   * Deletes the given comment.
   * @param commentId - The comment to delete.
   */
  onDeleteComment: (commentId: CommentId) => void;
  /**
   * Updates the given comment's body.
   * @param commentId - The comment to update.
   * @param body - The new comment body text.
   */
  onUpdateComment: (commentId: CommentId, body: string) => void;
}>;

type SectionProps = Readonly<{
  id: string;
  title: string;
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  anchorDisplayStatusByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >;
  searchQuery: string;
  operationState: CommentOperationState;
  emptyMessage: string;
  actions: CommentSectionActions;
}>;

/** @returns One grouped comment section with its count badge. */
export function CommentSection({
  id,
  title,
  comments,
  activeCommentId,
  anchorDisplayStatusByCommentId,
  searchQuery,
  operationState,
  emptyMessage,
  actions,
}: SectionProps) {
  return (
    <section className="comment-sidebar__section" aria-labelledby={id}>
      <div className="comment-sidebar__section-header">
        <h3 id={id}>{title}</h3>
        <span title={`${title} comment count`}>{comments.length}</span>
      </div>
      {comments.length === 0 ? (
        <p className="comment-sidebar__section-empty">{emptyMessage}</p>
      ) : (
        <ul className="comment-sidebar__list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <CommentThread
                comment={comment}
                isActive={comment.id === activeCommentId}
                anchorDisplayStatus={
                  anchorDisplayStatusByCommentId.get(comment.id) ?? "exact"
                }
                searchQuery={searchQuery}
                operationState={operationState}
                {...actions}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
