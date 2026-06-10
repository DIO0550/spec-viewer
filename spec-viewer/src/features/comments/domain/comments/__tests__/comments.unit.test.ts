import { expect, expectTypeOf, test } from "vitest";

import type { Comment } from "@/features/comments/domain/comment";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import { Comments } from "@/features/comments/domain/comments";
import type { CommentAnchor } from "@/features/comments/types/comment";
import { CommentId } from "@/features/comments/types/comment";

const commentId = CommentId.fromString;

const anchor: CommentAnchor = {
  fileKey: "tasks",
  blockType: "paragraph",
  blockIndex: 0,
  textHash: "sha256:first",
  textSnippet: "Clarify this task",
  charRange: {
    start: 0,
    end: 18,
  },
};

const openComment: Comment = {
  id: commentId("cmt_1"),
  anchor,
  body: "Clarify this task",
  status: "open",
  resolved: false,
  createdAt: "2026-05-05T10:00:00Z",
  updatedAt: "2026-05-05T10:00:00Z",
};

const secondOpenComment: Comment = {
  ...openComment,
  id: commentId("cmt_2"),
  body: "Add acceptance criteria",
  createdAt: "2026-05-05T10:05:00Z",
  updatedAt: "2026-05-05T10:05:00Z",
};

const movedAnchorResolution = {
  status: "moved",
  reason: "moved_by_hash",
  details: "Moved to a nearby block.",
  target: {
    blockType: "paragraph",
    blockIndex: 1,
    textHash: "sha256:moved",
    textSnippet: "Clarify the updated task",
    sourceRange: {
      startByteOffset: 10,
      endByteOffset: 38,
    },
    score: 0.92,
  },
} as const;

test("Comments型はreadonly Comment配列として扱える", () => {
  expectTypeOf<Comments>().toMatchTypeOf<readonly Comment[]>();
});

test("Comments.createはreadonly配列互換のCommentsを作成する", () => {
  const comments = [openComment] as const;

  expect(Comments.toArray(Comments.create(comments))).toBe(comments);
});

test("Comments.appendDisplayableは表示対象コメントを末尾に追加する", () => {
  expect(
    Comments.appendDisplayable(
      [openComment],
      secondOpenComment,
      CommentStatusFilter.Open,
    ),
  ).toEqual([openComment, secondOpenComment]);
});

test("Comments.appendDisplayableはfilter対象外なら元配列を返す", () => {
  const comments = [openComment] as const;
  const resolvedComment: Comment = {
    ...secondOpenComment,
    status: "resolved",
    resolved: true,
  };

  expect(
    Comments.appendDisplayable(
      comments,
      resolvedComment,
      CommentStatusFilter.Open,
    ),
  ).toBe(comments);
});

test("Comments.appendDisplayableは重複idなら元配列を返す", () => {
  const comments = [openComment] as const;
  const updatedComment: Comment = {
    ...openComment,
    body: "Updated body",
  };

  expect(
    Comments.appendDisplayable(
      comments,
      updatedComment,
      CommentStatusFilter.All,
    ),
  ).toBe(comments);
});

test("Comments.upsertDisplayableは既存コメントを同じ位置で置換する", () => {
  const updatedComment: Comment = {
    ...openComment,
    body: "Updated body",
    updatedAt: "2026-05-05T10:15:00Z",
  };

  expect(
    Comments.upsertDisplayable(
      [openComment, secondOpenComment],
      updatedComment,
      CommentStatusFilter.All,
    ),
  ).toEqual([updatedComment, secondOpenComment]);
});

test("Comments.upsertDisplayableは新規表示対象コメントを末尾に追加する", () => {
  expect(
    Comments.upsertDisplayable(
      [openComment],
      secondOpenComment,
      CommentStatusFilter.Open,
    ),
  ).toEqual([openComment, secondOpenComment]);
});

test("Comments.upsertDisplayableはfilter対象外になった既存コメントを削除する", () => {
  const resolvedComment: Comment = {
    ...openComment,
    status: "resolved",
    resolved: true,
  };

  expect(
    Comments.upsertDisplayable(
      [openComment, secondOpenComment],
      resolvedComment,
      CommentStatusFilter.Open,
    ),
  ).toEqual([secondOpenComment]);
});

test("Comments.upsertDisplayableはfilter対象外かつ未存在のコメントでは元配列を返す", () => {
  const comments = [openComment] as const;
  const resolvedComment: Comment = {
    ...secondOpenComment,
    status: "resolved",
    resolved: true,
  };

  expect(
    Comments.upsertDisplayable(
      comments,
      resolvedComment,
      CommentStatusFilter.Open,
    ),
  ).toBe(comments);
});

test.each([
  [
    {
      ...openComment,
      body: "Updated body",
      updatedAt: "2026-05-05T10:15:00Z",
    },
  ],
  [
    {
      ...openComment,
      anchorResolution: null,
    },
  ],
] as const)("Comments.upsertDisplayableはresponseのanchorResolutionがない場合に既存値を維持する", (nextComment) => {
  const currentComment: Comment = {
    ...openComment,
    anchorResolution: movedAnchorResolution,
  };

  expect(
    Comments.upsertDisplayable(
      [currentComment],
      nextComment,
      CommentStatusFilter.All,
    ),
  ).toEqual([
    {
      ...nextComment,
      anchorResolution: movedAnchorResolution,
    },
  ]);
});

test("Comments.upsertOptimisticToggleは既存コメントのresolved stateを反転する", () => {
  expect(
    Comments.upsertOptimisticToggle(
      [openComment],
      openComment.id,
      CommentStatusFilter.All,
    ),
  ).toEqual([
    {
      ...openComment,
      status: "resolved",
      resolved: true,
    },
  ]);
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
      commentId("cmt_missing"),
      CommentStatusFilter.All,
    ),
  ).toBe(comments);
});
