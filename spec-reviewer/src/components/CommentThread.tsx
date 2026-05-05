import { CheckCircle2, Edit3, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import type { CommentMutationState } from "../hooks/useComments";
import type { Comment, CommentId } from "../types/comment";

const emptyBodyMessage = "Comment body cannot be empty.";

type Props = Readonly<{
  comment: Comment;
  isActive: boolean;
  mutationState: CommentMutationState;
  onSelectComment: (commentId: CommentId) => void;
  onUpdateComment: (commentId: CommentId, body: string) => void;
  onResolveComment: (commentId: CommentId) => void;
  onReopenComment: (commentId: CommentId) => void;
  onDeleteComment: (commentId: CommentId) => void;
}>;

/** @returns A single comment thread card with detail, edit, status, and delete actions. */
export function CommentThread({
  comment,
  isActive,
  mutationState,
  onSelectComment,
  onUpdateComment,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [draftBody, setDraftBody] = useState(comment.body);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const titleId = useId();
  const bodyId = useId();
  const validationId = useId();
  const isMutatingComment =
    mutationState.status === "saving" && mutationState.commentId === comment.id;
  const isResolved = comment.resolved;

  const beginEdit = (): void => {
    setIsConfirmingDelete(false);
    setValidationMessage(null);
    setDraftBody(comment.body);
    setIsEditing(true);
  };

  const cancelEdit = (): void => {
    setValidationMessage(null);
    setDraftBody(comment.body);
    setIsEditing(false);
  };

  const submitEdit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const nextBody = draftBody.trim();

    if (nextBody.length === 0) {
      setValidationMessage(emptyBodyMessage);
      return;
    }

    onUpdateComment(comment.id, nextBody);
    setValidationMessage(null);
    setIsEditing(false);
  };

  const toggleResolved = (): void => {
    if (isResolved) {
      onReopenComment(comment.id);
      return;
    }

    onResolveComment(comment.id);
  };

  const requestDelete = (): void => {
    setIsEditing(false);
    setValidationMessage(null);
    setIsConfirmingDelete(true);
  };

  const confirmDelete = (): void => {
    onDeleteComment(comment.id);
  };

  return (
    <article
      className="comment-thread"
      data-active={isActive ? "true" : "false"}
      aria-labelledby={titleId}
    >
      <header className="comment-thread__header">
        <button
          className="comment-thread__select"
          type="button"
          aria-current={isActive ? "true" : undefined}
          aria-label={`Select comment ${comment.id}`}
          onClick={() => {
            onSelectComment(comment.id);
          }}
        >
          <span
            className={
              isResolved
                ? "comment-thread__status comment-thread__status--resolved"
                : "comment-thread__status"
            }
          >
            {isResolved ? "Resolved" : "Open"}
          </span>
          <span id={titleId} className="comment-thread__title">
            {formatAnchorTitle(comment)}
          </span>
        </button>
        <div className="comment-thread__actions" aria-label="Comment actions">
          <button
            className="icon-button"
            type="button"
            aria-label={`Edit comment ${comment.id}`}
            disabled={isMutatingComment || isEditing}
            onClick={beginEdit}
          >
            <Edit3 aria-hidden="true" size={16} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label={`${isResolved ? "Reopen" : "Resolve"} comment ${
              comment.id
            }`}
            disabled={isMutatingComment}
            onClick={toggleResolved}
          >
            {isResolved ? (
              <RotateCcw aria-hidden="true" size={16} />
            ) : (
              <CheckCircle2 aria-hidden="true" size={16} />
            )}
          </button>
          <button
            className="icon-button icon-button--danger"
            type="button"
            aria-label={`Delete comment ${comment.id}`}
            disabled={isMutatingComment || isConfirmingDelete}
            onClick={requestDelete}
          >
            <Trash2 aria-hidden="true" size={16} />
          </button>
        </div>
      </header>

      <div className="comment-thread__anchor" aria-label="Anchor details">
        <span>{comment.anchor.textSnippet}</span>
        <span>
          {formatBlockType(comment.anchor.blockType)} block{" "}
          {comment.anchor.blockIndex + 1}, chars{" "}
          {comment.anchor.charRange.start}-{comment.anchor.charRange.end}
        </span>
      </div>

      {isEditing ? (
        <form className="comment-thread__editor" onSubmit={submitEdit}>
          <label className="comment-thread__editor-label" htmlFor={bodyId}>
            Body
          </label>
          <textarea
            id={bodyId}
            aria-label={`Comment body for ${comment.id}`}
            aria-describedby={
              validationMessage === null ? undefined : validationId
            }
            value={draftBody}
            rows={4}
            onInput={(event) => {
              setDraftBody(event.currentTarget.value);
            }}
          />
          {validationMessage === null ? null : (
            <p
              id={validationId}
              className="comment-thread__validation"
              role="alert"
            >
              {validationMessage}
            </p>
          )}
          <div className="comment-thread__editor-actions">
            <button
              className="icon-button"
              type="submit"
              aria-label={`Save comment ${comment.id}`}
              disabled={isMutatingComment}
            >
              <Save aria-hidden="true" size={16} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={`Cancel editing comment ${comment.id}`}
              disabled={isMutatingComment}
              onClick={cancelEdit}
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
        </form>
      ) : (
        <p className="comment-thread__body">{comment.body}</p>
      )}

      {isConfirmingDelete ? (
        <div className="comment-thread__confirm" role="alert">
          <p>Delete this comment permanently?</p>
          <div className="comment-thread__confirm-actions">
            <button
              className="button button--danger"
              type="button"
              aria-label={`Confirm delete comment ${comment.id}`}
              disabled={isMutatingComment}
              onClick={confirmDelete}
            >
              Delete
            </button>
            <button
              className="button button--secondary"
              type="button"
              aria-label={`Cancel delete comment ${comment.id}`}
              disabled={isMutatingComment}
              onClick={() => {
                setIsConfirmingDelete(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <footer className="comment-thread__footer">
        <time dateTime={comment.createdAt}>
          Created {formatCommentTimestamp(comment.createdAt)}
        </time>
        <time dateTime={comment.updatedAt}>
          Updated {formatCommentTimestamp(comment.updatedAt)}
        </time>
      </footer>
    </article>
  );
}

/** @returns A compact title for the selected Markdown anchor. */
function formatAnchorTitle(comment: Comment): string {
  return `${formatBlockType(comment.anchor.blockType)} block ${
    comment.anchor.blockIndex + 1
  }`;
}

/** @returns A readable label for persisted Markdown block types. */
function formatBlockType(blockType: string): string {
  return blockType
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

/** @returns A readable local timestamp, falling back to the raw ISO value. */
function formatCommentTimestamp(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.valueOf())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
