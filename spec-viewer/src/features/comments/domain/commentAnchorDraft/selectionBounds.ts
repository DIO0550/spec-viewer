import type { CommentSelectionBounds } from "@/features/comments/types/comment";

const COMMENT_TARGET_SELECTOR = ".markdown-comment-target";
const COMMENT_LANE_WIDTH = 88;

/**
 * @param range - Current DOM selection range.
 * @param block - Rendered Markdown block element.
 * @returns Viewport bounds for placing the comment affordance.
 */
export function createSelectionBounds(
  range: Range,
  block: HTMLElement,
): CommentSelectionBounds {
  const rect = range.getBoundingClientRect();

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    commentLaneLeft: createCommentLaneLeft(block),
  };
}

/**
 * @param block - Rendered Markdown block element.
 * @returns Viewport bounds for placing a block comment popover.
 */
export function createBlockSelectionBounds(
  block: HTMLElement,
): CommentSelectionBounds {
  const rect = block.getBoundingClientRect();

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    commentLaneLeft: createCommentLaneLeft(block),
  };
}

/**
 * @param block - Rendered Markdown block element.
 * @returns The viewport x-coordinate for the left edge of the comment lane.
 */
function createCommentLaneLeft(block: HTMLElement): number | undefined {
  const target = block.closest<HTMLElement>(COMMENT_TARGET_SELECTOR) ?? block;

  const rect = target.getBoundingClientRect();

  if (rect.width <= 0) {
    return undefined;
  }

  return rect.right - COMMENT_LANE_WIDTH;
}
