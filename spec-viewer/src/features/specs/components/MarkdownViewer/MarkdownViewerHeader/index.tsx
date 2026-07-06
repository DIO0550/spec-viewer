import {
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { type KeyboardEvent, useId } from "react";

import { uiText } from "@/shared/lib/uiText";

export type HtmlZoomControlProps = Readonly<{
  zoomPercentLabel: string;
  canDecrease: boolean;
  canIncrease: boolean;
  /** Decreases the HTML preview zoom by one step. */
  onDecrease: () => void;
  /** Increases the HTML preview zoom by one step. */
  onIncrease: () => void;
}>;

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

export type MarkdownViewerHeaderProps = Readonly<{
  selectedSpecLabel: string | null;
  selectedFileLabel: string | null;
  fileKey: string;
  path: string;
  htmlZoom: HtmlZoomControlProps | null;
  documentSearch: DocumentSearchControlProps;
  /** Reloads the current spec document. */
  onReload: () => void;
}>;

/** @returns The Markdown viewer document header and action controls. */
export function MarkdownViewerHeader({
  selectedSpecLabel,
  selectedFileLabel,
  fileKey,
  path,
  htmlZoom,
  documentSearch,
  onReload,
}: MarkdownViewerHeaderProps) {
  return (
    <header className="markdown-viewer__header">
      <div>
        <p className="markdown-viewer__eyebrow">{selectedSpecLabel}</p>
        <h1>{selectedFileLabel ?? fileKey}</h1>
        <p className="markdown-viewer__path">{path}</p>
      </div>
      <div className="markdown-viewer__actions">
        {htmlZoom === null ? null : <HtmlZoomControl {...htmlZoom} />}
        <DocumentSearchControl {...documentSearch} />
        <button
          className="icon-button"
          type="button"
          aria-label={uiText.markdown.reload}
          title={uiText.markdown.reload}
          onClick={onReload}
        >
          <RefreshCcw aria-hidden="true" size={16} />
        </button>
      </div>
    </header>
  );
}

/** @returns Zoom controls for sandboxed HTML document previews. */
function HtmlZoomControl({
  zoomPercentLabel,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
}: HtmlZoomControlProps) {
  return (
    <div
      className="html-zoom-control"
      aria-label={uiText.markdown.htmlZoomControls}
    >
      <button
        className="icon-button"
        type="button"
        aria-label={uiText.markdown.decreaseHtmlZoom}
        title={uiText.markdown.decreaseHtmlZoom}
        disabled={!canDecrease}
        onClick={onDecrease}
      >
        <ZoomOut aria-hidden="true" size={15} />
      </button>
      <output
        className="html-zoom-control__value"
        aria-label={uiText.markdown.htmlZoomPercent}
      >
        {zoomPercentLabel}
      </output>
      <button
        className="icon-button"
        type="button"
        aria-label={uiText.markdown.increaseHtmlZoom}
        title={uiText.markdown.increaseHtmlZoom}
        disabled={!canIncrease}
        onClick={onIncrease}
      >
        <ZoomIn aria-hidden="true" size={15} />
      </button>
    </div>
  );
}

/** @returns Sticky document search controls for the current document. */
function DocumentSearchControl({
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
