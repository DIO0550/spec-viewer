import type {
  CommentAnchorDraft,
  CommentBlockType,
  CommentSelectionBounds,
} from "@/features/comments/types/comment";
import type { SpecFileKey } from "@/features/specs/types/spec";

type MarkdownBlockType =
  | "heading"
  | "paragraph"
  | "list-item"
  | "table"
  | "code"
  | "blockquote";

type CreateCommentAnchorDraftOptions = Readonly<{
  selection: Selection | null;
  renderedRoot: HTMLElement | null;
  fileKey: SpecFileKey;
}>;

type CreateCommentAnchorDraftFromBlockOptions = Readonly<{
  block: HTMLElement | null;
  fileKey: SpecFileKey;
}>;

const BLOCK_SELECTOR = "[data-block-type][data-block-index]";
const BACKEND_BLOCK_SELECTOR =
  "[data-block-type][data-block-index][data-comment-block-type][data-text-hash]";
const COMMENT_TARGET_SELECTOR = ".markdown-comment-target";
const COMMENT_UI_SELECTOR =
  ".markdown-block-comment-button, .markdown-comment-annotations";
const COMMENT_LANE_WIDTH = 88;
const MAX_SNIPPET_LENGTH = 160;
const FNV_32_OFFSET = 0x811c9dc5;
const FNV_32_PRIME = 0x01000193;

/** @returns A comment anchor draft for a single Markdown block selection. */
export function createCommentAnchorDraftFromSelection({
  selection,
  renderedRoot,
  fileKey,
}: CreateCommentAnchorDraftOptions): CommentAnchorDraft | null {
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
}

/** @returns A comment anchor draft for an entire rendered Markdown block. */
export function createCommentAnchorDraftFromBlock({
  block,
  fileKey,
}: CreateCommentAnchorDraftFromBlockOptions): CommentAnchorDraft | null {
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
}

/** @returns A stable non-cryptographic hash for the rendered block text. */
export function createTextHash(text: string): string {
  let hash = FNV_32_OFFSET;

  for (const character of normalizeWhitespace(text)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, FNV_32_PRIME);
  }

  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/** @returns A compact selected text snippet, or null when no text is selected. */
export function createTextSnippet(text: string): string | null {
  const snippet = normalizeWhitespace(text);

  if (snippet.length === 0) {
    return null;
  }

  return snippet.slice(0, MAX_SNIPPET_LENGTH);
}

/** @returns true when both range endpoints are inside the rendered Markdown root. */
function isRangeInsideRoot(range: Range, renderedRoot: HTMLElement): boolean {
  return (
    containsSelectionNode(renderedRoot, range.startContainer) &&
    containsSelectionNode(renderedRoot, range.endContainer)
  );
}

/** @returns true when the node or its owning element belongs to the root. */
function containsSelectionNode(root: HTMLElement, node: Node): boolean {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return root.contains(node);
  }

  return node.parentElement !== null && root.contains(node.parentElement);
}

/** @returns The nearest commentable Markdown block for a selected node. */
function findSelectionBlock(
  node: Node,
  renderedRoot: HTMLElement,
): HTMLElement | null {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;

  if (element === null) {
    return null;
  }

  if (element.closest(COMMENT_UI_SELECTOR) !== null) {
    return null;
  }

  const backendBlock = element.closest<HTMLElement>(BACKEND_BLOCK_SELECTOR);

  if (backendBlock !== null && renderedRoot.contains(backendBlock)) {
    return backendBlock;
  }

  const block = element.closest<HTMLElement>(BLOCK_SELECTOR);

  if (block === null || !renderedRoot.contains(block)) {
    return null;
  }

  return block;
}

type BlockMetadata = Readonly<{
  blockType: CommentBlockType;
  blockIndex: number;
  textHash: string | null;
}>;

/** @returns Validated block metadata from a rendered Markdown block. */
function readBlockMetadata(block: HTMLElement): BlockMetadata | null {
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

/** @returns The persisted comment block type represented by a rendered block. */
function readCommentBlockType(block: HTMLElement): CommentBlockType | null {
  if (isCommentBlockType(block.dataset.commentBlockType)) {
    return block.dataset.commentBlockType;
  }

  return mapMarkdownBlockType(block.dataset.blockType);
}

/** @returns The backend text hash attached to the rendered block, when available. */
function readBackendTextHash(block: HTMLElement): string | null {
  const textHash = block.dataset.textHash;

  if (textHash === undefined || textHash.trim().length === 0) {
    return null;
  }

  return textHash;
}

/** @returns The persisted comment block type for a rendered Markdown block type. */
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

/** @returns true when the raw data attribute is a supported Markdown block type. */
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

/** @returns true when the raw data attribute is a persisted comment block type. */
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

/** @returns The selected character range within the rendered block text. */
function createCharRange(
  range: Range,
  block: HTMLElement,
): {
  start: number;
  end: number;
} {
  const start = getTextOffsetWithinBlock(
    block,
    range.startContainer,
    range.startOffset,
  );
  const end = getTextOffsetWithinBlock(
    block,
    range.endContainer,
    range.endOffset,
  );

  return {
    start,
    end,
  };
}

/** @returns A text offset for a DOM range endpoint inside the block. */
function getTextOffsetWithinBlock(
  block: HTMLElement,
  targetNode: Node,
  targetOffset: number,
): number {
  const prefixRange = document.createRange();
  prefixRange.selectNodeContents(block);
  prefixRange.setEnd(targetNode, targetOffset);

  return createRangeText(prefixRange, block).length;
}

/** @returns Markdown block text without comment controls or annotation UI. */
function createBlockText(block: HTMLElement): string {
  return getAnchorTextNodes(block)
    .map((textNode) => textNode.data)
    .join("");
}

/** @returns Selected text inside one Markdown block without comment UI text. */
function createRangeText(range: Range, block: HTMLElement): string {
  return getAnchorTextNodes(block)
    .filter((textNode) => range.intersectsNode(textNode))
    .map((textNode) => createSelectedTextFromNode(range, textNode))
    .join("");
}

/** @returns Text nodes that belong to the Markdown content itself. */
function getAnchorTextNodes(block: HTMLElement): Text[] {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();

  while (currentNode !== null) {
    if (currentNode instanceof Text && !isCommentUiNode(currentNode)) {
      textNodes.push(currentNode);
    }

    currentNode = walker.nextNode();
  }

  return textNodes;
}

/** @returns True when the node belongs to comment controls instead of Markdown text. */
function isCommentUiNode(node: Node): boolean {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;

  return element?.closest(COMMENT_UI_SELECTOR) !== null;
}

/** @returns The selected slice of one text node. */
function createSelectedTextFromNode(range: Range, textNode: Text): string {
  const startOffset =
    textNode === range.startContainer
      ? clampTextOffset(range.startOffset, textNode.length)
      : 0;
  const endOffset =
    textNode === range.endContainer
      ? clampTextOffset(range.endOffset, textNode.length)
      : textNode.length;

  if (endOffset <= startOffset) {
    return "";
  }

  return textNode.data.slice(startOffset, endOffset);
}

/** @returns A DOM text offset constrained to the node length. */
function clampTextOffset(offset: number, textLength: number): number {
  return Math.min(Math.max(offset, 0), textLength);
}

/** @returns Viewport bounds for placing the comment affordance. */
function createSelectionBounds(
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

/** @returns Viewport bounds for placing a block comment popover. */
function createBlockSelectionBounds(
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

/** @returns The viewport x-coordinate for the left edge of the comment lane. */
function createCommentLaneLeft(block: HTMLElement): number | undefined {
  const target = block.closest<HTMLElement>(COMMENT_TARGET_SELECTOR) ?? block;

  const rect = target.getBoundingClientRect();

  if (rect.width <= 0) {
    return undefined;
  }

  return rect.right - COMMENT_LANE_WIDTH;
}

/** @returns Text trimmed and collapsed to single spaces for anchor display. */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
