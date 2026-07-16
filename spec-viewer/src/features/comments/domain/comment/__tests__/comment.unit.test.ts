import { expect, expectTypeOf, test } from "vitest";

import {
  Comment,
  type Comment as CommentType,
} from "@/features/comments/domain/comment";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";
import type { Comment as CompatComment } from "@/features/comments/types/comment";

const movedAnchorResolution = {
  status: "moved",
  reason: "moved_by_hash",
  details: "Moved to a nearby block.",
  target: {
    blockType: "paragraph",
    blockIndex: 1,
    textHash: "sha256:b00b1e02",
    textSnippet: "Clarify the updated task",
    sourceRange: { startByteOffset: 10, endByteOffset: 38 },
    score: 0.92,
  },
} as const;

const fuzzyAnchorResolution = {
  ...movedAnchorResolution,
  status: "fuzzy",
  reason: "fuzzy_match",
  details: "Matched by fuzzy similarity.",
  target: { ...movedAnchorResolution.target, score: 0.72 },
} as const;

test("domain Commentと互換exportのCommentは同じ型として扱える", () => {
  expectTypeOf<CommentType>().toEqualTypeOf<CompatComment>();
});

test("Comment.preserveAnchorResolutionはnextにresolutionがある場合nextを優先する", () => {
  const currentComment = createCommentTestFixture({
    anchorResolution: movedAnchorResolution,
  });
  const nextComment = createCommentTestFixture({
    anchorResolution: fuzzyAnchorResolution,
  });

  expect(Comment.preserveAnchorResolution(currentComment, nextComment)).toBe(
    nextComment,
  );
});

test("Comment.preserveAnchorResolutionはnextがnullの場合currentの値を維持する", () => {
  const currentComment = createCommentTestFixture({
    anchorResolution: movedAnchorResolution,
  });
  const nextComment = createCommentTestFixture({ body: "Updated body" });

  expect(Comment.preserveAnchorResolution(currentComment, nextComment)).toEqual(
    {
      ...nextComment,
      anchorResolution: movedAnchorResolution,
    },
  );
});

test.each([
  [createCommentTestFixture(), CommentStatusFilter.All, true],
  [createCommentTestFixture(), CommentStatusFilter.Open, true],
  [createCommentTestFixture(), CommentStatusFilter.Resolved, false],
  [
    createCommentTestFixture({ status: "resolved" }),
    CommentStatusFilter.Open,
    false,
  ],
] as const)("Comment.matchesStatusFilterはstatus filterに一致するコメントのみtrueにする", (comment, statusFilter, expectedResult) => {
  expect(Comment.matchesStatusFilter(comment, statusFilter)).toBe(
    expectedResult,
  );
});
