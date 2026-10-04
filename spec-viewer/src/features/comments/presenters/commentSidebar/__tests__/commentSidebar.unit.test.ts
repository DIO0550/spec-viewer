import { expect, test } from "vitest";
import { Comment } from "@/features/comments/domain/comment";
import { CommentId } from "@/features/comments/domain/commentId";
import { filterCommentsBySearchQuery } from "@/features/comments/domain/commentQuery";
import type { CommentAnchorDisplayStatus } from "@/features/comments/types/comment";
import {
  createAnchorDisplayStatusByCommentId,
  createCommentSearchAliases,
  createCommentSectionModels,
} from "@/features/comments/presenters/commentSidebar";
import { uiText } from "@/utils/uiText";

const open = Comment.create({
  id: CommentId.fromString("open"),
  body: "Review",
  status: "open",
  anchor: {
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 0,
    textHash: "hash",
    textSnippet: "Text",
    charRange: { start: 0, end: 1 },
  },
  createdAt: "2026-10-04T00:00:00Z",
  updatedAt: "2026-10-04T00:00:00Z",
});
const resolved = Comment.resolve({
  ...open,
  id: CommentId.fromString("resolved"),
});

const anchorCases: readonly (readonly [CommentAnchorDisplayStatus, string])[] =
  [
    ["exact", ""],
    ["moved", uiText.commentThread.anchorMoved],
    ["fuzzy", uiText.commentThread.fuzzyAnchor],
    ["orphaned", uiText.commentThread.anchorOrphaned],
    ["stale", uiText.commentThread.anchorStale],
  ];
test.each(
  anchorCases,
)("supplies the localized %s projection label to pure search", (status, label) => {
  const statuses = createAnchorDisplayStatusByCommentId([
    { commentId: open.id, status },
  ]);
  const aliases = createCommentSearchAliases([open, resolved], statuses);
  expect(aliases.get(open.id)).toEqual([uiText.sidebar.openFilter, label]);
  expect(aliases.get(resolved.id)).toEqual([uiText.sidebar.resolved, ""]);
  if (label) {
    expect(
      filterCommentsBySearchQuery({
        comments: [open, resolved],
        searchQuery: label,
        additionalSearchFieldsByCommentId: aliases,
      }),
    ).toEqual([open]);
  }
});

test("uses supplied projection status rather than recalculating from backend resolution", () => {
  const orphaned = {
    ...open,
    anchorResolution: {
      status: "orphaned" as const,
      reason: "deleted_text" as const,
      details: null,
      target: null,
    },
  };
  expect(
    createCommentSearchAliases([orphaned], new Map()).get(open.id),
  ).toEqual([uiText.sidebar.openFilter, ""]);
  const statuses = createAnchorDisplayStatusByCommentId([
    { commentId: open.id, status: "orphaned" },
    { commentId: open.id, status: "moved" },
  ]);
  expect(createCommentSearchAliases([orphaned], statuses).get(open.id)).toEqual(
    [uiText.sidebar.openFilter, uiText.commentThread.anchorMoved],
  );
});

test("builds ordered localized sections including empty groups", () => {
  expect(createCommentSectionModels("all", [resolved, open])).toEqual([
    {
      id: "comment-section-open",
      title: uiText.sidebar.openFilter,
      comments: [open],
      emptyMessage: uiText.sidebar.noOpenComments,
    },
    {
      id: "comment-section-resolved",
      title: uiText.sidebar.resolved,
      comments: [resolved],
      emptyMessage: uiText.sidebar.noResolvedComments,
    },
  ]);
  expect(
    createCommentSectionModels("all", []).map((section) => section.comments),
  ).toEqual([[], []]);
});

test.each([
  "open",
  "resolved",
] as const)("builds a single %s section from the already-filtered result", (filter) => {
  const comments = filter === "open" ? [open] : [resolved];
  const [section] = createCommentSectionModels(filter, comments);
  expect(createCommentSectionModels(filter, comments)).toHaveLength(1);
  expect(section.id).toBe(`comment-section-${filter}`);
  expect(section.comments).toBe(comments);
  expect(section.title).toBe(
    filter === "open" ? uiText.sidebar.openFilter : uiText.sidebar.resolved,
  );
  expect(section.emptyMessage).toBe(
    filter === "open"
      ? uiText.sidebar.noOpenComments
      : uiText.sidebar.noResolvedComments,
  );
});
