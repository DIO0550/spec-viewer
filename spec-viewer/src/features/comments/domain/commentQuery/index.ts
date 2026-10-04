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
  /** Presentation aliases supplement intrinsic fields without coupling query policy to a locale. */
  additionalSearchFieldsByCommentId?: ReadonlyMap<CommentId, readonly string[]>;
}>;

/** @returns A case-insensitive query with redundant whitespace collapsed. */
export function normalizeCommentSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/** @returns Comments matching any intrinsic field or supplied search alias, in original order. */
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

/** @returns Comments accepted by the aggregate's shared status predicate. */
export function filterCommentsByDisplayFilter(
  comments: readonly Comment[],
  filter: CommentStatusFilter,
): readonly Comment[] {
  return filter === "all"
    ? comments
    : comments.filter((comment) => Comment.shouldDisplay(comment, filter));
}

/** @returns Stable open and resolved groups using the same predicate as filtering. */
export function groupCommentsByStatus(
  comments: readonly Comment[],
): CommentGroups {
  return {
    openComments: filterCommentsByDisplayFilter(comments, "open"),
    resolvedComments: filterCommentsByDisplayFilter(comments, "resolved"),
  };
}

/** @returns Zero counts for an empty collection. */
export function createEmptyFilterCounts(): CommentFilterCounts {
  return { all: 0, open: 0, resolved: 0 };
}

/** @returns Counts using the same aggregate predicate as filtering and grouping. */
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
