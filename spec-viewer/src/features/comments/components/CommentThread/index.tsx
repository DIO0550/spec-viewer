import type { KeyboardEvent, ReactElement } from "react";

import { ReviewComment } from "@/features/comments/components/ReviewComment";
import type { Comment } from "@/features/comments/domain/comment";
import {
  type CommentId,
  CommentId as CommentIdValue,
} from "@/features/comments/domain/commentId";
import {
  CommentOperationSavingState,
  type CommentOperationState,
} from "@/features/comments/domain/commentOperation";
import type { CommentAnchorDisplayStatus } from "@/features/comments/types/comment";
import { uiText } from "@/utils/uiText";

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

/** Spec-domain adapter for the shared Review comment presentation. */
export function CommentThread(props: Props): ReactElement {
  const { comment } = props;
  const isOperating = CommentOperationSavingState.isForComment(
    props.operationState,
    comment.id,
  );

  return (
    <ReviewComment
      comment={{
        id: comment.id,
        body: comment.body,
        status: comment.status,
        title: formatAnchorTitle(comment),
        snippet: comment.anchor.textSnippet,
        resolutionLabel: "",
        canJump: false,
      }}
      isSelected={props.isActive}
      isMutating={isOperating}
      searchQuery={props.searchQuery}
      selectionLabel={`${uiText.commentThread.select} ${comment.id}`}
      articleClassName="comment-thread"
      selectClassName="comment-thread__select"
      showJump={false}
      labels={{
        edit: uiText.commentThread.edit,
        resolve: uiText.commentThread.resolve,
        reopen: uiText.commentThread.reopen,
        save: uiText.commentThread.save,
        cancel: uiText.commentThread.cancel,
        delete: uiText.commentThread.delete,
        confirmDelete: uiText.commentThread.confirmDelete,
        confirmDeleteAction: uiText.commentThread.confirmDeleteAction,
      }}
      anchorDetails={
        <SpecAnchorDetails
          comment={comment}
          status={props.anchorDisplayStatus}
        />
      }
      footer={<SpecCommentFooter comment={comment} />}
      onSelectionKeyDown={(event) =>
        moveCommentSelection(event, props.onSelectComment)
      }
      onSelect={(commentId) =>
        props.onSelectComment(CommentIdValue.fromString(commentId))
      }
      onUpdate={(commentId, body) =>
        props.onUpdateComment(CommentIdValue.fromString(commentId), body)
      }
      onResolve={(commentId) =>
        props.onResolveComment(CommentIdValue.fromString(commentId))
      }
      onReopen={(commentId) =>
        props.onReopenComment(CommentIdValue.fromString(commentId))
      }
      onJump={() => undefined}
      onDelete={(commentId) =>
        props.onDeleteComment(CommentIdValue.fromString(commentId))
      }
    />
  );
}

function SpecAnchorDetails(
  props: Readonly<{
    comment: Comment;
    status: CommentAnchorDisplayStatus;
  }>,
): ReactElement {
  const { comment } = props;
  const statusLabel = formatAnchorDisplayStatus(props.status);
  return (
    <section
      className="comment-thread__anchor"
      aria-label={uiText.commentThread.anchorDetails}
    >
      <span className="comment-thread__anchor-snippet">
        {comment.anchor.textSnippet}
      </span>
      <span className="comment-thread__anchor-file">
        {comment.anchor.fileKey}
      </span>
      <span className="comment-thread__anchor-location">
        {formatBlockType(comment.anchor.blockType)} {uiText.commentThread.block}{" "}
        {comment.anchor.blockIndex + 1}, {uiText.commentThread.chars}{" "}
        {comment.anchor.charRange.start}-{comment.anchor.charRange.end}
      </span>
      {statusLabel === null ? null : (
        <span
          className={`comment-thread__anchor-state comment-thread__anchor-state--${props.status}`}
        >
          {statusLabel}
        </span>
      )}
    </section>
  );
}

function SpecCommentFooter(
  props: Readonly<{ comment: Comment }>,
): ReactElement {
  return (
    <footer className="comment-thread__footer">
      <time dateTime={props.comment.createdAt}>
        {uiText.commentThread.created}{" "}
        {formatCommentTimestamp(props.comment.createdAt)}
      </time>
      <time dateTime={props.comment.updatedAt}>
        {uiText.commentThread.updated}{" "}
        {formatCommentTimestamp(props.comment.updatedAt)}
      </time>
    </footer>
  );
}

function moveCommentSelection(
  event: KeyboardEvent<HTMLButtonElement>,
  onSelectComment: (commentId: CommentId) => void,
): void {
  const buttons = Array.from(
    event.currentTarget
      .closest(".comment-sidebar")
      ?.querySelectorAll<HTMLButtonElement>(".comment-thread__select") ?? [],
  );
  const currentIndex = buttons.indexOf(event.currentTarget);
  if (currentIndex < 0) {
    return;
  }
  const nextButton =
    event.key === "ArrowDown"
      ? buttons[Math.min(currentIndex + 1, buttons.length - 1)]
      : event.key === "ArrowUp"
        ? buttons[Math.max(currentIndex - 1, 0)]
        : event.key === "Home"
          ? buttons[0]
          : event.key === "End"
            ? buttons[buttons.length - 1]
            : undefined;
  const nextCommentId = nextButton?.dataset.commentId;
  if (nextButton === undefined || nextCommentId === undefined) {
    return;
  }
  event.preventDefault();
  nextButton.focus();
  onSelectComment(CommentIdValue.fromString(nextCommentId));
}

function formatAnchorTitle(comment: Comment): string {
  return `${formatBlockType(comment.anchor.blockType)} block ${
    comment.anchor.blockIndex + 1
  }`;
}

function formatBlockType(blockType: string): string {
  return blockType
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatAnchorDisplayStatus(
  status: CommentAnchorDisplayStatus,
): string | null {
  if (status === "exact") {
    return null;
  }
  return {
    moved: uiText.commentThread.anchorMoved,
    fuzzy: uiText.commentThread.fuzzyAnchor,
    orphaned: uiText.commentThread.anchorOrphaned,
    stale: uiText.commentThread.anchorStale,
  }[status];
}

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
