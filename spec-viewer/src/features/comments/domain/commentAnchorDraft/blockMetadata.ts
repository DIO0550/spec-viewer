import type { CommentBlockType } from "@/features/comments/types/comment";

type MarkdownBlockType =
  | "heading"
  | "paragraph"
  | "list-item"
  | "table"
  | "code"
  | "blockquote";

export type BlockMetadata = Readonly<{
  blockType: CommentBlockType;
  blockIndex: number;
  textHash: string | null;
}>;

/**
 * @param block - Rendered Markdown block element.
 * @returns Validated block metadata from a rendered Markdown block.
 */
export function readBlockMetadata(block: HTMLElement): BlockMetadata | null {
  const blockType = readCommentBlockType(block);
  const blockIndex = Number.parseInt(block.dataset.blockIndex ?? "", 10);

  if (
    blockType === null ||
    !Number.isSafeInteger(blockIndex) ||
    blockIndex < 0
  ) {
    return null;
  }

  return {
    blockType,
    blockIndex,
    textHash: readBackendTextHash(block),
  };
}

/**
 * @param block - Rendered Markdown block element.
 * @returns The persisted comment block type represented by a rendered block.
 */
function readCommentBlockType(block: HTMLElement): CommentBlockType | null {
  if (isCommentBlockType(block.dataset.commentBlockType)) {
    return block.dataset.commentBlockType;
  }

  return mapMarkdownBlockType(block.dataset.blockType);
}

/**
 * @param block - Rendered Markdown block element.
 * @returns The backend text hash attached to the rendered block, when available.
 */
function readBackendTextHash(block: HTMLElement): string | null {
  const textHash = block.dataset.textHash;

  if (textHash === undefined || textHash.trim().length === 0) {
    return null;
  }

  return textHash;
}

/**
 * @param blockType - Raw rendered block type attribute.
 * @returns The persisted comment block type for a rendered Markdown block type.
 */
function mapMarkdownBlockType(
  blockType: string | undefined,
): CommentBlockType | null {
  if (blockType === undefined) {
    return null;
  }

  const blockTypeMap: Record<MarkdownBlockType, CommentBlockType> = {
    heading: "heading",
    paragraph: "paragraph",
    "list-item": "list_item",
    table: "table",
    code: "code_block",
    blockquote: "block_quote",
  };

  if (!isMarkdownBlockType(blockType)) {
    return null;
  }

  return blockTypeMap[blockType];
}

/**
 * @param blockType - Raw rendered block type attribute.
 * @returns true when the raw data attribute is a supported Markdown block type.
 */
function isMarkdownBlockType(
  blockType: string,
): blockType is MarkdownBlockType {
  return (
    blockType === "heading" ||
    blockType === "paragraph" ||
    blockType === "list-item" ||
    blockType === "table" ||
    blockType === "code" ||
    blockType === "blockquote"
  );
}

/**
 * @param blockType - Raw rendered block type attribute.
 * @returns true when the raw data attribute is a persisted comment block type.
 */
function isCommentBlockType(
  blockType: string | undefined,
): blockType is CommentBlockType {
  return (
    blockType === "paragraph" ||
    blockType === "heading" ||
    blockType === "list_item" ||
    blockType === "code_block" ||
    blockType === "block_quote" ||
    blockType === "table" ||
    blockType === "thematic_break" ||
    blockType === "html" ||
    blockType === "other"
  );
}
