import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import type { CommentRangeHighlight } from "@/features/specs/domain/commentBlockHighlight";
import { CommentBlockHighlight } from "@/features/specs/domain/commentBlockHighlight";
import type { DocumentSearchCursor } from "@/features/specs/domain/documentSearch";

import { renderDocumentSearchHighlightedNode } from "./documentSearchHighlight";

type RangeRenderCursor = {
  position: number;
  keyIndex: number;
};

type CommentRangeHighlightSpanProps = Readonly<{
  highlight: CommentRangeHighlight;
  children: ReactNode;
}>;

/** @returns An inline exact-range comment highlight with its own activation target. */
function CommentRangeHighlightSpan({
  highlight,
  children,
}: CommentRangeHighlightSpanProps) {
  return (
    <span
      data-comment-highlight-range="true"
      data-comment-highlight-count={highlight.commentIds.length}
      data-comment-highlight-state={highlight.state}
      data-comment-ids={highlight.commentIds.join(" ")}
      aria-label={CommentBlockHighlight.createAriaLabel(highlight)}
    >
      {children}
    </span>
  );
}

/**
 * @param element - Rendered Markdown descendant element
 * @returns True when a Markdown descendant should keep its code styling intact.
 */
function isCodeElement(
  element: ReactElement<{ children?: ReactNode }>,
): boolean {
  return element.type === "code" || element.type === "pre";
}

/**
 * Advances the range cursor over unhighlighted descendants.
 *
 * @param node - Rendered Markdown descendant
 * @param cursor - Mutable text position cursor for the current block
 */
function advanceRangeCursorByNodeText(
  node: ReactNode,
  cursor: RangeRenderCursor,
): void {
  if (typeof node === "string" || typeof node === "number") {
    cursor.position += String(node).length;

    return;
  }

  if (Array.isArray(node)) {
    node.forEach((child) => {
      advanceRangeCursorByNodeText(child, cursor);
    });

    return;
  }

  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return;
  }

  advanceRangeCursorByNodeText(node.props.children, cursor);
}

/**
 * @param text - Plain text segment of the rendered block
 * @param rangeHighlights - Highlights sorted by start position
 * @param cursor - Mutable text position cursor for the current block
 * @returns Text split into plain and highlighted range segments.
 */
function renderRangeHighlightedText(
  text: string,
  rangeHighlights: readonly CommentRangeHighlight[],
  cursor: RangeRenderCursor,
): ReactNode {
  const absoluteStart = cursor.position;
  const absoluteEnd = absoluteStart + text.length;
  const parts: ReactNode[] = [];
  let localOffset = 0;

  for (const highlight of rangeHighlights) {
    if (highlight.end <= absoluteStart) {
      continue;
    }

    if (highlight.start >= absoluteEnd) {
      break;
    }

    const rangeStart = Math.max(highlight.start - absoluteStart, localOffset);
    const rangeEnd = Math.min(highlight.end - absoluteStart, text.length);

    if (rangeEnd <= rangeStart) {
      continue;
    }

    if (rangeStart > localOffset) {
      parts.push(text.slice(localOffset, rangeStart));
    }

    parts.push(
      <CommentRangeHighlightSpan
        key={`comment-range-${cursor.keyIndex}`}
        highlight={highlight}
      >
        {text.slice(rangeStart, rangeEnd)}
      </CommentRangeHighlightSpan>,
    );
    cursor.keyIndex += 1;
    localOffset = rangeEnd;
  }

  if (localOffset < text.length) {
    parts.push(text.slice(localOffset));
  }

  cursor.position = absoluteEnd;

  if (parts.length === 0) {
    return text;
  }

  return parts;
}

/**
 * @param node - Rendered Markdown descendant
 * @param rangeHighlights - Highlights sorted by start position
 * @param cursor - Mutable text position cursor for the current block
 * @returns One React node with range highlight spans inserted into text descendants.
 */
function renderRangeHighlightedNode(
  node: ReactNode,
  rangeHighlights: readonly CommentRangeHighlight[],
  cursor: RangeRenderCursor,
): ReactNode {
  if (typeof node === "string" || typeof node === "number") {
    return renderRangeHighlightedText(String(node), rangeHighlights, cursor);
  }

  if (Array.isArray(node)) {
    return node.map((child) =>
      renderRangeHighlightedNode(child, rangeHighlights, cursor),
    );
  }

  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return node;
  }

  const childElement = node as ReactElement<{ children?: ReactNode }>;

  if (childElement.props.children === undefined) {
    return childElement;
  }

  if (isCodeElement(childElement)) {
    advanceRangeCursorByNodeText(childElement.props.children, cursor);

    return childElement;
  }

  return cloneElement(
    childElement,
    undefined,
    renderRangeHighlightedNode(
      childElement.props.children,
      rangeHighlights,
      cursor,
    ),
  );
}

/**
 * @param children - Rendered Markdown block children
 * @param rangeHighlights - Exact comment ranges for the block
 * @returns Markdown children with exact comment ranges wrapped for emphasis.
 */
function renderRangeHighlightedChildren(
  children: ReactNode,
  rangeHighlights: readonly CommentRangeHighlight[],
): ReactNode {
  if (rangeHighlights.length === 0) {
    return children;
  }

  const cursor: RangeRenderCursor = {
    position: 0,
    keyIndex: 0,
  };
  const sortedHighlights = [...rangeHighlights].sort(
    (left, right) => left.start - right.start,
  );

  return renderRangeHighlightedNode(children, sortedHighlights, cursor);
}

/**
 * @param input - Block children with comment ranges and the search cursor
 * @returns Markdown children with comment and document search highlights.
 */
export function renderMarkdownTextChildren({
  children,
  rangeHighlights,
  documentSearchCursor,
}: Readonly<{
  children: ReactNode;
  rangeHighlights: readonly CommentRangeHighlight[];
  documentSearchCursor: DocumentSearchCursor | null;
}>): ReactNode {
  const commentHighlightedChildren = renderRangeHighlightedChildren(
    children,
    rangeHighlights,
  );

  if (documentSearchCursor === null) {
    return commentHighlightedChildren;
  }

  return renderDocumentSearchHighlightedNode(
    commentHighlightedChildren,
    documentSearchCursor,
  );
}
