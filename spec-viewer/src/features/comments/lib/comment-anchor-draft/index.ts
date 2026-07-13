export {
  createTextHash,
  createTextSnippet,
} from "@/features/comments/application/commentAnchorDraftFactory";

import { CommentAnchorDraftFactory } from "@/features/comments/application/commentAnchorDraftFactory";
import {
  type DecodedCommentAnchorDraftInput,
  decodeCommentAnchorBlock,
  decodeCommentAnchorSelection,
} from "@/features/comments/infra/dom/commentAnchorDraftAdapter";
import type { CommentAnchorDraft } from "@/features/comments/types/comment";
import type { SpecFileKey } from "@/shared/domain/specFileKey";

type CreateCommentAnchorDraftOptions = Readonly<{
  selection: Selection | null;
  renderedRoot: HTMLElement | null;
  fileKey: SpecFileKey;
}>;

type CreateCommentAnchorDraftFromBlockOptions = Readonly<{
  block: HTMLElement | null;
  fileKey: SpecFileKey;
}>;

/**
 * @param options - Browser selection, Markdown root, and selected file.
 * @returns A comment anchor draft for a single rendered Markdown block.
 */
export function createCommentAnchorDraftFromSelection({
  selection,
  renderedRoot,
  fileKey,
}: CreateCommentAnchorDraftOptions): CommentAnchorDraft | null {
  return createDraft(
    fileKey,
    decodeCommentAnchorSelection({ selection, renderedRoot }),
  );
}

/**
 * @param options - Rendered Markdown block and selected file.
 * @returns A comment anchor draft spanning the entire rendered block.
 */
export function createCommentAnchorDraftFromBlock({
  block,
  fileKey,
}: CreateCommentAnchorDraftFromBlockOptions): CommentAnchorDraft | null {
  return createDraft(fileKey, decodeCommentAnchorBlock(block));
}

/**
 * @param fileKey - Logical planning file key.
 * @param decoded - DOM-decoded block, offsets, and viewport bounds.
 * @returns A validated anchor combined with its presentation bounds.
 */
function createDraft(
  fileKey: SpecFileKey,
  decoded: DecodedCommentAnchorDraftInput | null,
): CommentAnchorDraft | null {
  if (decoded === null) {
    return null;
  }

  const draft = CommentAnchorDraftFactory.create({
    fileKey,
    block: decoded.block,
    selectionOffsets: decoded.selectionOffsets,
  });

  if (!draft.ok) {
    return null;
  }

  return {
    anchor: draft.value.anchor,
    selectionBounds: decoded.selectionBounds,
  };
}
