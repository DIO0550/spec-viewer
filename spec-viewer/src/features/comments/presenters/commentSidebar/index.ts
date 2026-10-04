import { Comment } from "@/features/comments/domain/comment";
import type { CommentId } from "@/features/comments/domain/commentId";
import { groupCommentsByStatus } from "@/features/comments/domain/commentQuery";
import type {
  CommentAnchorDisplayState,
  CommentAnchorDisplayStatus,
  CommentDisplayFilter,
} from "@/features/comments/types/comment";
import { uiText } from "@/utils/uiText";

type CommentFilterOption = Readonly<{
  filter: CommentDisplayFilter;
  label: string;
  ariaLabel: string;
}>;

type CommentSectionModel = Readonly<{
  id: string;
  title: string;
  comments: readonly Comment[];
  emptyMessage: string;
}>;

export const commentFilterOptions: readonly CommentFilterOption[] = [
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
    filter: "all",
    label: uiText.sidebar.all,
    ariaLabel: "すべてのコメントを表示",
  },
];

/** @returns Localized search aliases for status and the existing rendered anchor projection. */
export function createCommentSearchAliases(
  comments: readonly Comment[],
  anchorDisplayStatusByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >,
): ReadonlyMap<CommentId, readonly string[]> {
  return new Map(
    comments.map((comment) => [
      comment.id,
      [
        Comment.shouldDisplay(comment, "resolved")
          ? uiText.sidebar.resolved
          : uiText.sidebar.openFilter,
        formatAnchorDisplayStatus(
          anchorDisplayStatusByCommentId.get(comment.id) ?? "exact",
        ) ?? "",
      ],
    ]),
  );
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
    moved: uiText.commentThread.anchorMoved,
    fuzzy: uiText.commentThread.fuzzyAnchor,
    orphaned: uiText.commentThread.anchorOrphaned,
    stale: uiText.commentThread.anchorStale,
  };

  return statusLabels[status];
}

/** @returns A lookup of rendered anchor status by comment id. */
export function createAnchorDisplayStatusByCommentId(
  states: readonly CommentAnchorDisplayState[],
): ReadonlyMap<CommentId, CommentAnchorDisplayStatus> {
  return new Map(
    states.map((state) => [state.commentId, state.status] as const),
  );
}

/** @returns Display sections for the filtered comment list. */
export function createCommentSectionModels(
  activeFilter: CommentDisplayFilter,
  filteredComments: readonly Comment[],
): readonly CommentSectionModel[] {
  if (activeFilter === "all") {
    const groups = groupCommentsByStatus(filteredComments);

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
      title: formatFilterLabel(activeFilter),
      comments: filteredComments,
      emptyMessage:
        activeFilter === "open"
          ? uiText.sidebar.noOpenComments
          : uiText.sidebar.noResolvedComments,
    },
  ];
}

/**
 * @param filter - The display filter to label.
 * @returns A readable label for the selected filter.
 */
export function formatFilterLabel(filter: CommentDisplayFilter): string {
  const option = commentFilterOptions.find(
    (filterOption) => filterOption.filter === filter,
  );

  return option?.label ?? filter;
}
