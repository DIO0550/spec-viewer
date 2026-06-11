import type {
  Comment,
  CommentAnchorDisplayStatus,
  CommentId,
} from "@/features/comments/types/comment";
import {
  type BlockMetadata,
  MarkdownBlock,
} from "@/features/specs/domain/markdownBlock";

export type CommentHighlightState =
  | "open"
  | "resolved"
  | "active"
  | "stale"
  | "moved"
  | "fuzzy";

export type CommentHighlightMode = "block" | "range";

export type CommentRangeHighlight = Readonly<{
  commentIds: readonly CommentId[];
  selectCommentId: CommentId;
  state: CommentHighlightState;
  start: number;
  end: number;
}>;

export type CommentBlockAnnotation = Readonly<{
  comment: Comment;
  anchorDisplayStatus: CommentAnchorDisplayStatus;
  isActive: boolean;
}>;

export type CommentBlockHighlight = Readonly<{
  commentIds: readonly CommentId[];
  selectCommentId: CommentId;
  state: CommentHighlightState;
  rangeHighlights: readonly CommentRangeHighlight[];
  annotations: readonly CommentBlockAnnotation[];
}>;

export type CommentBlockHighlights = ReadonlyMap<string, CommentBlockHighlight>;

type HighlightSourceInput = Readonly<{
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  anchorDisplayStateByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >;
}>;

/** @returns Highlight metadata for all comments attached to one block. */
function createCommentBlockHighlight(
  input: HighlightSourceInput,
): CommentBlockHighlight {
  const { comments, activeCommentId } = input;

  return {
    commentIds: comments.map((comment) => comment.id),
    selectCommentId: selectCommentIdForHighlight(comments, activeCommentId),
    state: selectCommentHighlightState(input),
    rangeHighlights: createCommentRangeHighlights(input),
    annotations: createCommentBlockAnnotations(input),
  };
}

/** @returns Right-side annotation card models for comments attached to one block. */
function createCommentBlockAnnotations({
  comments,
  activeCommentId,
  anchorDisplayStateByCommentId,
}: HighlightSourceInput): readonly CommentBlockAnnotation[] {
  return comments.map((comment) => ({
    comment,
    anchorDisplayStatus:
      anchorDisplayStateByCommentId.get(comment.id) ?? "exact",
    isActive: comment.id === activeCommentId,
  }));
}

/**
 * @param comment - Comment whose anchor or resolution decides the block
 * @returns The rendered block key that should receive a comment highlight.
 */
function createCommentHighlightBlockKey(comment: Comment): string | null {
  const target = comment.anchorResolution?.target;

  if (comment.anchorResolution?.status === "orphaned") {
    return null;
  }

  if (target !== undefined && target !== null) {
    const blockType = MarkdownBlock.fromCommentBlockType(target.blockType);

    if (blockType === null) {
      return null;
    }

    return MarkdownBlock.createKey(blockType, target.blockIndex);
  }

  const blockType = MarkdownBlock.fromCommentBlockType(
    comment.anchor.blockType,
  );

  if (blockType === null) {
    return null;
  }

  return MarkdownBlock.createKey(blockType, comment.anchor.blockIndex);
}

/** @returns The comment id to select when a highlighted block is activated. */
function selectCommentIdForHighlight(
  comments: readonly Comment[],
  activeCommentId: CommentId | null,
): CommentId {
  const activeComment = comments.find(
    (comment) => comment.id === activeCommentId,
  );

  if (activeComment !== undefined) {
    return activeComment.id;
  }

  const openComment = comments.find((comment) => !comment.resolved);

  return openComment?.id ?? comments[0].id;
}

/** @returns The visual highlight state with active and stale states taking precedence. */
function selectCommentHighlightState({
  comments,
  activeCommentId,
  anchorDisplayStateByCommentId,
}: HighlightSourceInput): CommentHighlightState {
  const hasActiveComment = comments.some(
    (comment) => comment.id === activeCommentId,
  );

  if (hasActiveComment) {
    return "active";
  }

  const hasStaleComment = comments.some(
    (comment) => anchorDisplayStateByCommentId.get(comment.id) === "stale",
  );

  if (hasStaleComment) {
    return "stale";
  }

  const hasMovedComment = comments.some(
    (comment) => anchorDisplayStateByCommentId.get(comment.id) === "moved",
  );

  if (hasMovedComment) {
    return "moved";
  }

  const hasFuzzyComment = comments.some(
    (comment) => anchorDisplayStateByCommentId.get(comment.id) === "fuzzy",
  );

  if (hasFuzzyComment) {
    return "fuzzy";
  }

  const hasOpenComment = comments.some((comment) => !comment.resolved);

  return hasOpenComment ? "open" : "resolved";
}

/** @returns Range-level highlights for exact anchors with a usable character range. */
function createCommentRangeHighlights({
  comments,
  activeCommentId,
  anchorDisplayStateByCommentId,
}: HighlightSourceInput): readonly CommentRangeHighlight[] {
  return comments.flatMap((comment) => {
    if (!isReliableRangeHighlight({ comment, anchorDisplayStateByCommentId })) {
      return [];
    }

    return [
      {
        commentIds: [comment.id],
        selectCommentId: comment.id,
        state:
          comment.id === activeCommentId
            ? "active"
            : selectExactRangeState(comment),
        start: comment.anchor.charRange.start,
        end: comment.anchor.charRange.end,
      },
    ];
  });
}

/** @returns true when the original selected text range is safe to emphasize. */
function isReliableRangeHighlight({
  comment,
  anchorDisplayStateByCommentId,
}: Readonly<{
  comment: Comment;
  anchorDisplayStateByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >;
}>): boolean {
  if (anchorDisplayStateByCommentId.get(comment.id) !== "exact") {
    return false;
  }

  if (comment.anchor.blockType === "code_block") {
    return false;
  }

  return comment.anchor.charRange.end > comment.anchor.charRange.start;
}

/**
 * @param comment - Comment with an exactly anchored range
 * @returns The subdued or prominent state for an exact range highlight.
 */
function selectExactRangeState(comment: Comment): CommentHighlightState {
  return comment.resolved ? "resolved" : "open";
}

export const CommentBlockHighlight = {
  /**
   * @param input - Visible comments, active comment, and anchor display lookup
   * @returns Markdown blocks grouped with comments that target each block.
   */
  fromComments(input: HighlightSourceInput): CommentBlockHighlights {
    const { comments, activeCommentId, anchorDisplayStateByCommentId } = input;
    const commentsByBlock = new Map<string, Comment[]>();

    for (const comment of comments) {
      const key = createCommentHighlightBlockKey(comment);

      if (key === null) {
        continue;
      }

      const blockComments = commentsByBlock.get(key) ?? [];

      blockComments.push(comment);
      commentsByBlock.set(key, blockComments);
    }

    return new Map(
      Array.from(commentsByBlock.entries()).map(([key, blockComments]) => [
        key,
        createCommentBlockHighlight({
          comments: blockComments,
          activeCommentId,
          anchorDisplayStateByCommentId,
        }),
      ]),
    );
  },
  /**
   * @param input - Base block metadata and an optional highlight for the block
   * @returns Block metadata with highlight attributes and selection handlers.
   */
  applyToMetadata({
    metadata,
    highlight,
  }: Readonly<{
    metadata: BlockMetadata;
    highlight: CommentBlockHighlight | undefined;
  }>): BlockMetadata {
    if (highlight === undefined) {
      return metadata;
    }

    const highlightedMetadata: BlockMetadata = {
      ...metadata,
      "aria-label": CommentBlockHighlight.createAriaLabel(highlight),
      "data-comment-highlight": "true",
      "data-comment-highlight-count": highlight.commentIds.length,
      "data-comment-highlight-mode":
        highlight.rangeHighlights.length > 0 ? "range" : "block",
      "data-comment-highlight-state": highlight.state,
      "data-comment-ids": highlight.commentIds.join(" "),
    };

    return highlightedMetadata;
  },
  /**
   * @param highlight - Highlight with the attached comment ids
   * @returns An accessible description for a highlighted Markdown block.
   */
  createAriaLabel(
    highlight: Pick<CommentBlockHighlight, "commentIds">,
  ): string {
    const countLabel =
      highlight.commentIds.length === 1
        ? "1件のコメント"
        : `${highlight.commentIds.length}件のコメント`;

    return `${countLabel}があるMarkdownブロック`;
  },
} as const;
