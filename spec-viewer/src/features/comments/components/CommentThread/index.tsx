import {
  Check,
  CheckCircle2,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useId,
  useState,
} from "react";

import {
  CommentOperationSavingState,
  type CommentOperationState,
} from "@/features/comments/domain/commentOperation";
import type {
  Comment,
  CommentAnchorDisplayStatus,
  CommentId,
} from "@/features/comments/types/comment";
import { CommentId as CommentIdValue } from "@/features/comments/types/comment";
import { uiText } from "@/shared/lib/uiText";

const emptyBodyMessage = uiText.commentThread.emptyBody;

type Props = Readonly<{
  comment: Comment;
  isActive: boolean;
  anchorDisplayStatus: CommentAnchorDisplayStatus;
  searchQuery?: string;
  operationState: CommentOperationState;
  /** @param commentId - The comment to make active. */
  onSelectComment: (commentId: CommentId) => void;
  /**
   * @param commentId - The comment to update.
   * @param body - The new comment body text.
   */
  onUpdateComment: (commentId: CommentId, body: string) => void;
  /** @param commentId - The comment to mark resolved. */
  onResolveComment: (commentId: CommentId) => void;
  /** @param commentId - The comment to reopen. */
  onReopenComment: (commentId: CommentId) => void;
  /** @param commentId - The comment to delete. */
  onDeleteComment: (commentId: CommentId) => void;
}>;

/** @returns A single comment thread card with detail, edit, status, and delete actions. */
export function CommentThread({
  comment,
  isActive,
  anchorDisplayStatus,
  searchQuery = "",
  operationState,
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
  const isOperatingComment = CommentOperationSavingState.isForComment(
    operationState,
    comment.id,
  );
  const isResolved = comment.resolved;
  const anchorStatusLabel = formatAnchorDisplayStatus(anchorDisplayStatus);

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

  const moveCommentSelection = (
    event: KeyboardEvent<HTMLButtonElement>,
  ): void => {
    const nextButton = findNextCommentSelectButton(event);

    if (nextButton === null) {
      return;
    }

    const nextCommentId = nextButton.dataset.commentId;

    if (nextCommentId === undefined) {
      return;
    }

    event.preventDefault();
    nextButton.focus();
    onSelectComment(CommentIdValue.fromString(nextCommentId));
  };

  return (
    <article
      className="comment-thread"
      data-active={isActive ? "true" : "false"}
      data-anchor-display-status={anchorDisplayStatus}
      aria-labelledby={titleId}
    >
      <header className="comment-thread__header">
        <button
          className="comment-thread__select"
          type="button"
          data-comment-id={comment.id}
          aria-current={isActive ? "true" : undefined}
          aria-label={`${uiText.commentThread.select} ${comment.id}`}
          aria-keyshortcuts="ArrowUp ArrowDown Home End Alt+ArrowUp Alt+ArrowDown"
          onClick={() => {
            onSelectComment(comment.id);
          }}
          onKeyDown={moveCommentSelection}
        >
          <span
            className={
              isResolved
                ? "comment-thread__status comment-thread__status--resolved"
                : "comment-thread__status"
            }
          >
            <HighlightedText
              text={
                isResolved ? uiText.sidebar.resolved : uiText.sidebar.openFilter
              }
              searchQuery={searchQuery}
            />
          </span>
          <span id={titleId} className="comment-thread__title">
            {formatAnchorTitle(comment)}
          </span>
        </button>
        <section
          className="comment-thread__actions"
          aria-label={uiText.commentThread.actions}
        >
          <button
            className="icon-button"
            type="button"
            aria-label={`${uiText.commentThread.edit} ${comment.id}`}
            disabled={isOperatingComment || isEditing}
            onClick={beginEdit}
          >
            <Pencil aria-hidden="true" size={14} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label={`${
              isResolved
                ? uiText.commentThread.reopen
                : uiText.commentThread.resolve
            } ${comment.id}`}
            disabled={isOperatingComment}
            onClick={toggleResolved}
          >
            {isResolved ? (
              <RotateCcw aria-hidden="true" size={14} />
            ) : (
              <CheckCircle2 aria-hidden="true" size={14} />
            )}
          </button>
          <button
            className="icon-button icon-button--danger"
            type="button"
            aria-label={`${uiText.commentThread.delete} ${comment.id}`}
            disabled={isOperatingComment || isConfirmingDelete}
            onClick={requestDelete}
          >
            <Trash2 aria-hidden="true" size={14} />
          </button>
        </section>
      </header>

      <section
        className="comment-thread__anchor"
        aria-label={uiText.commentThread.anchorDetails}
      >
        <span className="comment-thread__anchor-snippet">
          <HighlightedText
            text={comment.anchor.textSnippet}
            searchQuery={searchQuery}
          />
        </span>
        <span className="comment-thread__anchor-file">
          <HighlightedText
            text={comment.anchor.fileKey}
            searchQuery={searchQuery}
          />
        </span>
        <span className="comment-thread__anchor-location">
          {formatBlockType(comment.anchor.blockType)}
          {uiText.commentThread.block} {comment.anchor.blockIndex + 1},{" "}
          {uiText.commentThread.chars} {comment.anchor.charRange.start}-
          {comment.anchor.charRange.end}
        </span>
        {anchorStatusLabel === null ? null : (
          <span
            className={`comment-thread__anchor-state comment-thread__anchor-state--${anchorDisplayStatus}`}
          >
            <HighlightedText
              text={anchorStatusLabel}
              searchQuery={searchQuery}
            />
          </span>
        )}
      </section>

      {isEditing ? (
        <form className="comment-thread__editor" onSubmit={submitEdit}>
          <label className="comment-thread__editor-label" htmlFor={bodyId}>
            {uiText.commentThread.body}
          </label>
          <textarea
            id={bodyId}
            aria-label={`${uiText.commentThread.bodyLabel} ${comment.id}`}
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
              aria-label={`${uiText.commentThread.save} ${comment.id}`}
              disabled={isOperatingComment}
            >
              <Check aria-hidden="true" size={14} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={`${uiText.commentThread.cancel} ${comment.id}`}
              disabled={isOperatingComment}
              onClick={cancelEdit}
            >
              <X aria-hidden="true" size={14} />
            </button>
          </div>
        </form>
      ) : (
        <p className="comment-thread__body">
          <HighlightedText text={comment.body} searchQuery={searchQuery} />
        </p>
      )}

      {isConfirmingDelete ? (
        <div className="comment-thread__confirm" role="alert">
          <p>{uiText.commentThread.confirmDelete}</p>
          <div className="comment-thread__confirm-actions">
            <button
              className="button button--danger"
              type="button"
              aria-label={`${uiText.commentThread.confirmDeleteAction} ${comment.id}`}
              disabled={isOperatingComment}
              onClick={confirmDelete}
            >
              {uiText.commentThread.delete}
            </button>
            <button
              className="button button--secondary"
              type="button"
              aria-label={`${uiText.commentThread.cancelDeleteAction} ${comment.id}`}
              disabled={isOperatingComment}
              onClick={() => {
                setIsConfirmingDelete(false);
              }}
            >
              {uiText.commentThread.cancel}
            </button>
          </div>
        </div>
      ) : null}

      <footer className="comment-thread__footer">
        <time dateTime={comment.createdAt}>
          {uiText.commentThread.created}{" "}
          {formatCommentTimestamp(comment.createdAt)}
        </time>
        <time dateTime={comment.updatedAt}>
          {uiText.commentThread.updated}{" "}
          {formatCommentTimestamp(comment.updatedAt)}
        </time>
      </footer>
    </article>
  );
}

/** @returns The adjacent comment select button for list keyboard navigation. */
function findNextCommentSelectButton(
  event: KeyboardEvent<HTMLButtonElement>,
): HTMLButtonElement | null {
  const buttons = Array.from(
    event.currentTarget
      .closest(".comment-sidebar")
      ?.querySelectorAll<HTMLButtonElement>(".comment-thread__select") ?? [],
  );
  const currentIndex = buttons.indexOf(event.currentTarget);

  if (currentIndex < 0) {
    return null;
  }

  if (event.key === "ArrowDown") {
    return buttons[Math.min(currentIndex + 1, buttons.length - 1)] ?? null;
  }

  if (event.key === "ArrowUp") {
    return buttons[Math.max(currentIndex - 1, 0)] ?? null;
  }

  if (event.key === "Home") {
    return buttons[0] ?? null;
  }

  if (event.key === "End") {
    return buttons[buttons.length - 1] ?? null;
  }

  return null;
}

type HighlightedTextProps = Readonly<{
  text: string;
  searchQuery: string;
}>;

/**
 * @param props - The highlighted text props.
 * @param props.text - The full text to render.
 * @param props.searchQuery - The normalized query to highlight within the text.
 * @returns Text with every search query occurrence marked for visual scanning.
 */
function HighlightedText({ text, searchQuery }: HighlightedTextProps) {
  if (searchQuery.length === 0) {
    return text;
  }

  const lowerText = text.toLocaleLowerCase();
  const segments: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = lowerText.indexOf(searchQuery);

  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      segments.push(text.slice(cursor, matchIndex));
    }

    const matchEnd = matchIndex + searchQuery.length;

    segments.push(
      <mark className="comment-thread__search-match" key={matchIndex}>
        {text.slice(matchIndex, matchEnd)}
      </mark>,
    );

    cursor = matchEnd;
    matchIndex = lowerText.indexOf(searchQuery, cursor);
  }

  if (cursor < text.length) {
    segments.push(text.slice(cursor));
  }

  return <>{segments}</>;
}

/**
 * @param comment - The comment whose anchor to title.
 * @returns A compact title for the selected Markdown anchor.
 */
function formatAnchorTitle(comment: Comment): string {
  return `${formatBlockType(comment.anchor.blockType)} block ${
    comment.anchor.blockIndex + 1
  }`;
}

/**
 * @param blockType - The raw persisted Markdown block type token.
 * @returns A readable label for persisted Markdown block types.
 */
function formatBlockType(blockType: string): string {
  return blockType
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

/** @returns The visible anchor reconciliation status, or null for exact anchors. */
function formatAnchorDisplayStatus(
  status: CommentAnchorDisplayStatus,
): string | null {
  if (status === "exact") {
    return null;
  }

  const statusLabels: Record<
    Exclude<CommentAnchorDisplayStatus, "exact">,
    string
  > = {
    moved: uiText.commentThread.anchorMoved,
    fuzzy: uiText.commentThread.fuzzyAnchor,
    orphaned: uiText.commentThread.anchorOrphaned,
    stale: uiText.commentThread.anchorStale,
  };

  return statusLabels[status];
}

/**
 * @param timestamp - The ISO timestamp to format.
 * @returns A readable local timestamp, falling back to the raw ISO value.
 */
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
