import { MessageSquarePlus } from "lucide-react";
import type { ComponentPropsWithoutRef, MouseEvent, ReactElement } from "react";

import type { CommentId } from "@/features/comments/types/comment";
import type { CommentBlockAnnotation } from "@/features/specs/domain/commentBlockHighlight";
import type { BlockMetadata } from "@/features/specs/domain/markdownBlock";

import { CommentAnnotationStack } from "./CommentAnnotationStack";
import type { CreateBlockCommentDraft, RequestCommentEdit } from "./types";

type MarkdownCommentableBlockProps = Readonly<{
  children: ReactElement;
  commentAnnotations: readonly CommentBlockAnnotation[];
  /** @param block - Rendered Markdown block targeted by the new draft */
  onCreateBlockDraft: CreateBlockCommentDraft;
  /** @param commentId - Comment selected from the annotation card */
  onSelectComment?: (commentId: CommentId) => void;
  /** @param input - Comment edit request with the anchoring bounds */
  onRequestCommentEdit?: RequestCommentEdit;
}>;

/** @returns A rendered Markdown block with a gutter comment affordance. */
export function MarkdownCommentableBlock({
  children,
  commentAnnotations,
  onCreateBlockDraft,
  onSelectComment,
  onRequestCommentEdit,
}: MarkdownCommentableBlockProps) {
  const createDraftFromRenderedBlock = (
    event: MouseEvent<HTMLButtonElement>,
  ): void => {
    const block = event.currentTarget.parentElement?.querySelector<HTMLElement>(
      "[data-block-type][data-block-index]",
    );

    if (block === undefined || block === null) {
      return;
    }

    onCreateBlockDraft(block);
  };

  return (
    <div
      className="markdown-comment-target"
      data-has-comment-annotations={
        commentAnnotations.length > 0 ? "true" : undefined
      }
    >
      {children}
      <button
        className="markdown-block-comment-button"
        type="button"
        aria-label="コメント追加"
        title="コメント追加"
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={createDraftFromRenderedBlock}
      >
        <MessageSquarePlus aria-hidden="true" size={14} />
        <span>コメント追加</span>
      </button>
      <CommentAnnotationStack
        annotations={commentAnnotations}
        onSelectComment={onSelectComment}
        onRequestCommentEdit={onRequestCommentEdit}
      />
    </div>
  );
}

type ListItemProps = Omit<ComponentPropsWithoutRef<"li">, keyof BlockMetadata> &
  Readonly<{
    checked?: boolean | null;
    node?: unknown;
    commentAnnotations: readonly CommentBlockAnnotation[];
    /** @param block - Rendered Markdown block targeted by the new draft */
    onCreateBlockDraft: CreateBlockCommentDraft;
    /** @param commentId - Comment selected from the annotation card */
    onSelectComment?: (commentId: CommentId) => void;
    /** @param input - Comment edit request with the anchoring bounds */
    onRequestCommentEdit?: RequestCommentEdit;
  }> &
  BlockMetadata;

/** @returns A rendered Markdown list item without parser-only props. */
export function MarkdownListItem({
  checked: _checked,
  node: _node,
  commentAnnotations,
  onCreateBlockDraft,
  onSelectComment,
  onRequestCommentEdit,
  children,
  ...props
}: ListItemProps) {
  const createDraftFromListItem = (
    event: MouseEvent<HTMLButtonElement>,
  ): void => {
    const block = event.currentTarget.closest<HTMLElement>(
      "[data-block-type][data-block-index]",
    );

    if (block === null) {
      return;
    }

    onCreateBlockDraft(block);
  };

  return (
    <li {...props}>
      {children}
      <button
        className="markdown-block-comment-button markdown-block-comment-button--inline"
        type="button"
        aria-label="コメント追加"
        title="コメント追加"
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={createDraftFromListItem}
      >
        <MessageSquarePlus aria-hidden="true" size={14} />
      </button>
      <CommentAnnotationStack
        annotations={commentAnnotations}
        onSelectComment={onSelectComment}
        onRequestCommentEdit={onRequestCommentEdit}
      />
    </li>
  );
}
