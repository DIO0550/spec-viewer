import type {
  Comment,
  CommentAnchorDisplayState,
  CommentAnchorDisplayStatus,
  CommentDisplayFilter as CommentDisplayFilterType,
  CommentId,
} from "@/features/comments/types/comment";
import { uiText } from "@/shared/lib/uiText";

export type CommentDisplayFilter = CommentDisplayFilterType;

export type CommentFilterOption = Readonly<{
  filter: CommentDisplayFilterType;
  label: string;
  ariaLabel: string;
}>;

export type CommentFilterCounts = Readonly<
  Record<CommentDisplayFilterType, number>
>;

export type CommentGroups = Readonly<{
  openComments: readonly Comment[];
  resolvedComments: readonly Comment[];
}>;

export type CommentSectionModel = Readonly<{
  id: string;
  title: string;
  comments: readonly Comment[];
  emptyMessage: string;
}>;

const defaultAnchorDisplayStatus: CommentAnchorDisplayStatus = "exact";

const commentFilterOptions: readonly CommentFilterOption[] = [
  {
    filter: "all",
    label: uiText.sidebar.all,
    ariaLabel: "すべてのコメントを表示",
  },
  {
    filter: "open",
    label: uiText.sidebar.openFilter,
    ariaLabel: "未解決コメントを表示",
  },
  {
    filter: "resolved",
    label: uiText.sidebar.resolved,
    ariaLabel: "解決済みコメントを表示",
  },
  {
    filter: "moved",
    label: uiText.sidebar.moved,
    ariaLabel: "移動したアンカーのコメントを表示",
  },
  {
    filter: "fuzzy",
    label: uiText.sidebar.fuzzy,
    ariaLabel: "曖昧なアンカーのコメントを表示",
  },
  {
    filter: "stale",
    label: uiText.sidebar.stale,
    ariaLabel: "古いアンカーのコメントを表示",
  },
  {
    filter: "orphaned",
    label: uiText.sidebar.orphaned,
    ariaLabel: "位置不明アンカーのコメントを表示",
  },
];

export const CommentDisplayFilter = {
  /** The display filter selected when the sidebar opens. */
  defaultFilter: "all" as CommentDisplayFilterType,
  /** Button options for every available comment display filter. */
  options: commentFilterOptions,
  /** @returns A lookup of rendered anchor status by comment id. */
  createAnchorDisplayStatusByCommentId(
    states: readonly CommentAnchorDisplayState[],
  ): ReadonlyMap<CommentId, CommentAnchorDisplayStatus> {
    return new Map(
      states.map((state) => [state.commentId, state.status] as const),
    );
  },
  /** @returns Comments split by open and resolved display sections. */
  groupByStatus(comments: readonly Comment[]): CommentGroups {
    return {
      openComments: comments.filter((comment) => !comment.resolved),
      resolvedComments: comments.filter((comment) => comment.resolved),
    };
  },
  /** @returns An empty filter count record for non-ready sidebar states. */
  emptyCounts(): CommentFilterCounts {
    return {
      all: 0,
      open: 0,
      resolved: 0,
      moved: 0,
      fuzzy: 0,
      stale: 0,
      orphaned: 0,
    };
  },
  /**
   * @param comments - Loaded comments
   * @param anchorDisplayStatusByCommentId - Rendered anchor status lookup
   * @returns Count badges for each available comment filter.
   */
  countComments(
    comments: readonly Comment[],
    anchorDisplayStatusByCommentId: ReadonlyMap<
      CommentId,
      CommentAnchorDisplayStatus
    >,
  ): CommentFilterCounts {
    return comments.reduce<CommentFilterCounts>((counts, comment) => {
      const anchorStatus =
        anchorDisplayStatusByCommentId.get(comment.id) ??
        defaultAnchorDisplayStatus;

      return {
        all: counts.all + 1,
        open: comment.resolved ? counts.open : counts.open + 1,
        resolved: comment.resolved ? counts.resolved + 1 : counts.resolved,
        moved: anchorStatus === "moved" ? counts.moved + 1 : counts.moved,
        fuzzy: anchorStatus === "fuzzy" ? counts.fuzzy + 1 : counts.fuzzy,
        stale: anchorStatus === "stale" ? counts.stale + 1 : counts.stale,
        orphaned:
          anchorStatus === "orphaned" ? counts.orphaned + 1 : counts.orphaned,
      };
    }, CommentDisplayFilter.emptyCounts());
  },
  /**
   * @param comments - Loaded comments
   * @param activeFilter - Selected display filter
   * @param anchorDisplayStatusByCommentId - Rendered anchor status lookup
   * @returns Comments visible for the selected display filter.
   */
  filterComments(
    comments: readonly Comment[],
    activeFilter: CommentDisplayFilterType,
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
        (anchorDisplayStatusByCommentId.get(comment.id) ??
          defaultAnchorDisplayStatus) === activeFilter,
    );
  },
  /** @returns A readable label for the selected filter. */
  formatLabel(filter: CommentDisplayFilterType): string {
    const option = commentFilterOptions.find(
      (filterOption) => filterOption.filter === filter,
    );

    return option?.label ?? filter;
  },
  /** @returns Section title for a filtered comment list. */
  formatSectionTitle(filter: CommentDisplayFilterType): string {
    if (filter === "open" || filter === "resolved") {
      return CommentDisplayFilter.formatLabel(filter);
    }

    return `${CommentDisplayFilter.formatLabel(filter)}${uiText.sidebar.anchorsSuffix}`;
  },
  /**
   * @param activeFilter - Selected display filter
   * @param filteredComments - Comments visible for the filter
   * @returns Display sections for the filtered comment list.
   */
  createSectionModels(
    activeFilter: CommentDisplayFilterType,
    filteredComments: readonly Comment[],
  ): readonly CommentSectionModel[] {
    if (activeFilter === "all") {
      const groups = CommentDisplayFilter.groupByStatus(filteredComments);

      return [
        {
          id: "comment-section-open",
          title: uiText.sidebar.openFilter,
          comments: groups.openComments,
          emptyMessage: uiText.sidebar.noOpenComments,
        },
        {
          id: "comment-section-resolved",
          title: uiText.sidebar.resolved,
          comments: groups.resolvedComments,
          emptyMessage: uiText.sidebar.noResolvedComments,
        },
      ];
    }

    return [
      {
        id: `comment-section-${activeFilter}`,
        title: CommentDisplayFilter.formatSectionTitle(activeFilter),
        comments: filteredComments,
        emptyMessage: `${CommentDisplayFilter.formatLabel(activeFilter)}${uiText.sidebar.noFilterResults}`,
      },
    ];
  },
} as const;
