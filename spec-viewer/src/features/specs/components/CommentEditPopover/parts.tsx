import { CheckCircle2, Pencil, RotateCcw, Trash2, X } from "lucide-react";

import type { CommentId } from "@/features/comments/types/comment";
import { uiText } from "@/shared/lib/uiText";

type CommentEditPopoverHeaderProps = Readonly<{
  titleId: string;
  isBusy: boolean;
  /** Closes the edit dialog without saving. */
  onCancel: () => void;
}>;

/** @returns The edit dialog header with its cancel control. */
export function CommentEditPopoverHeader({
  titleId,
  isBusy,
  onCancel,
}: CommentEditPopoverHeaderProps) {
  return (
    <header className="add-comment-popover__header">
      <div>
        <span className="add-comment-popover__eyebrow">
          <Pencil aria-hidden="true" size={14} />
          既存コメント
        </span>
        <h2 id={titleId} className="add-comment-popover__title">
          コメント編集
        </h2>
      </div>
      <button
        className="icon-button add-comment-popover__close-button"
        type="button"
        aria-label="コメント編集をキャンセル"
        onClick={onCancel}
        disabled={isBusy}
      >
        <X aria-hidden="true" size={14} />
      </button>
    </header>
  );
}

type DeleteConfirmationProps = Readonly<{
  commentId: CommentId;
  isBusy: boolean;
  /** Deletes the comment after confirmation. */
  onConfirm: () => void;
  /** Dismisses the delete confirmation. */
  onCancel: () => void;
}>;

/** @returns An inline confirmation prompt before deleting a comment. */
export function DeleteConfirmation({
  commentId,
  isBusy,
  onConfirm,
  onCancel,
}: DeleteConfirmationProps) {
  return (
    <div className="add-comment-popover__confirm" role="alert">
      <p>{uiText.commentThread.confirmDelete}</p>
      <div className="add-comment-popover__confirm-actions">
        <button
          className="button button--danger"
          type="button"
          aria-label={`${uiText.commentThread.confirmDeleteAction} ${commentId}`}
          disabled={isBusy}
          onClick={onConfirm}
        >
          {uiText.commentThread.delete}
        </button>
        <button
          className="button button--secondary"
          type="button"
          aria-label={`${uiText.commentThread.cancelDeleteAction} ${commentId}`}
          disabled={isBusy}
          onClick={onCancel}
        >
          {uiText.commentThread.cancel}
        </button>
      </div>
    </div>
  );
}

type CommentEditStatusActionsProps = Readonly<{
  resolved: boolean;
  isBusy: boolean;
  isConfirmingDelete: boolean;
  /** Toggles the resolved state of the comment. */
  onToggleResolved: () => void;
  /** Opens the delete confirmation prompt. */
  onRequestDelete: () => void;
}>;

/** @returns Resolve/reopen and delete controls for the edit dialog. */
export function CommentEditStatusActions({
  resolved,
  isBusy,
  isConfirmingDelete,
  onToggleResolved,
  onRequestDelete,
}: CommentEditStatusActionsProps) {
  const statusActionLabel = resolved
    ? uiText.commentThread.reopen
    : uiText.commentThread.resolve;

  return (
    <div className="add-comment-popover__status-actions">
      <button
        className="button button--secondary"
        type="button"
        disabled={isBusy}
        onClick={onToggleResolved}
      >
        {resolved ? (
          <RotateCcw aria-hidden="true" size={15} />
        ) : (
          <CheckCircle2 aria-hidden="true" size={15} />
        )}
        {statusActionLabel}
      </button>
      <button
        className="button button--danger"
        type="button"
        disabled={isBusy || isConfirmingDelete}
        onClick={onRequestDelete}
      >
        <Trash2 aria-hidden="true" size={15} />
        {uiText.commentThread.delete}
      </button>
    </div>
  );
}
