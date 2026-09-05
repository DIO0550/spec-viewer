import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { type KeyboardEvent, useId } from "react";

import { uiText } from "@/utils/uiText";

export type DocumentSearchControlProps = Readonly<{
  query: string;
  statusText: string;
  hasMatches: boolean;
  disabled: boolean;
  /**
   * Handles changes to the document search query.
   * @param query - The updated search query text.
   */
  onQueryChange: (query: string) => void;
  /** Selects the previous document search match. */
  onPrevious: () => void;
  /** Selects the next document search match. */
  onNext: () => void;
  /** Clears the document search query. */
  onClear: () => void;
}>;

/** @returns Sticky document search controls for the current document. */
export function DocumentSearchControl({
  query,
  statusText,
  hasMatches,
  disabled,
  onQueryChange,
  onPrevious,
  onNext,
  onClear,
}: DocumentSearchControlProps) {
  const inputId = useId();
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
