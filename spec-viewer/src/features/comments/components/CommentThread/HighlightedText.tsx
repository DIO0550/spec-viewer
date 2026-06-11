import type { ReactNode } from "react";

import { CommentSearchHighlight } from "@/features/comments/domain/commentSearchHighlight";

type Props = Readonly<{
  text: string;
  searchQuery: string;
}>;

/**
 * @param props - Text to render and the search query to highlight.
 * @returns Text with every search query occurrence marked for visual scanning.
 */
export function HighlightedText({ text, searchQuery }: Props) {
  const segments = CommentSearchHighlight.segments(text, searchQuery);
  const nodes: ReactNode[] = [];
  let characterOffset = 0;

  for (const segment of segments) {
    nodes.push(
      segment.isMatch ? (
        <mark className="comment-thread__search-match" key={characterOffset}>
          {segment.text}
        </mark>
      ) : (
        segment.text
      ),
    );
    characterOffset += segment.text.length;
  }

  return <>{nodes}</>;
}
