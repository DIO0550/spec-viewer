import { MessageSquarePlus } from "lucide-react";

import { CommentPopoverPosition } from "@/features/comments/lib/commentPopoverPosition";
import type { CommentAnchorDraft } from "@/features/comments/types/comment";

type Props = Readonly<{
  draft: CommentAnchorDraft | null;
  /** @param draft - Selection-based anchor draft to open in the comment form */
  onCreateDraft: (draft: CommentAnchorDraft) => void;
}>;

/**
 * @param props - Current selection draft and the draft creation callback
 * @returns A floating command for turning the current text selection into a draft.
 */
export function TextSelectionCommentButton({ draft, onCreateDraft }: Props) {
  if (draft === null) {
    return null;
  }

  const style = CommentPopoverPosition.createFloatingStyle(draft, "button");

  return (
    <button
      className="text-selection-comment-button"
      type="button"
      style={style}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={() => {
        onCreateDraft(draft);
      }}
    >
      <MessageSquarePlus aria-hidden="true" size={16} />
      <span>コメント追加</span>
    </button>
  );
}
