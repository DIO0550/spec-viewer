import type { CommentAnchorDraft as CommentAnchorDraftModel } from "@/features/comments/types/comment";
import type { SpecFileKey } from "@/features/specs/types/spec";

import { createTextHash, createTextSnippet } from "./anchorText";
import { readBlockMetadata } from "./blockMetadata";
import {
  createBlockSelectionBounds,
  createSelectionBounds,
} from "./selectionBounds";
import {
  createBlockText,
  createCharRange,
  createRangeText,
  findSelectionBlock,
  isRangeInsideRoot,
} from "./selectionText";

export type CreateCommentAnchorDraftFromSelectionInput = Readonly<{
  selection: Selection | null;
  renderedRoot: HTMLElement | null;
  fileKey: SpecFileKey;
}>;

export type CreateCommentAnchorDraftFromBlockInput = Readonly<{
  block: HTMLElement | null;
  fileKey: SpecFileKey;
}>;

export const CommentAnchorDraft = {
  /**
   * @param input - Current DOM selection, rendered Markdown root, and file key
   * @returns A comment anchor draft for a single Markdown block selection.
   */
  fromSelection({
    selection,
    renderedRoot,
    fileKey,
  }: CreateCommentAnchorDraftFromSelectionInput): CommentAnchorDraftModel | null {
    if (
      selection === null ||
      renderedRoot === null ||
      selection.rangeCount === 0
    ) {
      return null;
    }

    const range = selection.getRangeAt(0);

    if (range.collapsed || !isRangeInsideRoot(range, renderedRoot)) {
      return null;
    }

    const startBlock = findSelectionBlock(range.startContainer, renderedRoot);
    const endBlock = findSelectionBlock(range.endContainer, renderedRoot);

    if (startBlock === null || endBlock === null || startBlock !== endBlock) {
      return null;
    }

    const blockMetadata = readBlockMetadata(startBlock);

    if (blockMetadata === null) {
      return null;
    }

    const textSnippet = createTextSnippet(createRangeText(range, startBlock));

    if (textSnippet === null) {
      return null;
    }

    const charRange = createCharRange(range, startBlock);
    const blockText = createBlockText(startBlock);

    return {
      anchor: {
        fileKey,
        blockType: blockMetadata.blockType,
        blockIndex: blockMetadata.blockIndex,
        textHash: blockMetadata.textHash ?? createTextHash(blockText),
        textSnippet,
        charRange,
      },
      selectionBounds: createSelectionBounds(range, startBlock),
    };
  },
  /**
   * @param input - Rendered Markdown block and file key
   * @returns A comment anchor draft for an entire rendered Markdown block.
   */
  fromBlock({
    block,
    fileKey,
  }: CreateCommentAnchorDraftFromBlockInput): CommentAnchorDraftModel | null {
    if (block === null) {
      return null;
    }

    const blockMetadata = readBlockMetadata(block);

    if (blockMetadata === null) {
      return null;
    }

    const blockText = createBlockText(block);
    const textSnippet = createTextSnippet(blockText);

    if (textSnippet === null) {
      return null;
    }

    return {
      anchor: {
        fileKey,
        blockType: blockMetadata.blockType,
        blockIndex: blockMetadata.blockIndex,
        textHash: blockMetadata.textHash ?? createTextHash(blockText),
        textSnippet,
        charRange: {
          start: 0,
          end: blockText.length,
        },
      },
      selectionBounds: createBlockSelectionBounds(block),
    };
  },
  /**
   * @param text - Rendered block text
   * @returns A stable non-cryptographic hash for the rendered block text.
   */
  textHash(text: string): string {
    return createTextHash(text);
  },
  /**
   * @param text - Raw selected text
   * @returns A compact selected text snippet, or null when no text is selected.
   */
  textSnippet(text: string): string | null {
    return createTextSnippet(text);
  },
} as const;
