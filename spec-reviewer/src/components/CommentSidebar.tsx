import { LoaderCircle } from "lucide-react";
import { useState } from "react";

import type {
  CommentListState,
  CommentMutationState,
} from "../hooks/useComments";
import type {
  Comment,
  CommentAnchorDisplayState,
  CommentAnchorDisplayStatus,
  CommentDisplayFilter,
  CommentId,
} from "../types/comment";
import { CommentThread } from "./CommentThread";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

type Props = Readonly<{
  listState: CommentListState;
  mutationState: CommentMutationState;
  activeCommentId: CommentId | null;
  anchorDisplayStates?: readonly CommentAnchorDisplayState[];
  onSelectComment: (commentId: CommentId) => void;
  onResolveComment: (commentId: CommentId) => void;
  onReopenComment: (commentId: CommentId) => void;
  onDeleteComment: (commentId: CommentId) => void;
  onUpdateComment: (commentId: CommentId, body: string) => void;
  onReload: () => void;
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
  activeCommentId,
  anchorDisplayStates = [],
  onSelectComment,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
  onUpdateComment,
  onReload,
}: Props) {
  const [activeFilter, setActiveFilter] =
    useState<CommentDisplayFilter>(defaultDisplayFilter);

  if (listState.status === "idle") {
    return (
      <section className="comment-sidebar" aria-label="Comments">
        <CommentSidebarHeader
          openCount={0}
          resolvedCount={0}
          activeFilter={activeFilter}
          filterCounts={createEmptyFilterCounts()}
          showFilters={false}
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
          onFilterChange={setActiveFilter}
        />
        <div className="comment-sidebar__loading" role="status">
          <LoaderCircle aria-hidden="true" size={18} />
          <span>Loading comments</span>
        </div>
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
          onFilterChange={setActiveFilter}
        />
        <ErrorState
          title="Comments unavailable"
          message={listState.error.message}
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
          onFilterChange={setActiveFilter}
        />
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
  const sectionModels = createCommentSectionModels(
    activeFilter,
    filteredComments,
  );

  return (
    <section className="comment-sidebar" aria-label="Comments">
      <CommentSidebarHeader
        openCount={groups.openComments.length}
        resolvedCount={groups.resolvedComments.length}
        activeFilter={activeFilter}
        filterCounts={filterCounts}
        showFilters={true}
        onFilterChange={setActiveFilter}
      />
      <MutationErrorMessage mutationState={mutationState} />
      {filteredComments.length === 0 ? (
        <FilteredEmptyState activeFilter={activeFilter} />
      ) : (
        sectionModels.map((sectionModel) => (
          <CommentSection
            key={sectionModel.id}
            id={sectionModel.id}
            title={sectionModel.title}
            comments={sectionModel.comments}
            activeCommentId={activeCommentId}
            anchorDisplayStatusByCommentId={anchorDisplayStatusByCommentId}
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

type HeaderProps = Readonly<{
  openCount: number;
  resolvedCount: number;
  activeFilter: CommentDisplayFilter;
  filterCounts: CommentFilterCounts;
  showFilters: boolean;
  onFilterChange: (filter: CommentDisplayFilter) => void;
}>;

/** @returns Sidebar title and total count badges. */
function CommentSidebarHeader({
  openCount,
  resolvedCount,
  activeFilter,
  filterCounts,
  showFilters,
  onFilterChange,
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
    </header>
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
}>;

/** @returns A focused empty state when the selected filter has no matches. */
function FilteredEmptyState({ activeFilter }: FilteredEmptyStateProps) {
  return (
    <p className="comment-sidebar__filtered-empty">
      No comments match the {formatFilterLabel(activeFilter)} filter.
    </p>
  );
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
