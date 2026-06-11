import type {
  Comment,
  CommentAnchor,
  CommentAnchorDisplayState,
  CommentAnchorDisplayStatus,
  CommentId,
} from "@/features/comments/types/comment";
import { MarkdownBlock } from "@/features/specs/domain/markdownBlock";

/**
 * @param input - Comment with backend resolution metadata and the rendered root
 * @returns The backend-resolved display status when command metadata is present.
 */
function createResolvedStatus({
  comment,
  renderedRoot,
}: Readonly<{
  comment: Comment;
  renderedRoot: HTMLElement;
}>): CommentAnchorDisplayStatus | null {
  const resolution = comment.anchorResolution;

  if (resolution === undefined || resolution === null) {
    return null;
  }

  if (resolution.status === "orphaned") {
    return "orphaned";
  }

  const targetBlock = CommentAnchorDisplay.findResolutionTargetBlock({
    comment,
    renderedRoot,
  });

  if (targetBlock === null) {
    return "stale";
  }

  if (resolution.status === "resolved") {
    return "exact";
  }

  return resolution.status;
}

export const CommentAnchorDisplay = {
  /**
   * @param input - Comments and the rendered Markdown root element
   * @returns Comment anchor states based on the currently rendered Markdown DOM.
   */
  createStates({
    comments,
    renderedRoot,
  }: Readonly<{
    comments: readonly Comment[];
    renderedRoot: HTMLElement | null;
  }>): readonly CommentAnchorDisplayState[] {
    if (renderedRoot === null) {
      return [];
    }

    return comments.map((comment) => {
      const resolvedStatus = createResolvedStatus({ comment, renderedRoot });

      if (resolvedStatus !== null) {
        return {
          commentId: comment.id,
          status: resolvedStatus,
        };
      }

      const block = CommentAnchorDisplay.findAnchorBlock({
        anchor: comment.anchor,
        renderedRoot,
      });

      if (block === null) {
        return {
          commentId: comment.id,
          status: "orphaned",
        };
      }

      const blockTextHash = MarkdownBlock.readRenderedTextHash(block);
      const status: CommentAnchorDisplayStatus =
        blockTextHash === comment.anchor.textHash ? "exact" : "stale";

      return {
        commentId: comment.id,
        status,
      };
    });
  },
  /**
   * @param states - Anchor display states for the rendered document
   * @returns A lookup of display status by comment id.
   */
  createStateByCommentId(
    states: readonly CommentAnchorDisplayState[],
  ): ReadonlyMap<CommentId, CommentAnchorDisplayStatus> {
    return new Map(
      states.map((state) => [state.commentId, state.status] as const),
    );
  },
  /**
   * @param input - Persisted anchor and the rendered Markdown root element
   * @returns The rendered Markdown block for a persisted comment anchor.
   */
  findAnchorBlock({
    anchor,
    renderedRoot,
  }: Readonly<{
    anchor: CommentAnchor;
    renderedRoot: HTMLElement;
  }>): HTMLElement | null {
    const blockType = MarkdownBlock.fromCommentBlockType(anchor.blockType);

    if (blockType === null) {
      return null;
    }

    return renderedRoot.querySelector<HTMLElement>(
      `[data-block-type="${blockType}"][data-block-index="${anchor.blockIndex}"]`,
    );
  },
  /**
   * @param input - Comment with optional resolution target and the rendered root
   * @returns The rendered Markdown block for a backend-resolved target.
   */
  findResolutionTargetBlock({
    comment,
    renderedRoot,
  }: Readonly<{
    comment: Comment;
    renderedRoot: HTMLElement;
  }>): HTMLElement | null {
    const target = comment.anchorResolution?.target;

    if (target === undefined || target === null) {
      return CommentAnchorDisplay.findAnchorBlock({
        anchor: comment.anchor,
        renderedRoot,
      });
    }

    const blockType = MarkdownBlock.fromCommentBlockType(target.blockType);

    if (blockType === null) {
      return null;
    }

    return renderedRoot.querySelector<HTMLElement>(
      `[data-block-type="${blockType}"][data-block-index="${target.blockIndex}"]`,
    );
  },
  /**
   * @param input - Comment to focus and the rendered Markdown root element
   * @returns The best block to scroll for a selected comment.
   */
  findBlockForScroll({
    comment,
    renderedRoot,
  }: Readonly<{
    comment: Comment;
    renderedRoot: HTMLElement;
  }>): HTMLElement | null {
    if (comment.anchorResolution?.status === "orphaned") {
      return null;
    }

    return CommentAnchorDisplay.findResolutionTargetBlock({
      comment,
      renderedRoot,
    });
  },
} as const;
