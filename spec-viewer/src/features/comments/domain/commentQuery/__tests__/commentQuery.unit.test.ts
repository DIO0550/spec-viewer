import { expect, test } from "vitest";
import { Comment } from "@/features/comments/domain/comment";
import { CommentId } from "@/features/comments/domain/commentId";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import {
  createCommentFilterCounts,
  filterCommentsByDisplayFilter,
  filterCommentsBySearchQuery,
  groupCommentsByStatus,
  normalizeCommentSearchQuery,
} from "@/features/comments/domain/commentQuery";

const open = Comment.create({
  id: CommentId.fromString("open"),
  body: "Review   THE\nbehavior",
  status: "open",
  anchor: {
    fileKey: "requirements",
    blockType: "paragraph",
    blockIndex: 0,
    textHash: "hash",
    textSnippet: "An anchor snippet",
    charRange: { start: 0, end: 3 },
  },
  createdAt: "2026-10-04T00:00:00Z",
  updatedAt: "2026-10-04T00:00:00Z",
});
const resolved = Comment.resolve({
  ...open,
  id: CommentId.fromString("resolved"),
  body: "Done",
});

const search = (
  searchQuery: string,
  additionalSearchFieldsByCommentId?: ReadonlyMap<
    ReturnType<typeof CommentId.fromString>,
    readonly string[]
  >,
) =>
  filterCommentsBySearchQuery({
    comments: [open, resolved],
    searchQuery,
    additionalSearchFieldsByCommentId,
  });

test.each([
  "",
  " \n\t ",
])("normalizes an empty comment query %j and returns all comments", (query) => {
  expect(normalizeCommentSearchQuery(query)).toBe("");
  expect(search(query)).toEqual([open, resolved]);
});
test.each([
  ["  REVIEW\t the\nBEHAVIOR ", [open]],
  ["REQUIREMENTS", [open, resolved]],
  ["anchor  snippet", [open, resolved]],
  ["missing", []],
  ["behavior requirements", []],
])("matches independent comment text fields for query %j", (query, expected) => {
  expect(search(query as string)).toEqual(expected);
});
test("matches supplied localized comment fields without requiring a label or matching another comment's fields", () => {
  const fields = new Map([[open.id, ["未解決", "位置不明"]]]);
  expect(search("位置不明", fields)).toEqual([open]);
  expect(search("未解決", fields)).toEqual([open]);
  expect(search("Done", fields)).toEqual([resolved]);
});
test("preserves comment array identity when no query or status filter is applied", () => {
  const comments = Object.freeze([resolved, open]);
  expect(filterCommentsBySearchQuery({ comments, searchQuery: " \n " })).toBe(
    comments,
  );
  expect(filterCommentsByDisplayFilter(comments, "all")).toBe(comments);
});
test.each([
  [],
  [open],
  [resolved],
  [resolved, open, open],
])("comment counts, filters and groups share the aggregate status predicate for %j", (...items) => {
  const comments = Object.freeze(items as Comment[]);
  const counts = createCommentFilterCounts(comments);
  for (const filter of CommentStatusFilter.values) {
    const expected = comments.filter((comment) =>
      Comment.shouldDisplay(comment, filter),
    );
    expect(filterCommentsByDisplayFilter(comments, filter)).toEqual(expected);
    expect(counts[filter]).toBe(expected.length);
  }
  const groups = groupCommentsByStatus(comments);
  expect(groups.openComments).toEqual(
    filterCommentsByDisplayFilter(comments, "open"),
  );
  expect(groups.resolvedComments).toEqual(
    filterCommentsByDisplayFilter(comments, "resolved"),
  );
  expect(counts.open + counts.resolved).toBe(counts.all);
});
