import { Search, X } from "lucide-react";
import { useId } from "react";

import { CommentSearch } from "@/features/comments/domain/commentSearch";
import { uiText } from "@/shared/lib/uiText";

type Props = Readonly<{
  searchQuery: string;
  resultCount: number;
  scopeCount: number;
  /** @param query - Raw search input typed by the user */
  onSearchQueryChange: (query: string) => void;
  /** Clears the current search query. */
  onClearSearch: () => void;
}>;

/** @returns A local comment search field with a live result count. */
export function CommentSearchControl({
  searchQuery,
  resultCount,
  scopeCount,
  onSearchQueryChange,
  onClearSearch,
}: Props) {
  const inputId = useId();
  const isSearching = CommentSearch.normalizeQuery(searchQuery).length > 0;
  const resultLabel = isSearching
    ? CommentSearch.formatResultCount(resultCount)
    : `${scopeCount}件が${uiText.sidebar.searchable}`;

  return (
    <div className="comment-sidebar__search">
      <label className="comment-sidebar__search-label" htmlFor={inputId}>
        {uiText.sidebar.search}
      </label>
      <div className="comment-sidebar__search-field">
        <Search aria-hidden="true" size={15} />
        <input
          id={inputId}
          aria-label={uiText.sidebar.search}
          type="search"
          placeholder={uiText.sidebar.searchPlaceholder}
          value={searchQuery}
          onInput={(event) => {
            onSearchQueryChange(event.currentTarget.value);
          }}
        />
        {searchQuery.length === 0 ? null : (
          <button
            className="icon-button comment-sidebar__search-clear"
            type="button"
            aria-label={uiText.sidebar.clearSearch}
            onClick={onClearSearch}
          >
            <X aria-hidden="true" size={15} />
          </button>
        )}
      </div>
      <p className="comment-sidebar__search-count" aria-live="polite">
        {resultLabel}
      </p>
    </div>
  );
}
