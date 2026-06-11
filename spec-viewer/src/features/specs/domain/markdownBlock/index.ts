import type { AriaRole, KeyboardEventHandler, MouseEventHandler } from "react";

import { CommentAnchorDraft } from "@/features/comments/domain/commentAnchorDraft";
import type { CommentBlockType } from "@/features/comments/types/comment";
import type {
  CommentHighlightMode,
  CommentHighlightState,
} from "@/features/specs/domain/commentBlockHighlight";
import type {
  MarkdownBlockMetadata,
  MarkdownBlockType,
} from "@/features/specs/types/spec";

export type BlockType =
  | "heading"
  | "paragraph"
  | "list-item"
  | "table"
  | "code";

export type BlockMetadata = Readonly<{
  "data-block-type": BlockType;
  "data-block-index": number;
  "data-comment-block-type"?: CommentBlockType;
  "data-text-hash"?: string;
  "data-text-snippet"?: string;
  "data-source-start-byte-offset"?: number;
  "data-source-end-byte-offset"?: number;
  "data-comment-highlight"?: "true";
  "data-comment-highlight-count"?: number;
  "data-comment-highlight-mode"?: CommentHighlightMode;
  "data-comment-highlight-state"?: CommentHighlightState;
  "data-comment-ids"?: string;
  "aria-label"?: string;
  role?: AriaRole;
  tabIndex?: number;
  onClick?: MouseEventHandler<Element>;
  onKeyDown?: KeyboardEventHandler<Element>;
}>;

export type BackendBlockMatch = Readonly<{
  block: MarkdownBlockMetadata;
  index: number;
}>;

const commentBlockTypeMap: Partial<Record<CommentBlockType, BlockType>> = {
  heading: "heading",
  paragraph: "paragraph",
  list_item: "list-item",
  table: "table",
  code_block: "code",
};

const markdownBlockTypeMap: Partial<Record<MarkdownBlockType, BlockType>> = {
  heading: "heading",
  paragraph: "paragraph",
  list_item: "list-item",
  table: "table",
  code_block: "code",
};

export const MarkdownBlock = {
  /**
   * @param blockType - Rendered block type
   * @param blockIndex - Rendered block index
   * @returns A stable key for one rendered Markdown block.
   */
  createKey(blockType: BlockType, blockIndex: number): string {
    return `${blockType}:${blockIndex}`;
  },
  /**
   * @param blockType - Persisted comment anchor block type
   * @returns The rendered Markdown block type corresponding to a persisted anchor.
   */
  fromCommentBlockType(blockType: CommentBlockType): BlockType | null {
    return commentBlockTypeMap[blockType] ?? null;
  },
  /**
   * @param blockType - Backend Markdown block type
   * @returns The rendered block type corresponding to backend Markdown metadata.
   */
  fromMarkdownBlockType(blockType: MarkdownBlockType): BlockType | null {
    return markdownBlockTypeMap[blockType] ?? null;
  },
  /**
   * @param input - Backend blocks, rendered block type, and search start index
   * @returns The next backend block and index that can describe this rendered block.
   */
  findNextBackendBlock({
    blocks,
    blockType,
    startIndex,
  }: Readonly<{
    blocks: readonly MarkdownBlockMetadata[];
    blockType: BlockType;
    startIndex: number;
  }>): BackendBlockMatch | null {
    for (let index = startIndex; index < blocks.length; index += 1) {
      const block = blocks[index];

      if (MarkdownBlock.fromMarkdownBlockType(block.blockType) === blockType) {
        return { block, index };
      }
    }

    return null;
  },
  /**
   * @param metadata - Base rendered block attributes
   * @param block - Matching backend block metadata, when available
   * @returns Rendered block attributes enriched with backend anchor metadata.
   */
  attachBackendMetadata(
    metadata: BlockMetadata,
    block: MarkdownBlockMetadata | null,
  ): BlockMetadata {
    if (block === null) {
      return metadata;
    }

    const sourceRange = block.sourceRange;
    const backendMetadata: BlockMetadata = {
      ...metadata,
      "data-block-index": block.blockIndex,
      "data-comment-block-type": block.blockType,
      "data-text-hash": block.textHash,
      "data-text-snippet": block.textSnippet,
    };

    if (sourceRange === null) {
      return backendMetadata;
    }

    return {
      ...backendMetadata,
      "data-source-start-byte-offset": sourceRange.startByteOffset,
      "data-source-end-byte-offset": sourceRange.endByteOffset,
    };
  },
  /**
   * @param block - Rendered Markdown block element
   * @returns The backend text hash for a rendered block, or a legacy fallback hash.
   */
  readRenderedTextHash(block: HTMLElement): string {
    const textHash = block.dataset.textHash;

    if (textHash !== undefined && textHash.trim().length > 0) {
      return textHash;
    }

    return CommentAnchorDraft.textHash(block.textContent ?? "");
  },
} as const;
