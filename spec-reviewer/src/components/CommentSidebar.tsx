import { Download, Search, X } from "lucide-react";
import { useId, useState } from "react";

import type {
  CommentListState,
  CommentMutationState,
} from "../hooks/useComments";
import type {
  Comment,
  CommentAnchorDisplayState,
  CommentAnchorDisplayStatus,
  CommentDisplayFilter,
  CommentExportScope,
  CommentId,
} from "../types/comment";
import { CommandErrorDisplay } from "./CommandErrorDisplay";
import { CommentThread } from "./CommentThread";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";

type Props = Readonly<{
  listState: CommentListState;
  mutationState: CommentMutationState;
  exportState?: CommentExportState;
  activeCommentId: CommentId | null;
  anchorDisplayStates?: readonly CommentAnchorDisplayState[];
  onSelectComment: (commentId: CommentId) => void;
  onResolveComment: (commentId: CommentId) => void;
  onReopenComment: (commentId: CommentId) => void;
  onDeleteComment: (commentId: CommentId) => void;
  onUpdateComment: (commentId: CommentId, body: string) => void;
  onReload: () => void;
  onExportComments?: (scope: CommentExportScope) => void;
}>;

type CommentGroups = Readonly<{
  openComments: readonly Comment[];
  resolvedComments: readonly Comment[];
}>;

type CommentFilterOption = Readonly<{
  filter: CommentDisplayFilter;
  label: string;
  ariaLabel: string;
}>;

type CommentFilterCounts = Readonly<Record<CommentDisplayFilter, number>>;

type CommentSectionModel = Readonly<{
  id: string;
  title: string;
  comments: readonly Comment[];
  emptyMessage: string;
}>;

export type CommentExportState =
  | Readonly<{
      status: "idle";
      operation: null;
      message: null;
    }>
  | Readonly<{
      status: "saving" | "success" | "error";
      operation: CommentExportScope;
      message: string;
    }>;

type CommentSearchFilterParams = Readonly<{
  comments: readonly Comment[];
  searchQuery: string;
  anchorDisplayStatusByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >;
}>;

const defaultDisplayFilter: CommentDisplayFilter = "all";

const commentFilterOptions: readonly CommentFilterOption[] = [
  {
    filter: "all",
    label: "All",
    ariaLabel: "Show all comments",
  },
  {
    filter: "open",
    label: "Open",
    ariaLabel: "Show open comments",
  },
  {
    filter: "resolved",
    label: "Resolved",
    ariaLabel: "Show resolved comments",
  },
  {
    filter: "moved",
    label: "Moved",
    ariaLabel: "Show moved anchor comments",
  },
  {
    filter: "fuzzy",
    label: "Fuzzy",
    ariaLabel: "Show fuzzy anchor comments",
  },
  {
    filter: "stale",
    label: "Stale",
    ariaLabel: "Show stale anchor comments",
  },
  {
    filter: "orphaned",
    label: "Orphaned",
    ariaLabel: "Show orphaned anchor comments",
  },
];

/** @returns The right-side comment review surface for the active spec file. */
export function CommentSidebar({
  listState,
  mutationState,
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
}: Props) {
  const [activeFilter, setActiveFilter] =
    useState<CommentDisplayFilter>(defaultDisplayFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const canExportComments =
    listState.status === "ready" || listState.status === "empty";

  if (listState.status === "idle") {
    return (
      <section className="comment-sidebar" aria-label="Comments">
        <CommentSidebarHeader
          openCount={0}
          resolvedCount={0}
          activeFilter={activeFilter}
          filterCounts={createEmptyFilterCounts()}
          showFilters={false}
          showExportControls={false}
          exportState={exportState}
          onFilterChange={setActiveFilter}
        />
        <EmptyState
          title="Select a spec file"
          description="Comments appear here once a workspace, spec, and file are selected."
          variant="inline"
        />
      </section>
    );
  }

  if (listState.status === "loading") {
    return (
      <section className="comment-sidebar" aria-label="Comments">
        <CommentSidebarHeader
          openCount={0}
          resolvedCount={0}
          activeFilter={activeFilter}
          filterCounts={createEmptyFilterCounts()}
          showFilters={false}
          showExportControls={false}
          exportState={exportState}
          onFilterChange={setActiveFilter}
        />
        <LoadingSkeleton
          className="comment-sidebar__loading"
          label="Loading comments"
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
      <section className="comment-sidebar" aria-label="Comments">
        <CommentSidebarHeader
          openCount={0}
          resolvedCount={0}
          activeFilter={activeFilter}
          filterCounts={createEmptyFilterCounts()}
          showFilters={false}
          showExportControls={false}
          exportState={exportState}
          onFilterChange={setActiveFilter}
        />
        <CommandErrorDisplay
          title="Comments unavailable"
          error={listState.error}
          actionLabel="Retry"
          onAction={onReload}
        />
      </section>
    );
  }

  if (listState.status === "empty") {
    return (
      <section className="comment-sidebar" aria-label="Comments">
        <CommentSidebarHeader
          openCount={0}
          resolvedCount={0}
          activeFilter={activeFilter}
          filterCounts={createEmptyFilterCounts()}
          showFilters={false}
          showExportControls={canExportComments}
          exportState={exportState}
          onFilterChange={setActiveFilter}
          onExportComments={onExportComments}
        />
        <CommentExportFeedback exportState={exportState} />
        <EmptyState
          title="No comments yet"
          description="Open and resolved comments for this file will appear here."
          variant="inline"
        />
      </section>
    );
  }

  const groups = groupCommentsByStatus(listState.comments);
  const anchorDisplayStatusByCommentId =
    createAnchorDisplayStatusByCommentId(anchorDisplayStates);
  const filterCounts = createCommentFilterCounts(
    listState.comments,
    anchorDisplayStatusByCommentId,
  );
  const filteredComments = filterCommentsByDisplayFilter(
    listState.comments,
    activeFilter,
    anchorDisplayStatusByCommentId,
  );
  const normalizedSearchQuery = normalizeCommentSearchQuery(searchQuery);
  const searchedComments = filterCommentsBySearchQuery({
    comments: filteredComments,
    searchQuery: normalizedSearchQuery,
    anchorDisplayStatusByCommentId,
  });
  const sectionModels = createCommentSectionModels(
    activeFilter,
    searchedComments,
  );

  return (
    <section className="comment-sidebar" aria-label="Comments">
      <CommentSidebarHeader
        openCount={groups.openComments.length}
        resolvedCount={groups.resolvedComments.length}
        activeFilter={activeFilter}
        filterCounts={filterCounts}
        showFilters={true}
        showExportControls={canExportComments}
        exportState={exportState}
        onFilterChange={setActiveFilter}
        onExportComments={onExportComments}
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
      <MutationErrorMessage mutationState={mutationState} />
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
            mutationState={mutationState}
            emptyMessage={sectionModel.emptyMessage}
            onSelectComment={onSelectComment}
            onResolveComment={onResolveComment}
            onReopenComment={onReopenComment}
            onDeleteComment={onDeleteComment}
            onUpdateComment={onUpdateComment}
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
  onSearchQueryChange: (query: string) => void;
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
    : `${scopeCount} comments searchable`;

  return (
    <div className="comment-sidebar__search">
      <label className="comment-sidebar__search-label" htmlFor={inputId}>
        Search comments
      </label>
      <div className="comment-sidebar__search-field">
        <Search aria-hidden="true" size={15} />
        <input
          id={inputId}
          aria-label="Search comments"
          type="search"
          placeholder="Body, file, snippet, status"
          value={searchQuery}
          onInput={(event) => {
            onSearchQueryChange(event.currentTarget.value);
          }}
        />
        {searchQuery.length === 0 ? null : (
          <button
            className="icon-button comment-sidebar__search-clear"
            type="button"
            aria-label="Clear comment search"
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
  onFilterChange: (filter: CommentDisplayFilter) => void;
  onExportComments?: (scope: CommentExportScope) => void;
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
  onExportComments,
}: HeaderProps) {
  return (
    <header className="comment-sidebar__header">
      <div>
        <h2>Comments</h2>
        <p>Active file review notes</p>
      </div>
      <div className="comment-sidebar__summary" aria-label="Comment counts">
        <span className="comment-sidebar__count">
          Open<span>{openCount}</span>
        </span>
        <span className="comment-sidebar__count comment-sidebar__count--muted">
          Resolved<span>{resolvedCount}</span>
        </span>
      </div>
      {showFilters ? (
        <div className="comment-sidebar__filters" aria-label="Comment filters">
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
        </div>
      ) : null}
      {showExportControls && onExportComments !== undefined ? (
        <CommentExportControls
          exportState={exportState}
          onExportComments={onExportComments}
        />
      ) : null}
    </header>
  );
}

type CommentExportControlsProps = Readonly<{
  exportState: CommentExportState;
  onExportComments: (scope: CommentExportScope) => void;
}>;

const idleCommentExportState: CommentExportState = {
  status: "idle",
  operation: null,
  message: null,
};

const commentExportOptions: readonly Readonly<{
  scope: CommentExportScope;
  label: string;
  ariaLabel: string;
}>[] = [
  {
    scope: "file",
    label: "File",
    ariaLabel: "Export current file comments",
  },
  {
    scope: "spec",
    label: "Spec",
    ariaLabel: "Export current spec comments",
  },
  {
    scope: "workspace",
    label: "Workspace",
    ariaLabel: "Export workspace comments",
  },
];

/** @returns Comment export command buttons for the selected review scope. */
function CommentExportControls({
  exportState,
  onExportComments,
}: CommentExportControlsProps) {
  return (
    <div className="comment-sidebar__exports" aria-label="Comment exports">
      {commentExportOptions.map((option) => {
        const isSaving =
          exportState.status === "saving" &&
          exportState.operation === option.scope;

        return (
          <button
            key={option.scope}
            className="comment-sidebar__export"
            type="button"
            aria-label={option.ariaLabel}
            disabled={exportState.status === "saving"}
            onClick={() => {
              onExportComments(option.scope);
            }}
          >
            <Download aria-hidden="true" size={14} />
            <span>{isSaving ? "Saving" : option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

type CommentExportFeedbackProps = Readonly<{
  exportState: CommentExportState;
}>;

/** @returns A compact status message for the latest comment export attempt. */
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

type MutationErrorMessageProps = Readonly<{
  mutationState: CommentMutationState;
}>;

/** @returns A compact mutation error, or null when the latest mutation succeeded. */
function MutationErrorMessage({ mutationState }: MutationErrorMessageProps) {
  if (mutationState.status !== "error") {
    return null;
  }

  return (
    <p className="comment-sidebar__mutation-error" role="alert">
      {mutationState.error.message}
    </p>
  );
}

type SectionProps = Readonly<{
  id: string;
  title: string;
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  anchorDisplayStatusByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >;
  searchQuery: string;
  mutationState: CommentMutationState;
  emptyMessage: string;
  onSelectComment: (commentId: CommentId) => void;
  onResolveComment: (commentId: CommentId) => void;
  onReopenComment: (commentId: CommentId) => void;
  onDeleteComment: (commentId: CommentId) => void;
  onUpdateComment: (commentId: CommentId, body: string) => void;
}>;

/** @returns One grouped comment section with its count badge. */
function CommentSection({
  id,
  title,
  comments,
  activeCommentId,
  anchorDisplayStatusByCommentId,
  searchQuery,
  mutationState,
  emptyMessage,
  onSelectComment,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
  onUpdateComment,
}: SectionProps) {
  return (
    <section className="comment-sidebar__section" aria-labelledby={id}>
      <div className="comment-sidebar__section-header">
        <h3 id={id}>{title}</h3>
        <span aria-label={`${title} comment count`}>{comments.length}</span>
      </div>
      {comments.length === 0 ? (
        <p className="comment-sidebar__section-empty">{emptyMessage}</p>
      ) : (
        <ul className="comment-sidebar__list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <CommentThread
                comment={comment}
                isActive={comment.id === activeCommentId}
                anchorDisplayStatus={
                  anchorDisplayStatusByCommentId.get(comment.id) ?? "exact"
                }
                searchQuery={searchQuery}
                mutationState={mutationState}
                onSelectComment={onSelectComment}
                onResolveComment={onResolveComment}
                onReopenComment={onReopenComment}
                onDeleteComment={onDeleteComment}
                onUpdateComment={onUpdateComment}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
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
        No comments match &quot;{searchQuery}&quot; in the{" "}
        {formatFilterLabel(activeFilter)} filter.
      </p>
    );
  }

  return (
    <p className="comment-sidebar__filtered-empty">
      No comments match the {formatFilterLabel(activeFilter)} filter.
    </p>
  );
}

/** @returns Comments whose searchable fields include the normalized query. */
function filterCommentsBySearchQuery({
  comments,
  searchQuery,
  anchorDisplayStatusByCommentId,
}: CommentSearchFilterParams): readonly Comment[] {
  if (searchQuery.length === 0) {
    return comments;
  }

  return comments.filter((comment) =>
    commentMatchesSearchQuery(
      comment,
      searchQuery,
      anchorDisplayStatusByCommentId.get(comment.id) ?? "exact",
    ),
  );
}

/** @returns True when a comment contains the normalized query in a visible search field. */
function commentMatchesSearchQuery(
  comment: Comment,
  searchQuery: string,
  anchorDisplayStatus: CommentAnchorDisplayStatus,
): boolean {
  return createCommentSearchFields(comment, anchorDisplayStatus).some((field) =>
    normalizeCommentSearchQuery(field).includes(searchQuery),
  );
}

/** @returns Text fields covered by local comment search. */
function createCommentSearchFields(
  comment: Comment,
  anchorDisplayStatus: CommentAnchorDisplayStatus,
): readonly string[] {
  const anchorStatusLabel = formatAnchorDisplayStatus(anchorDisplayStatus);

  return [
    comment.body,
    comment.anchor.fileKey,
    comment.anchor.textSnippet,
    comment.resolved ? "Resolved" : "Open",
    anchorStatusLabel ?? "",
  ];
}

/** @returns The visible anchor reconciliation status, or null for exact anchors. */
function formatAnchorDisplayStatus(
  status: CommentAnchorDisplayStatus,
): string | null {
  if (status === "exact") {
    return null;
  }

  const statusLabels: Record<
    Exclude<CommentAnchorDisplayStatus, "exact">,
    string
  > = {
    moved: "Anchor moved",
    fuzzy: "Fuzzy anchor",
    orphaned: "Anchor orphaned",
    stale: "Anchor stale",
  };

  return statusLabels[status];
}

/** @returns A case-insensitive query with redundant whitespace collapsed. */
function normalizeCommentSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/** @returns A compact result count label for the search field. */
function formatSearchResultCount(resultCount: number): string {
  if (resultCount === 1) {
    return "1 result";
  }

  return `${resultCount} results`;
}

/** @returns Comments split by open and resolved display sections. */
function groupCommentsByStatus(comments: readonly Comment[]): CommentGroups {
  return {
    openComments: comments.filter((comment) => !comment.resolved),
    resolvedComments: comments.filter((comment) => comment.resolved),
  };
}

/** @returns A lookup of rendered anchor status by comment id. */
function createAnchorDisplayStatusByCommentId(
  states: readonly CommentAnchorDisplayState[],
): ReadonlyMap<CommentId, CommentAnchorDisplayStatus> {
  return new Map(
    states.map((state) => [state.commentId, state.status] as const),
  );
}

/** @returns An empty filter count record for non-ready sidebar states. */
function createEmptyFilterCounts(): CommentFilterCounts {
  return {
    all: 0,
    open: 0,
    resolved: 0,
    moved: 0,
    fuzzy: 0,
    stale: 0,
    orphaned: 0,
  };
}

/** @returns Count badges for each available comment filter. */
function createCommentFilterCounts(
  comments: readonly Comment[],
  anchorDisplayStatusByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >,
): CommentFilterCounts {
  return comments.reduce<CommentFilterCounts>((counts, comment) => {
    const anchorStatus =
      anchorDisplayStatusByCommentId.get(comment.id) ?? "exact";

    return {
      ...counts,
      all: counts.all + 1,
      open: comment.resolved ? counts.open : counts.open + 1,
      resolved: comment.resolved ? counts.resolved + 1 : counts.resolved,
      moved: anchorStatus === "moved" ? counts.moved + 1 : counts.moved,
      fuzzy: anchorStatus === "fuzzy" ? counts.fuzzy + 1 : counts.fuzzy,
      stale: anchorStatus === "stale" ? counts.stale + 1 : counts.stale,
      orphaned:
        anchorStatus === "orphaned" ? counts.orphaned + 1 : counts.orphaned,
    };
  }, createEmptyFilterCounts());
}

/** @returns Comments visible for the selected display filter. */
function filterCommentsByDisplayFilter(
  comments: readonly Comment[],
  activeFilter: CommentDisplayFilter,
  anchorDisplayStatusByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >,
): readonly Comment[] {
  if (activeFilter === "all") {
    return comments;
  }

  if (activeFilter === "open") {
    return comments.filter((comment) => !comment.resolved);
  }

  if (activeFilter === "resolved") {
    return comments.filter((comment) => comment.resolved);
  }

  return comments.filter(
    (comment) =>
      (anchorDisplayStatusByCommentId.get(comment.id) ?? "exact") ===
      activeFilter,
  );
}

/** @returns Display sections for the filtered comment list. */
function createCommentSectionModels(
  activeFilter: CommentDisplayFilter,
  filteredComments: readonly Comment[],
): readonly CommentSectionModel[] {
  if (activeFilter === "all") {
    const groups = groupCommentsByStatus(filteredComments);

    return [
      {
        id: "comment-section-open",
        title: "Open",
        comments: groups.openComments,
        emptyMessage: "No open comments",
      },
      {
        id: "comment-section-resolved",
        title: "Resolved",
        comments: groups.resolvedComments,
        emptyMessage: "No resolved comments",
      },
    ];
  }

  return [
    {
      id: `comment-section-${activeFilter}`,
      title: formatSectionTitle(activeFilter),
      comments: filteredComments,
      emptyMessage: `No ${formatFilterLabel(activeFilter).toLowerCase()} comments`,
    },
  ];
}

/** @returns A readable label for the selected filter. */
function formatFilterLabel(filter: CommentDisplayFilter): string {
  const option = commentFilterOptions.find(
    (filterOption) => filterOption.filter === filter,
  );

  return option?.label ?? filter;
}

/** @returns Section title for a filtered comment list. */
function formatSectionTitle(filter: CommentDisplayFilter): string {
  if (filter === "open" || filter === "resolved") {
    return formatFilterLabel(filter);
  }

  return `${formatFilterLabel(filter)} Anchors`;
}
