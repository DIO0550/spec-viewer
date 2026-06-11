import type { ReactNode } from "react";
import { useState } from "react";

import { CommentSearchControl } from "@/features/comments/components/CommentSearchControl";
import { CommentSection } from "@/features/comments/components/CommentSection";
import { CommentSidebarHeader } from "@/features/comments/components/CommentSidebarHeader";
import { CommentDisplayFilter } from "@/features/comments/domain/commentDisplayFilter";
import {
  CommentExport,
  type CommentExportState,
} from "@/features/comments/domain/commentExport";
import type { CommentListState } from "@/features/comments/domain/commentListState";
import {
  CommentOperationFailedState,
  type CommentOperationState,
} from "@/features/comments/domain/commentOperation";
import { CommentSearch } from "@/features/comments/domain/commentSearch";
import type {
  Comment,
  CommentAnchorDisplayState,
  CommentDisplayFilter as CommentDisplayFilterType,
  CommentExportScope,
  CommentId,
} from "@/features/comments/types/comment";
import { uiText } from "@/shared/lib/uiText";
import { CommandErrorDisplay } from "@/shared/ui/CommandErrorDisplay";
import { EmptyState } from "@/shared/ui/EmptyState";
import { LoadingSkeleton } from "@/shared/ui/LoadingSkeleton";

export type { CommentExportState } from "@/features/comments/domain/commentExport";

const emptyComments: readonly Comment[] = [];

type Props = Readonly<{
  listState: CommentListState;
  operationState: CommentOperationState;
  exportState?: CommentExportState;
  activeCommentId: CommentId | null;
  anchorDisplayStates?: readonly CommentAnchorDisplayState[];
  /** @param commentId - Comment selected in the sidebar */
  onSelectComment: (commentId: CommentId) => void;
  /** @param commentId - Comment to resolve */
  onResolveComment: (commentId: CommentId) => void;
  /** @param commentId - Comment to reopen */
  onReopenComment: (commentId: CommentId) => void;
  /** @param commentId - Comment to delete */
  onDeleteComment: (commentId: CommentId) => void;
  /**
   * @param commentId - Comment being edited
   * @param body - Replacement body text
   */
  onUpdateComment: (commentId: CommentId, body: string) => void;
  /** Reloads comments for the current scope. */
  onReload: () => void;
  /** @param scope - Export scope selected from the menu */
  onExportComments?: (scope: CommentExportScope) => void;
  /** @param scope - Prompt scope selected from the menu */
  onCopyLlmPrompt?: (scope: CommentExportScope) => void;
  /** Copies the dry-run MCP feedback payload for the current file. */
  onCopyMcpFeedback?: () => void;
  userReviewPanel?: ReactNode;
}>;

/** @returns The right-side comment review surface for the active spec file. */
export function CommentSidebar({
  listState,
  operationState,
  exportState = CommentExport.idleState,
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
  userReviewPanel,
}: Props) {
  const [activeFilter, setActiveFilter] = useState<CommentDisplayFilterType>(
    CommentDisplayFilter.defaultFilter,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const isReady = listState.status === "ready";
  const canExportComments = isReady || listState.status === "empty";
  const loadedComments = isReady ? listState.comments : emptyComments;
  const groups = CommentDisplayFilter.groupByStatus(loadedComments);
  const anchorDisplayStatusByCommentId =
    CommentDisplayFilter.createAnchorDisplayStatusByCommentId(
      anchorDisplayStates,
    );
  const filterCounts = isReady
    ? CommentDisplayFilter.countComments(
        loadedComments,
        anchorDisplayStatusByCommentId,
      )
    : CommentDisplayFilter.emptyCounts();

  const renderShell = (children: ReactNode): ReactNode => (
    <section className="comment-sidebar" aria-label={uiText.sidebar.comments}>
      <CommentSidebarHeader
        openCount={groups.openComments.length}
        resolvedCount={groups.resolvedComments.length}
        activeFilter={activeFilter}
        filterCounts={filterCounts}
        showFilters={isReady}
        showExportControls={canExportComments}
        exportState={exportState}
        onFilterChange={setActiveFilter}
        onReload={onReload}
        onExportComments={onExportComments}
        onCopyLlmPrompt={onCopyLlmPrompt}
        onCopyMcpFeedback={onCopyMcpFeedback}
      />
      {children}
    </section>
  );

  if (listState.status === "idle") {
    return renderShell(
      <EmptyState
        title={uiText.sidebar.idleTitle}
        description={uiText.sidebar.idleDescription}
        variant="inline"
      />,
    );
  }

  if (listState.status === "loading") {
    return renderShell(
      <LoadingSkeleton
        className="comment-sidebar__loading"
        label={uiText.sidebar.loading}
        rows={[
          { width: "medium" },
          { width: "full" },
          { width: "long" },
          { width: "medium" },
        ]}
      />,
    );
  }

  if (listState.status === "error") {
    return renderShell(
      <CommandErrorDisplay
        title={uiText.sidebar.unavailable}
        error={listState.error}
        actionLabel={uiText.sidebar.retry}
        onAction={onReload}
      />,
    );
  }

  if (listState.status === "empty") {
    return renderShell(
      <>
        <CommentExportFeedback exportState={exportState} />
        {userReviewPanel}
        <EmptyState
          title={uiText.sidebar.empty}
          description={`${uiText.sidebar.emptyDescription} ${uiText.sidebar.addHint}`}
          variant="inline"
        />
      </>,
    );
  }

  const filteredComments = CommentDisplayFilter.filterComments(
    listState.comments,
    activeFilter,
    anchorDisplayStatusByCommentId,
  );
  const normalizedSearchQuery = CommentSearch.normalizeQuery(searchQuery);
  const searchedComments = CommentSearch.filterComments({
    comments: filteredComments,
    searchQuery: normalizedSearchQuery,
    anchorDisplayStatusByCommentId,
  });
  const sectionModels = CommentDisplayFilter.createSectionModels(
    activeFilter,
    searchedComments,
  );

  return renderShell(
    <>
      <CommentExportFeedback exportState={exportState} />
      {userReviewPanel}
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
            onSelectComment={onSelectComment}
            onResolveComment={onResolveComment}
            onReopenComment={onReopenComment}
            onDeleteComment={onDeleteComment}
            onUpdateComment={onUpdateComment}
          />
        ))
      )}
    </>,
  );
}

type CommentExportFeedbackProps = Readonly<{
  exportState: CommentExportState;
}>;

/**
 * @param props - Latest export state
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
 * @param props - Latest comment operation state
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
  activeFilter: CommentDisplayFilterType;
  searchQuery: string;
}>;

/**
 * @param props - Active filter and normalized search query
 * @returns A focused empty state when the selected filter has no matches.
 */
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
      {CommentDisplayFilter.formatLabel(activeFilter)}
      {uiText.sidebar.noFilterResults}
    </p>
  );
}
