import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { type KeyboardEvent, useId } from "react";

import { DocumentSearch } from "@/features/specs/domain/documentSearch";
import { uiText } from "@/shared/lib/uiText";

type Props = Readonly<{
  query: string;
  matchCount: number;
  activeMatchIndex: number;
  disabled: boolean;
  /** @param query - Raw search input typed by the user */
  onQueryChange: (query: string) => void;
  /** Moves the active match to the previous result. */
  onPrevious: () => void;
  /** Moves the active match to the next result. */
  onNext: () => void;
  /** Clears the current search query. */
  onClear: () => void;
}>;

/** @returns Sticky document search controls for the current Markdown file. */
export function DocumentSearchControl({
  query,
  matchCount,
  activeMatchIndex,
  disabled,
  onQueryChange,
  onPrevious,
  onNext,
  onClear,
}: Props) {
  const inputId = useId();
  const normalizedQuery = DocumentSearch.normalizeQuery(query);
  const hasQuery = normalizedQuery.length > 0;
  const hasMatches = matchCount > 0;
  const statusText = DocumentSearch.formatStatus({
    hasQuery,
    matchCount,
    activeMatchIndex,
  });
  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter" || !hasMatches) {
      return;
    }

    event.preventDefault();

    if (event.shiftKey) {
      onPrevious();
      return;
    }

    onNext();
  };

  return (
    <div className="markdown-document-search">
      <label className="markdown-document-search__label" htmlFor={inputId}>
        <Search aria-hidden="true" size={14} />
        {uiText.markdown.search}
      </label>
      <div className="markdown-document-search__field">
        <input
          id={inputId}
          aria-label={uiText.markdown.search}
          type="search"
          value={query}
          disabled={disabled}
          placeholder={uiText.markdown.searchPlaceholder}
          onInput={(event) => {
            onQueryChange(event.currentTarget.value);
          }}
          onKeyDown={handleInputKeyDown}
        />
        {query.length === 0 ? null : (
          <button
            className="icon-button markdown-document-search__clear"
            type="button"
            aria-label={uiText.markdown.clearSearch}
            title={uiText.markdown.clearSearch}
            onClick={onClear}
          >
            <X aria-hidden="true" size={13} />
          </button>
        )}
      </div>
      <span className="markdown-document-search__count" aria-live="polite">
        {statusText}
      </span>
      <div className="markdown-document-search__navigation">
        <button
          className="icon-button"
          type="button"
          aria-label={uiText.markdown.previousSearchMatch}
          title={uiText.markdown.previousSearchMatch}
          disabled={!hasMatches}
          onClick={onPrevious}
        >
          <ChevronLeft aria-hidden="true" size={14} />
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label={uiText.markdown.nextSearchMatch}
          title={uiText.markdown.nextSearchMatch}
          disabled={!hasMatches}
          onClick={onNext}
        >
          <ChevronRight aria-hidden="true" size={14} />
        </button>
      </div>
    </div>
  );
}
