import { CommentThread } from "@/features/comments/components/CommentThread";
import type { CommentOperationState } from "@/features/comments/domain/commentOperation";
import type {
  Comment,
  CommentAnchorDisplayStatus,
  CommentId,
} from "@/features/comments/types/comment";

const defaultAnchorDisplayStatus: CommentAnchorDisplayStatus = "exact";

type Props = Readonly<{
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
  /** @param commentId - Comment selected from the section list */
  onSelectComment: (commentId: CommentId) => void;
  /** @param commentId - Comment to resolve */
  onResolveComment: (commentId: CommentId) => void;
  /** @param commentId - Comment to reopen */
  onReopenComment: (commentId: CommentId) => void;
  /** @param commentId - Comment to delete */
  onDeleteComment: (commentId: CommentId) => void;
  /**
   * @param commentId - Comment being edited
   * @param body - Replacement body text
   */
  onUpdateComment: (commentId: CommentId, body: string) => void;
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
  onSelectComment,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
  onUpdateComment,
}: Props) {
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
                  anchorDisplayStatusByCommentId.get(comment.id) ??
                  defaultAnchorDisplayStatus
                }
                searchQuery={searchQuery}
                operationState={operationState}
                onSelectComment={onSelectComment}
                onResolveComment={onResolveComment}
                onReopenComment={onReopenComment}
                onDeleteComment={onDeleteComment}
                onUpdateComment={onUpdateComment}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
