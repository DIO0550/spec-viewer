import { CheckCircle2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";

import {
  CommentOperationSavingState,
  type CommentOperationState,
} from "@/features/comments/domain/commentOperation";
import { CommentThreadFormat } from "@/features/comments/domain/commentThreadFormat";
import type {
  Comment,
  CommentAnchorDisplayStatus,
  CommentId,
} from "@/features/comments/types/comment";
import { CommentId as CommentIdValue } from "@/features/comments/types/comment";
import { uiText } from "@/shared/lib/uiText";

import { CommentThreadDeleteConfirm } from "./CommentThreadDeleteConfirm";
import { CommentThreadEditor } from "./CommentThreadEditor";
import { findNextCommentSelectButton } from "./commentSelectKeyNav";
import { HighlightedText } from "./HighlightedText";

type Props = Readonly<{
  comment: Comment;
  isActive: boolean;
  anchorDisplayStatus: CommentAnchorDisplayStatus;
  searchQuery?: string;
  operationState: CommentOperationState;
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
  const titleId = useId();
  const isOperatingComment = CommentOperationSavingState.isForComment(
    operationState,
    comment.id,
  );
  const isResolved = comment.resolved;
  const anchorStatusLabel =
    CommentThreadFormat.anchorDisplayStatusLabel(anchorDisplayStatus);

  const beginEdit = (): void => {
    setIsConfirmingDelete(false);
    setIsEditing(true);
  };

  const submitEdit = (body: string): void => {
    onUpdateComment(comment.id, body);
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
    setIsConfirmingDelete(true);
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
            {CommentThreadFormat.anchorTitle(comment)}
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
          {CommentThreadFormat.blockTypeLabel(comment.anchor.blockType)}
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
        <CommentThreadEditor
          comment={comment}
          isOperatingComment={isOperatingComment}
          onSubmit={submitEdit}
          onCancel={() => {
            setIsEditing(false);
          }}
        />
      ) : (
        <p className="comment-thread__body">
          <HighlightedText text={comment.body} searchQuery={searchQuery} />
        </p>
      )}

      {isConfirmingDelete ? (
        <CommentThreadDeleteConfirm
          comment={comment}
          isOperatingComment={isOperatingComment}
          onConfirm={() => {
            onDeleteComment(comment.id);
          }}
          onCancel={() => {
            setIsConfirmingDelete(false);
          }}
        />
      ) : null}

      <footer className="comment-thread__footer">
        <time dateTime={comment.createdAt}>
          {uiText.commentThread.created}{" "}
          {CommentThreadFormat.timestampLabel(comment.createdAt)}
        </time>
        <time dateTime={comment.updatedAt}>
          {uiText.commentThread.updated}{" "}
          {CommentThreadFormat.timestampLabel(comment.updatedAt)}
        </time>
      </footer>
    </article>
  );
}
