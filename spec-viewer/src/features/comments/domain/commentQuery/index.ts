import { Comment } from "@/features/comments/domain/comment";
import type { CommentId } from "@/features/comments/domain/commentId";
import type { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";

export type CommentFilterCounts = Readonly<Record<CommentStatusFilter, number>>;
export type CommentGroups = Readonly<{
  openComments: readonly Comment[];
  resolvedComments: readonly Comment[];
}>;

type CommentSearchFilterParams = Readonly<{
  comments: readonly Comment[];
  searchQuery: string;
  /** 表示用の検索別名でコメント固有のフィールドを補い、検索のルールをロケールに依存させない。 */
  additionalSearchFieldsByCommentId?: ReadonlyMap<CommentId, readonly string[]>;
}>;

/** @returns 連続する空白をまとめ、大文字と小文字を区別しないように正規化した検索クエリ。 */
export function normalizeCommentSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/** @returns コメント固有のフィールドまたは指定された検索別名に一致するコメント。元の順序を維持する。 */
export function filterCommentsBySearchQuery({
  comments,
  searchQuery,
  additionalSearchFieldsByCommentId,
}: CommentSearchFilterParams): readonly Comment[] {
  const query = normalizeCommentSearchQuery(searchQuery);
  if (query.length === 0) return comments;
  return comments.filter((comment) =>
    [
      comment.body,
      comment.anchor.fileKey,
      comment.anchor.textSnippet,
      ...(additionalSearchFieldsByCommentId?.get(comment.id) ?? []),
    ].some((field) => normalizeCommentSearchQuery(field).includes(query)),
  );
}

/** @returns 集約で共通の状態判定条件を満たすコメント。 */
export function filterCommentsByDisplayFilter(
  comments: readonly Comment[],
  filter: CommentStatusFilter,
): readonly Comment[] {
  return filter === "all"
    ? comments
    : comments.filter((comment) => Comment.shouldDisplay(comment, filter));
}

/** @returns 絞り込みと同じ判定条件で分類した未解決・解決済みのグループ。各グループ内の元の順序を維持する。 */
export function groupCommentsByStatus(
  comments: readonly Comment[],
): CommentGroups {
  return {
    openComments: filterCommentsByDisplayFilter(comments, "open"),
    resolvedComments: filterCommentsByDisplayFilter(comments, "resolved"),
  };
}

/** @returns 空のコレクションに対応する、すべての件数がゼロの集計結果。 */
export function createEmptyFilterCounts(): CommentFilterCounts {
  return { all: 0, open: 0, resolved: 0 };
}

/** @returns 絞り込み・グループ化と同じ集約の判定条件で求めた件数。 */
export function createCommentFilterCounts(
  comments: readonly Comment[],
): CommentFilterCounts {
  const groups = groupCommentsByStatus(comments);
  return {
    all: comments.length,
    open: groups.openComments.length,
    resolved: groups.resolvedComments.length,
  };
}
