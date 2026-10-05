import {
  Clipboard,
  Download,
  MoreHorizontal,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useId, useState } from "react";
import { CommentSection } from "@/features/comments/components/CommentSection";
import {
  createCommentFilterCounts,
  createEmptyFilterCounts,
  filterCommentsByDisplayFilter,
  filterCommentsBySearchQuery,
  groupCommentsByStatus,
  normalizeCommentSearchQuery,
  type CommentFilterCounts,
} from "@/features/comments/domain/commentQuery";
import {
  commentFilterOptions,
  createAnchorDisplayStatusByCommentId,
  createCommentSearchAliases,
  createCommentSectionModels,
  formatFilterLabel,
} from "@/features/comments/presenters/commentSidebar";
import type { CommentId } from "@/features/comments/domain/commentId";
import type { CommentListState } from "@/features/comments/domain/commentListState";
import {
  CommentOperationFailedState,
  type CommentOperationState,
} from "@/features/comments/domain/commentOperation";
import type {
  ApplyWithAiPlaceholderState,
  CommentAnchorDisplayState,
  CommentDisplayFilter,
  CommentExportOperation,
  CommentExportScope,
} from "@/features/comments/types/comment";
import { uiText } from "@/utils/uiText";
import { CommandErrorDisplay } from "@/components/CommandErrorDisplay";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

type Props = Readonly<{
  listState: CommentListState;
  operationState: CommentOperationState;
  exportState?: CommentExportState;
  activeCommentId: CommentId | null;
  anchorDisplayStates?: readonly CommentAnchorDisplayState[];
  /**
   * Selects the given comment.
   * @param commentId - The comment to select.
   */
  onSelectComment: (commentId: CommentId) => void;
  /**
   * Marks the given comment as resolved.
   * @param commentId - The comment to resolve.
   */
  onResolveComment: (commentId: CommentId) => void;
  /**
   * Reopens the given resolved comment.
   * @param commentId - The comment to reopen.
   */
  onReopenComment: (commentId: CommentId) => void;
  /**
   * Deletes the given comment.
   * @param commentId - The comment to delete.
   */
  onDeleteComment: (commentId: CommentId) => void;
  /**
   * Updates the given comment's body.
   * @param commentId - The comment to update.
   * @param body - The new comment body text.
   */
  onUpdateComment: (commentId: CommentId, body: string) => void;
  /** Reloads the comment list. */
  onReload: () => void;
  onExportComments?: (scope: CommentExportScope) => void;
  onCopyLlmPrompt?: (scope: CommentExportScope) => void;
  onCopyMcpFeedback?: () => void;
}>;

export type CommentExportState =
  | Readonly<{
      status: "idle";
      operation: null;
      message: null;
    }>
  | Readonly<{
      status: "saving" | "success" | "error";
      operation: CommentExportOperation;
      message: string;
    }>;

const defaultDisplayFilter: CommentDisplayFilter = "open";

/** @returns The right-side comment review surface for the active spec file. */
export function CommentSidebar({
  listState,
  operationState,
  exportState = idleCommentExportState,
  activeCommentId,
  anchorDisplayStates = [],
  onSelectComment,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
  onUpdateComment,
  onReload,
  onExportComments,
  onCopyLlmPrompt,
  onCopyMcpFeedback,
}: Props) {
  const [activeFilter, setActiveFilter] =
    useState<CommentDisplayFilter>(defaultDisplayFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const canExportComments =
    listState.status === "ready" || listState.status === "empty";

  if (listState.status === "idle") {
    return (
      <section className="comment-sidebar" aria-label={uiText.sidebar.comments}>
        <CommentSidebarHeader
          openCount={0}
          resolvedCount={0}
          activeFilter={activeFilter}
          filterCounts={createEmptyFilterCounts()}
          showFilters={false}
          showExportControls={false}
          exportState={exportState}
          onFilterChange={setActiveFilter}
          onReload={onReload}
          onCopyLlmPrompt={onCopyLlmPrompt}
          onCopyMcpFeedback={onCopyMcpFeedback}
        />
        <EmptyState
          title={uiText.sidebar.idleTitle}
          description={uiText.sidebar.idleDescription}
          variant="inline"
        />
      </section>
    );
  }

  if (listState.status === "loading") {
    return (
      <section className="comment-sidebar" aria-label={uiText.sidebar.comments}>
        <CommentSidebarHeader
          openCount={0}
          resolvedCount={0}
          activeFilter={activeFilter}
          filterCounts={createEmptyFilterCounts()}
          showFilters={false}
          showExportControls={false}
          exportState={exportState}
          onFilterChange={setActiveFilter}
          onReload={onReload}
        />
        <LoadingSkeleton
          className="comment-sidebar__loading"
          label={uiText.sidebar.loading}
          rows={[
            { width: "medium" },
            { width: "full" },
            { width: "long" },
            { width: "medium" },
          ]}
        />
      </section>
    );
  }

  if (listState.status === "error") {
    return (
      <section className="comment-sidebar" aria-label={uiText.sidebar.comments}>
        <CommentSidebarHeader
          openCount={0}
          resolvedCount={0}
          activeFilter={activeFilter}
          filterCounts={createEmptyFilterCounts()}
          showFilters={false}
          showExportControls={false}
          exportState={exportState}
          onFilterChange={setActiveFilter}
          onReload={onReload}
        />
        <CommandErrorDisplay
          title={uiText.sidebar.unavailable}
          error={listState.error}
          actionLabel={uiText.sidebar.retry}
          onAction={onReload}
        />
      </section>
    );
  }

  if (listState.status === "empty") {
    return (
      <section className="comment-sidebar" aria-label={uiText.sidebar.comments}>
        <CommentSidebarHeader
          openCount={0}
          resolvedCount={0}
          activeFilter={activeFilter}
          filterCounts={createEmptyFilterCounts()}
          showFilters={false}
          showExportControls={canExportComments}
          exportState={exportState}
          onFilterChange={setActiveFilter}
          onReload={onReload}
          onExportComments={onExportComments}
          onCopyLlmPrompt={onCopyLlmPrompt}
          onCopyMcpFeedback={onCopyMcpFeedback}
        />
        <CommentExportFeedback exportState={exportState} />
        <EmptyState
          title={uiText.sidebar.empty}
          description={`${uiText.sidebar.emptyDescription} ${uiText.sidebar.addHint}`}
          variant="inline"
        />
      </section>
    );
  }

  const groups = groupCommentsByStatus(listState.comments);
  const anchorDisplayStatusByCommentId =
    createAnchorDisplayStatusByCommentId(anchorDisplayStates);
  const filterCounts = createCommentFilterCounts(listState.comments);
  const filteredComments = filterCommentsByDisplayFilter(
    listState.comments,
    activeFilter,
  );
  const normalizedSearchQuery = normalizeCommentSearchQuery(searchQuery);
  const searchedComments = filterCommentsBySearchQuery({
    comments: filteredComments,
    searchQuery: normalizedSearchQuery,
    additionalSearchFieldsByCommentId: createCommentSearchAliases(
      filteredComments,
      anchorDisplayStatusByCommentId,
    ),
  });
  const sectionModels = createCommentSectionModels(
    activeFilter,
    searchedComments,
  );

  return (
    <section className="comment-sidebar" aria-label={uiText.sidebar.comments}>
      <CommentSidebarHeader
        openCount={groups.openComments.length}
        resolvedCount={groups.resolvedComments.length}
        activeFilter={activeFilter}
        filterCounts={filterCounts}
        showFilters={true}
        showExportControls={canExportComments}
        exportState={exportState}
        onFilterChange={setActiveFilter}
        onReload={onReload}
        onExportComments={onExportComments}
        onCopyLlmPrompt={onCopyLlmPrompt}
        onCopyMcpFeedback={onCopyMcpFeedback}
      />
      <CommentExportFeedback exportState={exportState} />
      <CommentSearchControl
        searchQuery={searchQuery}
        resultCount={searchedComments.length}
        scopeCount={filteredComments.length}
        onSearchQueryChange={setSearchQuery}
        onClearSearch={() => {
          setSearchQuery("");
        }}
      />
      <OperationErrorMessage operationState={operationState} />
      {searchedComments.length === 0 ? (
        <FilteredEmptyState
          activeFilter={activeFilter}
          searchQuery={normalizedSearchQuery}
        />
      ) : (
        sectionModels.map((sectionModel) => (
          <CommentSection
            key={sectionModel.id}
            id={sectionModel.id}
            title={sectionModel.title}
            comments={sectionModel.comments}
            activeCommentId={activeCommentId}
            anchorDisplayStatusByCommentId={anchorDisplayStatusByCommentId}
            searchQuery={normalizedSearchQuery}
            operationState={operationState}
            emptyMessage={sectionModel.emptyMessage}
            actions={{
              onSelectComment,
              onResolveComment,
              onReopenComment,
              onDeleteComment,
              onUpdateComment,
            }}
          />
        ))
      )}
    </section>
  );
}

type CommentSearchControlProps = Readonly<{
  searchQuery: string;
  resultCount: number;
  scopeCount: number;
  /**
   * Updates the current search query.
   * @param query - The new search query text.
   */
  onSearchQueryChange: (query: string) => void;
  /** Clears the current search query. */
  onClearSearch: () => void;
}>;

/** @returns A local comment search field with a live result count. */
function CommentSearchControl({
  searchQuery,
  resultCount,
  scopeCount,
  onSearchQueryChange,
  onClearSearch,
}: CommentSearchControlProps) {
  const inputId = useId();
  const isSearching = normalizeCommentSearchQuery(searchQuery).length > 0;
  const resultLabel = isSearching
    ? formatSearchResultCount(resultCount)
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

type HeaderProps = Readonly<{
  openCount: number;
  resolvedCount: number;
  activeFilter: CommentDisplayFilter;
  filterCounts: CommentFilterCounts;
  showFilters: boolean;
  showExportControls: boolean;
  exportState: CommentExportState;
  /**
   * Changes the active display filter.
   * @param filter - The filter to activate.
   */
  onFilterChange: (filter: CommentDisplayFilter) => void;
  /** Reloads the comment list. */
  onReload: () => void;
  onExportComments?: (scope: CommentExportScope) => void;
  onCopyLlmPrompt?: (scope: CommentExportScope) => void;
  onCopyMcpFeedback?: () => void;
}>;

/** @returns Sidebar title and total count badges. */
function CommentSidebarHeader({
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
}: HeaderProps) {
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
          {showExportControls &&
          (onExportComments !== undefined ||
            onCopyLlmPrompt !== undefined ||
            onCopyMcpFeedback !== undefined) ? (
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
          {commentFilterOptions.map((option) => (
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

type CommentExportControlsProps = Readonly<{
  exportState: CommentExportState;
  onExportComments?: (scope: CommentExportScope) => void;
  onCopyLlmPrompt?: (scope: CommentExportScope) => void;
  onCopyMcpFeedback?: () => void;
}>;

const idleCommentExportState: CommentExportState = {
  status: "idle",
  operation: null,
  message: null,
};

const applyWithAiPlaceholderState: ApplyWithAiPlaceholderState = {
  availability: "placeholder",
  enabled: false,
  selectedCommentsInput: null,
  generatedDiffPreview: {
    status: "notGenerated",
    files: [],
  },
  requiresExplicitUserConfirmationBeforeWrite: true,
  markdownWriteSupport: "notConnected",
  explanation: uiText.sidebar.applyAiPlaceholder,
};

const commentExportOptions: readonly Readonly<{
  scope: CommentExportScope;
  exportLabel: string;
  exportAriaLabel: string;
  promptLabel: string;
  promptAriaLabel: string;
}>[] = [
  {
    scope: "file",
    exportLabel: uiText.sidebar.exportFileComments,
    exportAriaLabel: uiText.sidebar.exportFileComments,
    promptLabel: `${uiText.sidebar.file}の${uiText.sidebar.copyPrompt}`,
    promptAriaLabel: `${uiText.sidebar.file}の${uiText.sidebar.copyPrompt}`,
  },
  {
    scope: "spec",
    exportLabel: uiText.sidebar.exportSpecComments,
    exportAriaLabel: uiText.sidebar.exportSpecComments,
    promptLabel: `${uiText.sidebar.spec}の${uiText.sidebar.copyPrompt}`,
    promptAriaLabel: `${uiText.sidebar.spec}の${uiText.sidebar.copyPrompt}`,
  },
  {
    scope: "workspace",
    exportLabel: uiText.sidebar.exportWorkspaceComments,
    exportAriaLabel: uiText.sidebar.exportWorkspaceComments,
    promptLabel: `${uiText.sidebar.workspace}の${uiText.sidebar.copyPrompt}`,
    promptAriaLabel: `${uiText.sidebar.workspace}の${uiText.sidebar.copyPrompt}`,
  },
];

/** @returns Secondary comment export and AI handoff actions for the selected review scope. */
function CommentExportControls({
  exportState,
  onExportComments,
  onCopyLlmPrompt,
  onCopyMcpFeedback,
}: CommentExportControlsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuId = useId();
  const placeholderDescriptionId = useId();
  const isCopyingMcpFeedback =
    exportState.status === "saving" && exportState.operation === "mcpFeedback";

  return (
    <div className="comment-sidebar__secondary-actions">
      <button
        className="icon-button comment-sidebar__secondary-trigger"
        type="button"
        aria-label={uiText.sidebar.moreActions}
        title={uiText.sidebar.moreActions}
        aria-controls={menuId}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        onClick={() => {
          setIsMenuOpen((currentIsMenuOpen) => !currentIsMenuOpen);
        }}
      >
        <MoreHorizontal aria-hidden="true" size={14} />
      </button>
      {isMenuOpen ? (
        <div
          id={menuId}
          className="comment-sidebar__exports"
          role="menu"
          aria-label={uiText.sidebar.exports}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsMenuOpen(false);
            }
          }}
        >
          {onExportComments === undefined
            ? null
            : commentExportOptions.map((option) => {
                const isSaving =
                  exportState.status === "saving" &&
                  exportState.operation === option.scope;

                return (
                  <button
                    key={`comments-${option.scope}`}
                    className="comment-sidebar__export"
                    type="button"
                    role="menuitem"
                    aria-label={option.exportAriaLabel}
                    disabled={exportState.status === "saving"}
                    onClick={() => {
                      onExportComments(option.scope);
                    }}
                  >
                    <Download aria-hidden="true" size={14} />
                    <span>
                      {isSaving ? uiText.sidebar.saving : option.exportLabel}
                    </span>
                  </button>
                );
              })}
          {onCopyLlmPrompt === undefined
            ? null
            : commentExportOptions.map((option) => (
                <button
                  key={`prompt-${option.scope}`}
                  className="comment-sidebar__export"
                  type="button"
                  role="menuitem"
                  aria-label={option.promptAriaLabel}
                  disabled={exportState.status === "saving"}
                  onClick={() => {
                    onCopyLlmPrompt(option.scope);
                  }}
                >
                  <Clipboard aria-hidden="true" size={14} />
                  <span>{option.promptLabel}</span>
                </button>
              ))}
          {onCopyMcpFeedback === undefined ? null : (
            <button
              className="comment-sidebar__export"
              type="button"
              role="menuitem"
              aria-label="現在のファイルのMCP feedback payloadをコピー"
              disabled={exportState.status === "saving"}
              onClick={onCopyMcpFeedback}
            >
              <Clipboard aria-hidden="true" size={14} />
              <span>
                {isCopyingMcpFeedback
                  ? uiText.sidebar.copying
                  : uiText.sidebar.mcpFeedback}
              </span>
            </button>
          )}
          <button
            className="comment-sidebar__export comment-sidebar__export--placeholder"
            type="button"
            role="menuitem"
            aria-label={uiText.sidebar.applyAiLabel}
            aria-describedby={placeholderDescriptionId}
            disabled={!applyWithAiPlaceholderState.enabled}
          >
            <Sparkles aria-hidden="true" size={14} />
            <span>{uiText.sidebar.applyAi}</span>
          </button>
          <p
            id={placeholderDescriptionId}
            className="comment-sidebar__apply-ai-note"
          >
            {applyWithAiPlaceholderState.explanation}
          </p>
        </div>
      ) : null}
    </div>
  );
}

type CommentExportFeedbackProps = Readonly<{
  exportState: CommentExportState;
}>;

/**
 * @param props - Wrapper carrying the latest comment export state.
 * @returns A compact status message for the latest comment export attempt.
 */
function CommentExportFeedback({ exportState }: CommentExportFeedbackProps) {
  if (exportState.status === "idle" || exportState.status === "saving") {
    return null;
  }

  return (
    <p
      className={`comment-sidebar__export-feedback comment-sidebar__export-feedback--${exportState.status}`}
      role={exportState.status === "error" ? "alert" : "status"}
    >
      {exportState.message}
    </p>
  );
}

type OperationErrorMessageProps = Readonly<{
  operationState: CommentOperationState;
}>;

/**
 * @param props - Wrapper carrying the latest comment operation state.
 * @returns A compact operation error, or null when the latest operation succeeded.
 */
function OperationErrorMessage({ operationState }: OperationErrorMessageProps) {
  const operationError = CommentOperationFailedState.errorOf(operationState);

  if (operationError === null) {
    return null;
  }

  return (
    <p className="comment-sidebar__operation-error" role="alert">
      {operationError.message}
    </p>
  );
}

type FilteredEmptyStateProps = Readonly<{
  activeFilter: CommentDisplayFilter;
  searchQuery: string;
}>;

/** @returns A focused empty state when the selected filter has no matches. */
function FilteredEmptyState({
  activeFilter,
  searchQuery,
}: FilteredEmptyStateProps) {
  if (searchQuery.length > 0) {
    return (
      <p className="comment-sidebar__filtered-empty">
        &quot;{searchQuery}&quot;{uiText.sidebar.noSearchResults}
      </p>
    );
  }

  return (
    <p className="comment-sidebar__filtered-empty">
      {formatFilterLabel(activeFilter)}
      {uiText.sidebar.noFilterResults}
    </p>
  );
}

/**
 * @param resultCount - The number of matching search results.
 * @returns A compact result count label for the search field.
 */
function formatSearchResultCount(resultCount: number): string {
  if (resultCount === 1) {
    return "1件";
  }

  return `${resultCount}件`;
}
