import { CheckCircle2, ChevronDown, MessageSquare, Pencil } from "lucide-react";
import { type MouseEvent, useId, useState } from "react";

import { CommentPopoverPosition } from "@/features/comments/lib/commentPopoverPosition";
import type {
  Comment,
  CommentAnchorDisplayStatus,
  CommentId,
} from "@/features/comments/types/comment";
import type { CommentBlockAnnotation } from "@/features/specs/domain/commentBlockHighlight";
import { uiText } from "@/shared/lib/uiText";

import type { RequestCommentEdit } from "./types";

const COMMENT_PREVIEW_MAX_LENGTH = 84;

/**
 * @param comment - Annotated comment
 * @param anchorDisplayStatus - Current anchor display status
 * @returns The status label shown inside a block-level annotation card.
 */
function formatCommentAnnotationStatus(
  comment: Comment,
  anchorDisplayStatus: CommentAnchorDisplayStatus,
): string {
  if (anchorDisplayStatus === "moved") {
    return uiText.sidebar.moved;
  }

  if (anchorDisplayStatus === "fuzzy") {
    return uiText.sidebar.fuzzy;
  }

  if (anchorDisplayStatus === "stale") {
    return uiText.sidebar.stale;
  }

  if (anchorDisplayStatus === "orphaned") {
    return uiText.sidebar.orphaned;
  }

  return comment.resolved ? uiText.sidebar.resolved : uiText.sidebar.openFilter;
}

/**
 * @param body - Raw comment body
 * @returns A compact single-line preview for a comment body.
 */
function createCommentPreview(body: string): string {
  const normalizedBody = body.replace(/\s+/g, " ").trim();

  if (normalizedBody.length === 0) {
    return uiText.commentThread.emptyBody;
  }

  if (normalizedBody.length <= COMMENT_PREVIEW_MAX_LENGTH) {
    return normalizedBody;
  }

  return `${normalizedBody.slice(0, COMMENT_PREVIEW_MAX_LENGTH - 1)}...`;
}

type CommentAnnotationCardProps = Readonly<{
  annotation: CommentBlockAnnotation;
  /** @param commentId - Comment selected from the annotation card */
  onSelectComment?: (commentId: CommentId) => void;
  /** @param input - Comment edit request with the anchoring bounds */
  onRequestCommentEdit?: RequestCommentEdit;
}>;

/** @returns A compact selectable preview for one existing comment. */
function CommentAnnotationCard({
  annotation,
  onSelectComment,
  onRequestCommentEdit,
}: CommentAnnotationCardProps) {
  const { comment, anchorDisplayStatus, isActive } = annotation;
  const [isExpanded, setIsExpanded] = useState(false);
  const previewId = useId();
  const statusLabel = formatCommentAnnotationStatus(
    comment,
    anchorDisplayStatus,
  );
  const preview = createCommentPreview(comment.body);
  const toggleExpanded = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    setIsExpanded((current) => !current);
  };
  const selectComment = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();

    if (onRequestCommentEdit !== undefined) {
      onRequestCommentEdit({
        comment,
        selectionBounds: CommentPopoverPosition.boundsFromElement(
          event.currentTarget,
        ),
      });
      return;
    }

    onSelectComment?.(comment.id);
  };

  return (
    <article
      className="markdown-comment-annotation"
      data-active={isActive ? "true" : "false"}
      data-anchor-display-status={anchorDisplayStatus}
      data-expanded={isExpanded ? "true" : "false"}
      data-resolved={comment.resolved ? "true" : "false"}
      aria-current={isActive ? "true" : undefined}
    >
      <div className="markdown-comment-annotation__header">
        <button
          className="markdown-comment-annotation__toggle"
          type="button"
          aria-controls={previewId}
          aria-expanded={isExpanded}
          aria-label={
            isExpanded
              ? `コメントを閉じる ${statusLabel}`
              : `コメントを開く ${statusLabel}`
          }
          title={isExpanded ? "コメントを閉じる" : "コメントを開く"}
          onClick={toggleExpanded}
        >
          {isExpanded ? (
            <ChevronDown aria-hidden="true" size={14} />
          ) : comment.resolved ? (
            <CheckCircle2 aria-hidden="true" size={14} />
          ) : (
            <MessageSquare aria-hidden="true" size={14} />
          )}
        </button>
        <span className="markdown-comment-annotation__status">
          {comment.resolved ? (
            <CheckCircle2 aria-hidden="true" size={13} />
          ) : (
            <MessageSquare aria-hidden="true" size={13} />
          )}
          {statusLabel}
        </span>
        {isExpanded ? (
          <button
            className="markdown-comment-annotation__select"
            type="button"
            aria-label={`コメント編集を開く ${preview}`}
            title="コメント編集を開く"
            onClick={selectComment}
          >
            <Pencil aria-hidden="true" size={13} />
          </button>
        ) : null}
      </div>
      {isExpanded ? (
        <p className="markdown-comment-annotation__preview" id={previewId}>
          {preview}
        </p>
      ) : null}
    </article>
  );
}

type CommentAnnotationStackProps = Readonly<{
  annotations: readonly CommentBlockAnnotation[];
  /** @param commentId - Comment selected from the annotation card */
  onSelectComment?: (commentId: CommentId) => void;
  /** @param input - Comment edit request with the anchoring bounds */
  onRequestCommentEdit?: RequestCommentEdit;
}>;

/** @returns Right-side existing comment cards for one rendered Markdown block. */
export function CommentAnnotationStack({
  annotations,
  onSelectComment,
  onRequestCommentEdit,
}: CommentAnnotationStackProps) {
  if (annotations.length === 0) {
    return null;
  }

  return (
    <aside className="markdown-comment-annotations" aria-label="既存コメント">
      {annotations.map((annotation) => (
        <CommentAnnotationCard
          key={annotation.comment.id}
          annotation={annotation}
          onSelectComment={onSelectComment}
          onRequestCommentEdit={onRequestCommentEdit}
        />
      ))}
    </aside>
  );
}
