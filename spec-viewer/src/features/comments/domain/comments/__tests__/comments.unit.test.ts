import { expect, test } from "vitest";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";

import { Comments } from "@/features/comments/domain/comments";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";
import * as TestValues from "@/shared/testing/validatedValueObjects";

const openComment = createCommentTestFixture();
const secondOpenComment = createCommentTestFixture({
  id: "cmt_2",
  body: "Add acceptance criteria",
  createdAt: "2026-05-05T10:05:00Z",
  updatedAt: "2026-05-05T10:05:00Z",
});
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

test("Comments.replaceExistingDisplayableは既存コメントを同じ位置で置換する", () => {
  const updatedComment = createCommentTestFixture({
    body: "Updated body",
    updatedAt: "2026-05-05T10:15:00Z",
  });

  expect(
    Comments.replaceExistingDisplayable(
      [openComment, secondOpenComment],
      updatedComment,
      {
        commentId: openComment.id,
        revision: { kind: "update", body: updatedComment.body },
      },
      CommentStatusFilter.All,
    ),
  ).toEqual({
    ok: true,
    value: {
      comments: [updatedComment, secondOpenComment],
      comment: updatedComment,
    },
  });
});

test("Comments.replaceExistingDisplayableはfilter対象外になった既存コメントを削除する", () => {
  const resolvedComment = createCommentTestFixture({
    status: "resolved",
    updatedAt: "2026-05-05T10:15:00Z",
  });

  expect(
    Comments.replaceExistingDisplayable(
      [openComment, secondOpenComment],
      resolvedComment,
      {
        commentId: openComment.id,
        revision: { kind: "resolve" },
      },
      CommentStatusFilter.Open,
    ),
  ).toEqual({
    ok: true,
    value: {
      comments: [secondOpenComment],
      comment: resolvedComment,
    },
  });
});

test("Comments.replaceExistingDisplayableはresponseのanchorResolutionがnullなら既存値を維持する", () => {
  const currentComment = createCommentTestFixture({
    anchorResolution: movedAnchorResolution,
  });
  const nextComment = createCommentTestFixture({
    body: "Updated body",
    updatedAt: "2026-05-05T10:15:00Z",
  });

  expect(
    Comments.replaceExistingDisplayable(
      [currentComment],
      nextComment,
      {
        commentId: currentComment.id,
        revision: { kind: "update", body: nextComment.body },
      },
      CommentStatusFilter.All,
    ),
  ).toEqual({
    ok: true,
    value: {
      comments: [{ ...nextComment, anchorResolution: movedAnchorResolution }],
      comment: { ...nextComment, anchorResolution: movedAnchorResolution },
    },
  });
});

test("Comments.upsertOptimisticToggleはaggregate APIでstatusを反転する", () => {
  expect(
    Comments.upsertOptimisticToggle(
      [openComment],
      openComment.id,
      CommentStatusFilter.All,
    ),
  ).toEqual([{ ...openComment, status: "resolved" }]);
});

test("Comments.upsertOptimisticToggleはfilter適用後に非表示のコメントを除外する", () => {
  expect(
    Comments.upsertOptimisticToggle(
      [openComment, secondOpenComment],
      openComment.id,
      CommentStatusFilter.Open,
    ),
  ).toEqual([secondOpenComment]);
});

test("Comments.upsertOptimisticToggleは対象idがない場合に元配列を返す", () => {
  const comments = [openComment] as const;

  expect(
    Comments.upsertOptimisticToggle(
      comments,
      TestValues.commentId("cmt_missing"),
      CommentStatusFilter.All,
    ),
  ).toBe(comments);
});
