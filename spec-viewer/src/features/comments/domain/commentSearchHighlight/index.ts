export type CommentSearchHighlightSegment = Readonly<{
  text: string;
  isMatch: boolean;
}>;

export const CommentSearchHighlight = {
  /**
   * @param text - Original text to mark up
   * @param searchQuery - Normalized lowercase search query
   * @returns Text segments with every query occurrence flagged as a match.
   */
  segments(
    text: string,
    searchQuery: string,
  ): readonly CommentSearchHighlightSegment[] {
    if (searchQuery.length === 0) {
      return [{ text, isMatch: false }];
    }

    const lowerText = text.toLocaleLowerCase();
    const segments: CommentSearchHighlightSegment[] = [];
    let cursor = 0;
    let matchIndex = lowerText.indexOf(searchQuery);

    while (matchIndex >= 0) {
      if (matchIndex > cursor) {
        segments.push({ text: text.slice(cursor, matchIndex), isMatch: false });
      }

      const matchEnd = matchIndex + searchQuery.length;

      segments.push({
        text: text.slice(matchIndex, matchEnd),
        isMatch: true,
      });

      cursor = matchEnd;
      matchIndex = lowerText.indexOf(searchQuery, cursor);
    }

    if (cursor < text.length) {
      segments.push({ text: text.slice(cursor), isMatch: false });
    }

    return segments;
  },
} as const;
