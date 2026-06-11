import type { CSSProperties } from "react";

import type {
  CommentAnchorDraft,
  CommentSelectionBounds,
} from "@/features/comments/types/comment";

export type FloatingKind = "button" | "popover";

const FLOATING_VIEWPORT_MARGIN = 8;
const COMMENT_POPOVER_ESTIMATED_HEIGHT = 360;
const COMMENT_POPOVER_ESTIMATED_WIDTH = 382;
const SELECTION_BUTTON_TOP_OFFSET = 44;
const POPOVER_ANCHOR_GAP = 10;

/**
 * @param bounds - Viewport bounds of the anchoring selection
 * @returns Viewport-clamped top offset for the comment dialog.
 */
function createPopoverTop(bounds: CommentSelectionBounds): number {
  const preferredBelow = bounds.top + bounds.height + POPOVER_ANCHOR_GAP;
  const availableBelow =
    window.innerHeight - preferredBelow - FLOATING_VIEWPORT_MARGIN;

  if (availableBelow >= COMMENT_POPOVER_ESTIMATED_HEIGHT) {
    return Math.max(FLOATING_VIEWPORT_MARGIN, preferredBelow);
  }

  const preferredAbove =
    bounds.top - COMMENT_POPOVER_ESTIMATED_HEIGHT - POPOVER_ANCHOR_GAP;

  return Math.max(FLOATING_VIEWPORT_MARGIN, preferredAbove);
}

/**
 * @param bounds - Viewport bounds of the anchoring selection
 * @returns Viewport-clamped left offset for the comment dialog.
 */
function createPopoverLeft(bounds: CommentSelectionBounds): number {
  const maxLeft =
    window.innerWidth -
    COMMENT_POPOVER_ESTIMATED_WIDTH -
    FLOATING_VIEWPORT_MARGIN;

  return Math.max(
    FLOATING_VIEWPORT_MARGIN,
    Math.min(bounds.left, Math.max(FLOATING_VIEWPORT_MARGIN, maxLeft)),
  );
}

export const CommentPopoverPosition = {
  /**
   * @param draft - Comment anchor draft with the selection bounds
   * @param kind - Floating UI flavor to position
   * @returns Fixed-position style for selection-adjacent UI.
   */
  createFloatingStyle(
    draft: CommentAnchorDraft,
    kind: FloatingKind,
  ): CSSProperties {
    const bounds = draft.selectionBounds;

    if (kind === "button") {
      const usesCommentLane = bounds.commentLaneLeft !== undefined;

      return {
        top: Math.max(
          FLOATING_VIEWPORT_MARGIN,
          bounds.top - SELECTION_BUTTON_TOP_OFFSET,
        ),
        left: Math.max(
          FLOATING_VIEWPORT_MARGIN,
          bounds.commentLaneLeft ?? bounds.left + bounds.width / 2,
        ),
        transform: usesCommentLane ? "none" : undefined,
      };
    }

    if (bounds.commentLaneLeft !== undefined) {
      return CommentPopoverPosition.createPopoverStyle({
        ...bounds,
        left: bounds.commentLaneLeft,
        width: 0,
      });
    }

    return CommentPopoverPosition.createPopoverStyle(bounds);
  },
  /**
   * @param bounds - Viewport bounds of the anchoring selection
   * @returns Fixed-position style for a floating comment dialog.
   */
  createPopoverStyle(bounds: CommentSelectionBounds): CSSProperties {
    return {
      top: createPopoverTop(bounds),
      left: createPopoverLeft(bounds),
    };
  },
  /**
   * @param element - Clicked control that anchors the dialog
   * @returns Viewport bounds for anchoring an edit dialog to a clicked control.
   */
  boundsFromElement(element: HTMLElement): CommentSelectionBounds {
    const rect = element.getBoundingClientRect();

    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  },
} as const;
