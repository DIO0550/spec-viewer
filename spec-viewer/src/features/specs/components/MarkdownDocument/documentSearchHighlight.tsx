import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import type { DocumentSearchCursor } from "@/features/specs/domain/documentSearch";

/**
 * @param text - Plain text segment of the rendered block
 * @param cursor - Mutable document search cursor for the current render
 * @returns Text split into plain and document search match segments.
 */
function renderDocumentSearchHighlightedText(
  text: string,
  cursor: DocumentSearchCursor,
): ReactNode {
  const parts: ReactNode[] = [];
  const lowerText = text.toLocaleLowerCase();
  let localOffset = 0;
  let matchStart = lowerText.indexOf(cursor.query);

  while (matchStart >= 0) {
    const matchEnd = matchStart + cursor.query.length;

    if (matchStart > localOffset) {
      parts.push(text.slice(localOffset, matchStart));
    }

    const isActive = cursor.matchIndex === cursor.activeIndex;
    parts.push(
      <mark
        className="markdown-document-search__match"
        key={`document-search-${cursor.matchIndex}`}
        data-document-search-match="true"
        data-document-search-match-active={isActive ? "true" : undefined}
      >
        {text.slice(matchStart, matchEnd)}
      </mark>,
    );
    cursor.matchIndex += 1;
    localOffset = matchEnd;
    matchStart = lowerText.indexOf(cursor.query, localOffset);
  }

  if (localOffset < text.length) {
    parts.push(text.slice(localOffset));
  }

  if (parts.length === 0) {
    return text;
  }

  return parts;
}

/**
 * @param node - Rendered Markdown descendant
 * @param cursor - Mutable document search cursor for the current render
 * @returns One React node with document search mark elements inserted.
 */
export function renderDocumentSearchHighlightedNode(
  node: ReactNode,
  cursor: DocumentSearchCursor,
): ReactNode {
  if (typeof node === "string" || typeof node === "number") {
    return renderDocumentSearchHighlightedText(String(node), cursor);
  }

  if (Array.isArray(node)) {
    return node.map((child) =>
      renderDocumentSearchHighlightedNode(child, cursor),
    );
  }

  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return node;
  }

  const childElement = node as ReactElement<{ children?: ReactNode }>;

  if (childElement.props.children === undefined) {
    return childElement;
  }

  return cloneElement(
    childElement,
    undefined,
    renderDocumentSearchHighlightedNode(childElement.props.children, cursor),
  );
}
