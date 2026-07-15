import {
  BlockIdentity,
  BlockIndex,
  BlockType,
  type CommentAnchorDomainError,
  type CommentAnchorParseResult,
  type RenderedBlockSnapshot,
  type SelectionOffsets,
  TextHash,
  type TextHash as TextHashValue,
} from "@/features/comments/domain/commentAnchor";
import type { CommentSelectionBounds } from "@/features/comments/types/comment";

type DecodeCommentAnchorSelectionOptions = Readonly<{
  selection: Selection | null;
  renderedRoot: HTMLElement | null;
}>;

export type DecodedCommentAnchorDraftInput = Readonly<{
  block: RenderedBlockSnapshot;
  selectionOffsets: SelectionOffsets;
  selectionBounds: CommentSelectionBounds;
}>;

const BLOCK_SELECTOR =
  "[data-block-type][data-block-index][data-comment-block-type][data-text-hash]";
const COMMENT_TARGET_SELECTOR = ".markdown-comment-target";
const COMMENT_UI_SELECTOR =
  ".markdown-block-comment-button, .markdown-comment-annotations";
const COMMENT_LANE_WIDTH = 88;

/**
 * @param options - Browser selection and Markdown root.
 * @returns DOM-free input for creating a comment anchor draft.
 */
export function decodeCommentAnchorSelection({
  selection,
  renderedRoot,
}: DecodeCommentAnchorSelectionOptions): DecodedCommentAnchorDraftInput | null {
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

  const block = decodeRenderedBlockSnapshot(startBlock);

  if (!block.ok) {
    return null;
  }

  return {
    block: block.value,
    selectionOffsets: createSelectionOffsets(range, startBlock),
    selectionBounds: createSelectionBounds(range, startBlock),
  };
}

/**
 * @param block - Rendered Markdown block.
 * @returns DOM-free input spanning the entire rendered block.
 */
export function decodeCommentAnchorBlock(
  block: HTMLElement | null,
): DecodedCommentAnchorDraftInput | null {
  if (block === null) {
    return null;
  }

  const snapshot = decodeRenderedBlockSnapshot(block);

  if (!snapshot.ok) {
    return null;
  }

  return {
    block: snapshot.value,
    selectionOffsets: {
      start: 0,
      end: snapshot.value.text.length,
    },
    selectionBounds: createBlockSelectionBounds(block),
  };
}

/**
 * @param block - Rendered Markdown block element.
 * @returns A DOM-free snapshot or a typed domain validation error.
 */
export function decodeRenderedBlockSnapshot(
  block: HTMLElement,
): CommentAnchorParseResult<RenderedBlockSnapshot> {
  const blockType = decodeBlockType(block);

  if (!blockType.ok) {
    return blockType;
  }

  const blockIndex = decodeBlockIndex(block.dataset.blockIndex);

  if (!blockIndex.ok) {
    return blockIndex;
  }

  const identity = BlockIdentity.parse({
    blockType: blockType.value,
    blockIndex: blockIndex.value,
  });

  if (!identity.ok) {
    return identity;
  }

  const textHash = decodeTextHash(block.dataset.textHash);

  if (!textHash.ok) {
    return textHash;
  }

  return {
    ok: true,
    value: {
      identity: identity.value,
      text: readRenderedBlockAnchorText(block),
      textHash: textHash.value,
    },
  };
}

/**
 * @param block - Rendered Markdown block element.
 * @returns Validated backend block type metadata.
 */
function decodeBlockType(
  block: HTMLElement,
): CommentAnchorParseResult<BlockType> {
  return BlockType.parse(block.dataset.commentBlockType);
}

/**
 * @param value - Raw data-block-index value.
 * @returns A canonical non-negative integer or a typed domain validation error.
 */
function decodeBlockIndex(
  value: string | undefined,
): CommentAnchorParseResult<BlockIndex> {
  if (value === undefined || value.length === 0) {
    return BlockIndex.parse(value);
  }

  const parsedValue = Number(value);

  if (String(parsedValue) !== value) {
    return invalidBlockIndex(value);
  }

  return BlockIndex.parse(parsedValue);
}

/**
 * @param value - Raw data-text-hash value.
 * @returns A validated canonical backend fingerprint.
 */
function decodeTextHash(
  value: string | undefined,
): CommentAnchorParseResult<TextHashValue> {
  return TextHash.parseCanonical(value);
}

/**
 * @param value - Invalid raw block index.
 * @returns A typed invalid-index result.
 */
function invalidBlockIndex<T>(value: unknown): CommentAnchorParseResult<T> {
  const error: CommentAnchorDomainError = {
    reason: "invalid_block_index",
    value,
  };

  return { ok: false, error };
}

/**
 * @param range - Selection range to test.
 * @param renderedRoot - Rendered Markdown root.
 * @returns true when both range endpoints are inside the root.
 */
function isRangeInsideRoot(range: Range, renderedRoot: HTMLElement): boolean {
  return (
    containsSelectionNode(renderedRoot, range.startContainer) &&
    containsSelectionNode(renderedRoot, range.endContainer)
  );
}

/**
 * @param root - Root element to test against.
 * @param node - Selection node.
 * @returns true when the node or its owning element belongs to the root.
 */
function containsSelectionNode(root: HTMLElement, node: Node): boolean {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return root.contains(node);
  }

  return node.parentElement !== null && root.contains(node.parentElement);
}

/**
 * @param node - Selection endpoint node.
 * @param renderedRoot - Rendered Markdown root.
 * @returns Nearest commentable Markdown block or null.
 */
function findSelectionBlock(
  node: Node,
  renderedRoot: HTMLElement,
): HTMLElement | null {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;

  if (element === null || element.closest(COMMENT_UI_SELECTOR) !== null) {
    return null;
  }

  const block = element.closest<HTMLElement>(BLOCK_SELECTOR);

  if (block === null || !renderedRoot.contains(block)) {
    return null;
  }

  return block;
}

/**
 * @param range - DOM selection range.
 * @param block - Selected rendered block.
 * @returns Character offsets relative to commentable block text.
 */
function createSelectionOffsets(
  range: Range,
  block: HTMLElement,
): SelectionOffsets {
  return {
    start: getTextOffsetWithinBlock(
      block,
      range.startContainer,
      range.startOffset,
    ),
    end: getTextOffsetWithinBlock(block, range.endContainer, range.endOffset),
  };
}

/**
 * @param block - Rendered Markdown block.
 * @param targetNode - DOM range endpoint node.
 * @param targetOffset - DOM range endpoint offset.
 * @returns Text offset excluding comment controls and annotations.
 */
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

/**
 * @param block - Rendered Markdown block.
 * @returns Block text excluding comment controls and annotations.
 */
function readRenderedBlockAnchorText(block: HTMLElement): string {
  return getAnchorTextNodes(block)
    .map((textNode) => textNode.data)
    .join("");
}

/**
 * @param range - DOM range to extract.
 * @param block - Rendered Markdown block.
 * @returns Range text excluding comment controls and annotations.
 */
function createRangeText(range: Range, block: HTMLElement): string {
  return getAnchorTextNodes(block)
    .filter((textNode) => range.intersectsNode(textNode))
    .map((textNode) => createSelectedTextFromNode(range, textNode))
    .join("");
}

/**
 * @param block - Rendered Markdown block.
 * @returns Content text nodes excluding comment controls and annotations.
 */
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

/**
 * @param node - Candidate content node.
 * @returns true when the node belongs to comment controls or annotations.
 */
function isCommentUiNode(node: Node): boolean {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;

  return element?.closest(COMMENT_UI_SELECTOR) !== null;
}

/**
 * @param range - Selection range.
 * @param textNode - Intersected content text node.
 * @returns Selected slice of the text node.
 */
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

/**
 * @param offset - Raw DOM text offset.
 * @param textLength - Text node length.
 * @returns Offset constrained to the node length.
 */
function clampTextOffset(offset: number, textLength: number): number {
  return Math.min(Math.max(offset, 0), textLength);
}

/**
 * @param range - Selected DOM range.
 * @param block - Selected rendered block.
 * @returns Viewport bounds for the text-selection affordance.
 */
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

/**
 * @param block - Selected rendered block.
 * @returns Viewport bounds for the whole-block affordance.
 */
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

/**
 * @param block - Selected rendered block.
 * @returns Viewport x-coordinate for the comment lane when measurable.
 */
function createCommentLaneLeft(block: HTMLElement): number | undefined {
  const target = block.closest<HTMLElement>(COMMENT_TARGET_SELECTOR) ?? block;
  const rect = target.getBoundingClientRect();

  if (rect.width <= 0) {
    return undefined;
  }

  return rect.right - COMMENT_LANE_WIDTH;
}
