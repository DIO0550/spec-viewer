import type { Comment } from "@/features/comments/types/comment";
import { uiText } from "@/shared/lib/uiText";

type Props = Readonly<{
  comment: Comment;
  isOperatingComment: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}>;

/** @returns The destructive delete confirmation block for one comment. */
export function CommentThreadDeleteConfirm({
  comment,
  isOperatingComment,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="comment-thread__confirm" role="alert">
      <p>{uiText.commentThread.confirmDelete}</p>
      <div className="comment-thread__confirm-actions">
        <button
          className="button button--danger"
          type="button"
          aria-label={`${uiText.commentThread.confirmDeleteAction} ${comment.id}`}
          disabled={isOperatingComment}
          onClick={onConfirm}
        >
          {uiText.commentThread.delete}
        </button>
        <button
          className="button button--secondary"
          type="button"
          aria-label={`${uiText.commentThread.cancelDeleteAction} ${comment.id}`}
          disabled={isOperatingComment}
          onClick={onCancel}
        >
          {uiText.commentThread.cancel}
        </button>
      </div>
    </div>
  );
}
