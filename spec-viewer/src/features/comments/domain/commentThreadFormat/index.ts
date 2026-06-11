import type {
  Comment,
  CommentAnchorDisplayStatus,
} from "@/features/comments/types/comment";
import { uiText } from "@/shared/lib/uiText";

export const CommentThreadFormat = {
  /**
   * @param comment - Comment owning the Markdown anchor
   * @returns A compact title for the selected Markdown anchor.
   */
  anchorTitle(comment: Comment): string {
    return `${CommentThreadFormat.blockTypeLabel(comment.anchor.blockType)} block ${
      comment.anchor.blockIndex + 1
    }`;
  },
  /**
   * @param blockType - Persisted Markdown block type
   * @returns A readable label for persisted Markdown block types.
   */
  blockTypeLabel(blockType: string): string {
    return blockType
      .split("_")
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");
  },
  /**
   * @param status - Anchor reconciliation status
   * @returns The visible anchor reconciliation status, or null for exact anchors.
   */
  anchorDisplayStatusLabel(status: CommentAnchorDisplayStatus): string | null {
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
  },
  /**
   * @param timestamp - Persisted ISO timestamp
   * @returns A readable local timestamp, falling back to the raw ISO value.
   */
  timestampLabel(timestamp: string): string {
    const date = new Date(timestamp);

    if (Number.isNaN(date.valueOf())) {
      return timestamp;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  },
} as const;
