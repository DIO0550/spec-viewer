import { AddCommentPopover } from "@/features/comments/components/AddCommentPopover";
import { CommentPopoverPosition } from "@/features/comments/lib/commentPopoverPosition";
import type {
  AddCommentSubmitInput,
  CommentAnchorDraft,
} from "@/features/comments/types/comment";

/**
 * @param draft - Pending comment anchor draft
 * @returns Stable identity for remounting the add-comment form when target changes.
 */
function createCommentAnchorDraftKey(draft: CommentAnchorDraft): string {
  const { anchor } = draft;

  return [
    anchor.fileKey,
    anchor.blockType,
    anchor.blockIndex,
    anchor.textHash,
    anchor.charRange.start,
    anchor.charRange.end,
  ].join(":");
}

type Props = Readonly<{
  draft: CommentAnchorDraft | null;
  isSaving: boolean;
  errorMessage: string | null;
  isScopeReady: boolean;
  /**
   * @param input - Comment body and anchor submitted from the form
   * @returns Whether the comment was persisted.
   */
  onSubmit: (input: AddCommentSubmitInput) => Promise<boolean>;
  /** Closes the add-comment form without saving. */
  onCancel: () => void;
}>;

/** @returns The pending comment anchor form, or null when no draft exists. */
export function CommentAnchorDraftPopover({
  draft,
  isSaving,
  errorMessage,
  isScopeReady,
  onSubmit,
  onCancel,
}: Props) {
  if (draft === null) {
    return null;
  }

  const style = CommentPopoverPosition.createFloatingStyle(draft, "popover");
  const draftKey = createCommentAnchorDraftKey(draft);

  return (
    <AddCommentPopover
      key={draftKey}
      draft={draft}
      style={style}
      isSaving={isSaving}
      errorMessage={errorMessage}
      isScopeReady={isScopeReady}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}
