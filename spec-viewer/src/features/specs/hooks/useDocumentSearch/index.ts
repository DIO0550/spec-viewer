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

  // biome-ignore lint/correctness/useExhaustiveDependencies(resetKey): 表示ドキュメントの切り替え（resetKey変更）を契機に検索状態を初期化するための意図的な依存
  useEffect(() => {
    setQuery("");
    setActiveMatchIndex(0);
    setMatchCount(0);
  }, [resetKey]);
  // biome-ignore lint/correctness/useExhaustiveDependencies(normalizedQuery): 検索クエリの変更を契機にアクティブマッチ位置を先頭へ戻すための意図的な依存
  useEffect(() => {
    setActiveMatchIndex(0);
  }, [normalizedQuery]);
  // biome-ignore lint/correctness/useExhaustiveDependencies(readyContents): ドキュメント内容の再描画後にDOM上のマッチを数え直すための意図的な依存
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
  // biome-ignore lint/correctness/useExhaustiveDependencies(activeMatchIndex): アクティブマッチの切り替えでDOM属性が更新された後に再スクロールするための意図的な依存
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
