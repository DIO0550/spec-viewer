import { type RefObject, useEffect, useState } from "react";

import { DocumentSearch } from "@/features/specs/domain/documentSearch";

type UseDocumentSearchOptions = Readonly<{
  renderedRootRef: RefObject<HTMLElement | null>;
  readyContents: string | null;
  resetKey: string;
}>;

type UseDocumentSearchResult = Readonly<{
  query: string;
  normalizedQuery: string;
  matchCount: number;
  activeMatchIndex: number;
  /** @param query - Raw search input typed by the user */
  changeQuery: (query: string) => void;
  /** Moves the active match to the previous result. */
  goToPrevious: () => void;
  /** Moves the active match to the next result. */
  goToNext: () => void;
  /** Clears the current search query. */
  clear: () => void;
}>;

/**
 * Manages in-document search state synchronized with the rendered Markdown DOM.
 *
 * @param options - Rendered root ref, current contents, and the document reset key
 * @returns Search state and navigation operations.
 */
export function useDocumentSearch({
  renderedRootRef,
  readyContents,
  resetKey,
}: UseDocumentSearchOptions): UseDocumentSearchResult {
  const [query, setQuery] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const normalizedQuery = DocumentSearch.normalizeQuery(query);

  useEffect(() => {
    setQuery("");
    setActiveMatchIndex(0);
    setMatchCount(0);
  }, [resetKey]);
  useEffect(() => {
    setActiveMatchIndex(0);
  }, [normalizedQuery]);
  useEffect(() => {
    const nextMatchCount = DocumentSearch.countRenderedMatches({
      renderedRoot: renderedRootRef.current,
      searchQuery: normalizedQuery,
    });

    setMatchCount(nextMatchCount);
    setActiveMatchIndex((currentIndex) =>
      DocumentSearch.clampIndex(currentIndex, nextMatchCount),
    );
  }, [normalizedQuery, readyContents, renderedRootRef]);
  useEffect(() => {
    DocumentSearch.scrollActiveMatchIntoView({
      renderedRoot: renderedRootRef.current,
      searchQuery: normalizedQuery,
      matchCount,
    });
  }, [normalizedQuery, matchCount, activeMatchIndex, renderedRootRef]);

  const goToPrevious = (): void => {
    setActiveMatchIndex((currentIndex) =>
      DocumentSearch.previousIndex(currentIndex, matchCount),
    );
  };

  const goToNext = (): void => {
    setActiveMatchIndex((currentIndex) =>
      DocumentSearch.nextIndex(currentIndex, matchCount),
    );
  };

  const clear = (): void => {
    setQuery("");
  };

  return {
    query,
    normalizedQuery,
    matchCount,
    activeMatchIndex,
    changeQuery: setQuery,
    goToPrevious,
    goToNext,
    clear,
  };
}
