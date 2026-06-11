import { RefreshCw } from "lucide-react";

import { CommentExportControls } from "@/features/comments/components/CommentExportControls";
import {
  CommentDisplayFilter,
  type CommentFilterCounts,
} from "@/features/comments/domain/commentDisplayFilter";
import type { CommentExportState } from "@/features/comments/domain/commentExport";
import type {
  CommentDisplayFilter as CommentDisplayFilterType,
  CommentExportScope,
} from "@/features/comments/types/comment";
import { uiText } from "@/shared/lib/uiText";

type Props = Readonly<{
  openCount: number;
  resolvedCount: number;
  activeFilter: CommentDisplayFilterType;
  filterCounts: CommentFilterCounts;
  showFilters: boolean;
  showExportControls: boolean;
  exportState: CommentExportState;
  /** @param filter - Display filter selected by the user */
  onFilterChange: (filter: CommentDisplayFilterType) => void;
  /** Reloads comments for the current scope. */
  onReload: () => void;
  /** @param scope - Export scope selected from the menu */
  onExportComments?: (scope: CommentExportScope) => void;
  /** @param scope - Prompt scope selected from the menu */
  onCopyLlmPrompt?: (scope: CommentExportScope) => void;
  /** Copies the dry-run MCP feedback payload for the current file. */
  onCopyMcpFeedback?: () => void;
}>;

/**
 * @param props - Header counts, filter selection, and export callbacks
 * @returns True when at least one export action is provided.
 */
function hasExportActions({
  onExportComments,
  onCopyLlmPrompt,
  onCopyMcpFeedback,
}: Pick<
  Props,
  "onExportComments" | "onCopyLlmPrompt" | "onCopyMcpFeedback"
>): boolean {
  return (
    onExportComments !== undefined ||
    onCopyLlmPrompt !== undefined ||
    onCopyMcpFeedback !== undefined
  );
}

/** @returns Sidebar title and total count badges. */
export function CommentSidebarHeader({
  openCount,
  resolvedCount,
  activeFilter,
  filterCounts,
  showFilters,
  showExportControls,
  exportState,
  onFilterChange,
  onReload,
  onExportComments,
  onCopyLlmPrompt,
  onCopyMcpFeedback,
}: Props) {
  const showExportMenu =
    showExportControls &&
    hasExportActions({ onExportComments, onCopyLlmPrompt, onCopyMcpFeedback });

  return (
    <header className="comment-sidebar__header">
      <div className="comment-sidebar__header-top">
        <div>
          <h2>{uiText.sidebar.comments}</h2>
          <p>{uiText.sidebar.description}</p>
        </div>
        <div className="comment-sidebar__header-actions">
          <button
            className="icon-button"
            type="button"
            aria-label="コメントを再読み込み"
            title="コメントを再読み込み"
            onClick={onReload}
          >
            <RefreshCw aria-hidden="true" size={14} />
          </button>
          {showExportMenu ? (
            <CommentExportControls
              exportState={exportState}
              onExportComments={onExportComments}
              onCopyLlmPrompt={onCopyLlmPrompt}
              onCopyMcpFeedback={onCopyMcpFeedback}
            />
          ) : null}
        </div>
      </div>
      <section
        className="comment-sidebar__summary"
        aria-label={uiText.sidebar.counts}
      >
        <span className="comment-sidebar__count">
          {uiText.sidebar.openFilter}
          <span>{openCount}</span>
        </span>
        <span className="comment-sidebar__count comment-sidebar__count--muted">
          {uiText.sidebar.resolved}
          <span>{resolvedCount}</span>
        </span>
      </section>
      {showFilters ? (
        <section
          className="comment-sidebar__filters"
          aria-label={uiText.sidebar.filters}
        >
          {CommentDisplayFilter.options.map((option) => (
            <button
              key={option.filter}
              className="comment-sidebar__filter"
              type="button"
              aria-label={option.ariaLabel}
              aria-pressed={activeFilter === option.filter}
              onClick={() => {
                onFilterChange(option.filter);
              }}
            >
              <span>{option.label}</span>
              <span>{filterCounts[option.filter]}</span>
            </button>
          ))}
        </section>
      ) : null}
    </header>
  );
}
