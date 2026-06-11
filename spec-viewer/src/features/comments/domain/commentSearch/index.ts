import { CommentThreadFormat } from "@/features/comments/domain/commentThreadFormat";
import type {
  Comment,
  CommentAnchorDisplayStatus,
  CommentId,
} from "@/features/comments/types/comment";
import { uiText } from "@/shared/lib/uiText";

type CommentSearchFilterInput = Readonly<{
  comments: readonly Comment[];
  searchQuery: string;
  anchorDisplayStatusByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >;
}>;

const defaultAnchorDisplayStatus: CommentAnchorDisplayStatus = "exact";

/** @returns Text fields covered by local comment search. */
function createCommentSearchFields(
  comment: Comment,
  anchorDisplayStatus: CommentAnchorDisplayStatus,
): readonly string[] {
  const anchorStatusLabel =
    CommentThreadFormat.anchorDisplayStatusLabel(anchorDisplayStatus);

  return [
    comment.body,
    comment.anchor.fileKey,
    comment.anchor.textSnippet,
    comment.resolved ? uiText.sidebar.resolved : uiText.sidebar.openFilter,
    anchorStatusLabel ?? "",
  ];
}

export const CommentSearch = {
  /**
   * @param query - Raw search input typed by the user
   * @returns A case-insensitive query with redundant whitespace collapsed.
   */
  normalizeQuery(query: string): string {
    return query.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  },
  /**
   * @param comment - Comment to evaluate
   * @param searchQuery - Normalized search query
   * @param anchorDisplayStatus - Rendered anchor status for the comment
   * @returns True when the comment contains the query in a visible search field.
   */
  matches(
    comment: Comment,
    searchQuery: string,
    anchorDisplayStatus: CommentAnchorDisplayStatus,
  ): boolean {
    return createCommentSearchFields(comment, anchorDisplayStatus).some(
      (field) => CommentSearch.normalizeQuery(field).includes(searchQuery),
    );
  },
  /**
   * @param input - Comments, normalized query, and anchor status lookup
   * @returns Comments whose searchable fields include the normalized query.
   */
  filterComments({
    comments,
    searchQuery,
    anchorDisplayStatusByCommentId,
  }: CommentSearchFilterInput): readonly Comment[] {
    if (searchQuery.length === 0) {
      return comments;
    }

    return comments.filter((comment) =>
      CommentSearch.matches(
        comment,
        searchQuery,
        anchorDisplayStatusByCommentId.get(comment.id) ??
          defaultAnchorDisplayStatus,
      ),
    );
  },
  /**
   * @param resultCount - Number of comments matching the query
   * @returns A compact result count label for the search field.
   */
  formatResultCount(resultCount: number): string {
    return `${resultCount}件`;
  },
} as const;
