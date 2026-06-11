export const BLOCK_SELECTOR = "[data-block-type][data-block-index]";
export const BACKEND_BLOCK_SELECTOR =
  "[data-block-type][data-block-index][data-comment-block-type][data-text-hash]";
export const COMMENT_UI_SELECTOR =
  ".markdown-block-comment-button, .markdown-comment-annotations";

/**
 * @param range - Current DOM selection range.
 * @param renderedRoot - Rendered Markdown root element.
 * @returns true when both range endpoints are inside the rendered Markdown root.
 */
export function isRangeInsideRoot(
  range: Range,
  renderedRoot: HTMLElement,
): boolean {
  return (
    containsSelectionNode(renderedRoot, range.startContainer) &&
    containsSelectionNode(renderedRoot, range.endContainer)
  );
}

/**
 * @param node - Selected DOM node.
 * @param renderedRoot - Rendered Markdown root element.
 * @returns The nearest commentable Markdown block for a selected node.
 */
export function findSelectionBlock(
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

/**
 * @param range - Current DOM selection range.
 * @param block - Rendered Markdown block element.
 * @returns The selected character range within the rendered block text.
 */
export function createCharRange(
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

/**
 * @param block - Rendered Markdown block element.
 * @returns Markdown block text without comment controls or annotation UI.
 */
export function createBlockText(block: HTMLElement): string {
  return getAnchorTextNodes(block)
    .map((textNode) => textNode.data)
    .join("");
}

/**
 * @param range - Current DOM selection range.
 * @param block - Rendered Markdown block element.
 * @returns Selected text inside one Markdown block without comment UI text.
 */
export function createRangeText(range: Range, block: HTMLElement): string {
  return getAnchorTextNodes(block)
    .filter((textNode) => range.intersectsNode(textNode))
    .map((textNode) => createSelectedTextFromNode(range, textNode))
    .join("");
}

/**
 * @param root - Rendered Markdown root element.
 * @param node - Selection endpoint node.
 * @returns true when the node or its owning element belongs to the root.
 */
function containsSelectionNode(root: HTMLElement, node: Node): boolean {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return root.contains(node);
  }

  return node.parentElement !== null && root.contains(node.parentElement);
}

/**
 * @param block - Rendered Markdown block element.
 * @param targetNode - Range endpoint node.
 * @param targetOffset - Range endpoint offset.
 * @returns A text offset for a DOM range endpoint inside the block.
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
 * @param block - Rendered Markdown block element.
 * @returns Text nodes that belong to the Markdown content itself.
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
 * @param node - Candidate text node.
 * @returns True when the node belongs to comment controls instead of Markdown text.
 */
function isCommentUiNode(node: Node): boolean {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;

  return element?.closest(COMMENT_UI_SELECTOR) !== null;
}

/**
 * @param range - Current DOM selection range.
 * @param textNode - Text node intersecting the range.
 * @returns The selected slice of one text node.
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
 * @param offset - Raw DOM offset.
 * @param textLength - Length of the text node.
 * @returns A DOM text offset constrained to the node length.
 */
function clampTextOffset(offset: number, textLength: number): number {
  return Math.min(Math.max(offset, 0), textLength);
}
