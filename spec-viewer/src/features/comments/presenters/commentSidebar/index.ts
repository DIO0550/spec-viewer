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

/** @returns コメントの状態と既存のアンカー表示状態に対応する、ローカライズされた検索別名。 */
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

/** @returns アンカーの照合状態を表す表示ラベル。完全一致するアンカーの場合は null。 */
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

/** @returns コメント ID をキーにしたアンカー表示状態の対応表。 */
export function createAnchorDisplayStatusByCommentId(
  states: readonly CommentAnchorDisplayState[],
): ReadonlyMap<CommentId, CommentAnchorDisplayStatus> {
  return new Map(
    states.map((state) => [state.commentId, state.status] as const),
  );
}

/** @returns 絞り込み済みのコメント一覧に対応する表示セクション。 */
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
 * @param filter - 表示ラベルを取得するフィルター。
 * @returns 選択されたフィルターの表示ラベル。
 */
export function formatFilterLabel(filter: CommentDisplayFilter): string {
  const option = commentFilterOptions.find(
    (filterOption) => filterOption.filter === filter,
  );

  return option?.label ?? filter;
}
