export type DocumentSearchCursor = {
  query: string;
  activeIndex: number;
  matchIndex: number;
};

const EMPTY_MATCH_STATUS_TEXT = "0件";
const FIRST_MATCH_NUMBER = 1;

export const DocumentSearch = {
  /**
   * @param query - Raw user input
   * @returns Normalized document search query used for matching.
   */
  normalizeQuery(query: string): string {
    return query.trim().toLocaleLowerCase();
  },
  /**
   * @param input - Current query and match position
   * @returns Search status text shown next to document search controls.
   */
  formatStatus({
    hasQuery,
    matchCount,
    activeMatchIndex,
  }: Readonly<{
    hasQuery: boolean;
    matchCount: number;
    activeMatchIndex: number;
  }>): string {
    if (!hasQuery || matchCount === 0) {
      return EMPTY_MATCH_STATUS_TEXT;
    }

    return `${activeMatchIndex + FIRST_MATCH_NUMBER}/${matchCount}`;
  },
  /**
   * @param input - Rendered document root and normalized query
   * @returns Number of rendered search matches currently in the document.
   */
  countRenderedMatches({
    renderedRoot,
    searchQuery,
  }: Readonly<{
    renderedRoot: HTMLElement | null;
    searchQuery: string;
  }>): number {
    if (renderedRoot === null || searchQuery.length === 0) {
      return 0;
    }

    return renderedRoot.querySelectorAll("[data-document-search-match]").length;
  },
  /**
   * @param index - Requested active match index
   * @param matchCount - Number of available matches
   * @returns Active search index constrained to the available match count.
   */
  clampIndex(index: number, matchCount: number): number {
    if (matchCount <= 0) {
      return 0;
    }

    return Math.min(index, matchCount - 1);
  },
  /**
   * @param currentIndex - Current active match index
   * @param matchCount - Number of available matches
   * @returns Previous wrapped document search index.
   */
  previousIndex(currentIndex: number, matchCount: number): number {
    if (matchCount <= 0) {
      return 0;
    }

    return (currentIndex + matchCount - 1) % matchCount;
  },
  /**
   * @param currentIndex - Current active match index
   * @param matchCount - Number of available matches
   * @returns Next wrapped document search index.
   */
  nextIndex(currentIndex: number, matchCount: number): number {
    if (matchCount <= 0) {
      return 0;
    }

    return (currentIndex + 1) % matchCount;
  },
  /**
   * @param input - Normalized query and active match index
   * @returns A render-scoped cursor for document search matches.
   */
  createCursor({
    query,
    activeIndex,
  }: Readonly<{
    query: string;
    activeIndex: number;
  }>): DocumentSearchCursor | null {
    if (query.length === 0) {
      return null;
    }

    return {
      query,
      activeIndex,
      matchIndex: 0,
    };
  },
  /**
   * Scrolls the active document search match into view when available.
   *
   * @param input - Rendered document root and current match summary
   */
  scrollActiveMatchIntoView({
    renderedRoot,
    searchQuery,
    matchCount,
  }: Readonly<{
    renderedRoot: HTMLElement | null;
    searchQuery: string;
    matchCount: number;
  }>): void {
    if (renderedRoot === null || searchQuery.length === 0 || matchCount === 0) {
      return;
    }

    const activeMatch = renderedRoot.querySelector<HTMLElement>(
      '[data-document-search-match-active="true"]',
    );
    activeMatch?.scrollIntoView?.({ block: "center", inline: "nearest" });
  },
} as const;
