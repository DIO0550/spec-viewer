import { expect, expectTypeOf, test } from "vitest";

import { Comment } from "@/features/comments/domain/comment";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import type {
  Comment as CompatComment,
  CommentAnchor,
} from "@/features/comments/types/comment";
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

const fuzzyAnchorResolution = {
  ...movedAnchorResolution,
  status: "fuzzy",
  reason: "fuzzy_match",
  details: "Matched by fuzzy similarity.",
  target: {
    ...movedAnchorResolution.target,
    score: 0.72,
  },
} as const;

test("domain Commentと互換exportのCommentは同じ型として扱える", () => {
  expectTypeOf<Comment>().toEqualTypeOf<CompatComment>();
});

test("Comment.createは既存のコメントshapeを維持する", () => {
  expect(Comment.create(openComment)).toEqual(openComment);
});

test("Comment.updateBodyはbodyのみ更新する", () => {
  expect(Comment.updateBody(openComment, "Updated body")).toEqual({
    ...openComment,
    body: "Updated body",
  });
});

test("Comment.resolveはstatusとresolvedを解決済みへ同期する", () => {
  expect(Comment.resolve(openComment)).toEqual({
    ...openComment,
    status: "resolved",
    resolved: true,
  });
});

test("Comment.reopenはstatusとresolvedを未解決へ同期する", () => {
  const resolvedComment: Comment = {
    ...openComment,
    status: "resolved",
    resolved: true,
  };

  expect(Comment.reopen(resolvedComment)).toEqual(openComment);
});

test.each([
  [
    openComment,
    {
      ...openComment,
      status: "resolved",
      resolved: true,
    },
  ],
  [
    {
      ...openComment,
      status: "resolved",
      resolved: true,
    },
    openComment,
  ],
] as const)("Comment.toggleResolvedはstatusとresolvedを同期して反転する", (comment, expectedComment) => {
  expect(Comment.toggleResolved(comment)).toEqual(expectedComment);
});

test("Comment.preserveAnchorResolutionはnextにresolutionがある場合nextを優先する", () => {
  const currentComment: Comment = {
    ...openComment,
    anchorResolution: movedAnchorResolution,
  };
  const nextComment: Comment = {
    ...openComment,
    anchorResolution: fuzzyAnchorResolution,
  };

  expect(Comment.preserveAnchorResolution(currentComment, nextComment)).toEqual(
    nextComment,
  );
});

test.each([
  [{ ...openComment }, movedAnchorResolution],
  [{ ...openComment, anchorResolution: null }, movedAnchorResolution],
] as const)("Comment.preserveAnchorResolutionはnextのresolutionがない場合currentの値を維持する", (nextComment, expectedAnchorResolution) => {
  const currentComment: Comment = {
    ...openComment,
    anchorResolution: expectedAnchorResolution,
  };

  expect(Comment.preserveAnchorResolution(currentComment, nextComment)).toEqual(
    {
      ...nextComment,
      anchorResolution: expectedAnchorResolution,
    },
  );
});

test.each([
  [openComment, CommentStatusFilter.All, true],
  [openComment, CommentStatusFilter.Open, true],
  [openComment, CommentStatusFilter.Resolved, false],
  [
    { ...openComment, status: "resolved", resolved: true },
    CommentStatusFilter.Open,
    false,
  ],
] as const)("Comment.shouldDisplayはstatus filterに一致するコメントのみtrueにする", (comment, statusFilter, expectedResult) => {
  expect(Comment.shouldDisplay(comment, statusFilter)).toBe(expectedResult);
});

test("Comment.appendDisplayableは表示対象コメントを末尾に追加する", () => {
  expect(
    Comment.appendDisplayable(
      [openComment],
      secondOpenComment,
      CommentStatusFilter.Open,
    ),
  ).toEqual([openComment, secondOpenComment]);
});

test("Comment.appendDisplayableはfilter対象外なら元配列を返す", () => {
  const comments = [openComment] as const;
  const resolvedComment: Comment = {
    ...secondOpenComment,
    status: "resolved",
    resolved: true,
  };

  expect(
    Comment.appendDisplayable(
      comments,
      resolvedComment,
      CommentStatusFilter.Open,
    ),
  ).toBe(comments);
});

test("Comment.appendDisplayableは重複idなら元配列を返す", () => {
  const comments = [openComment] as const;
  const updatedComment: Comment = {
    ...openComment,
    body: "Updated body",
  };

  expect(
    Comment.appendDisplayable(
      comments,
      updatedComment,
      CommentStatusFilter.All,
    ),
  ).toBe(comments);
});

test("Comment.upsertDisplayableは既存コメントを同じ位置で置換する", () => {
  const updatedComment: Comment = {
    ...openComment,
    body: "Updated body",
    updatedAt: "2026-05-05T10:15:00Z",
  };

  expect(
    Comment.upsertDisplayable(
      [openComment, secondOpenComment],
      updatedComment,
      CommentStatusFilter.All,
    ),
  ).toEqual([updatedComment, secondOpenComment]);
});

test("Comment.upsertDisplayableは新規表示対象コメントを末尾に追加する", () => {
  expect(
    Comment.upsertDisplayable(
      [openComment],
      secondOpenComment,
      CommentStatusFilter.Open,
    ),
  ).toEqual([openComment, secondOpenComment]);
});

test("Comment.upsertDisplayableはfilter対象外になった既存コメントを削除する", () => {
  const resolvedComment: Comment = {
    ...openComment,
    status: "resolved",
    resolved: true,
  };

  expect(
    Comment.upsertDisplayable(
      [openComment, secondOpenComment],
      resolvedComment,
      CommentStatusFilter.Open,
    ),
  ).toEqual([secondOpenComment]);
});

test("Comment.upsertDisplayableはfilter対象外かつ未存在のコメントを追加しない", () => {
  const comments = [openComment] as const;
  const resolvedComment: Comment = {
    ...secondOpenComment,
    status: "resolved",
    resolved: true,
  };

  expect(
    Comment.upsertDisplayable(
      comments,
      resolvedComment,
      CommentStatusFilter.Open,
    ),
  ).toEqual(comments);
});

test("Comment.upsertDisplayableはcommand resultで省略されたanchor resolutionを維持する", () => {
  const currentComment: Comment = {
    ...openComment,
    anchorResolution: movedAnchorResolution,
  };
  const nextComment: Comment = {
    ...openComment,
    body: "Updated body",
    updatedAt: "2026-05-05T10:15:00Z",
  };

  expect(
    Comment.upsertDisplayable(
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

test("Comment.upsertDisplayableはanchor resolutionがnullでも既存仕様として維持する", () => {
  const currentComment: Comment = {
    ...openComment,
    anchorResolution: movedAnchorResolution,
  };
  const nextComment: Comment = {
    ...openComment,
    anchorResolution: null,
  };

  expect(
    Comment.upsertDisplayable(
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

test("Comment.upsertOptimisticToggleは既存コメントのresolved stateを反転する", () => {
  expect(
    Comment.upsertOptimisticToggle(
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

test("Comment.upsertOptimisticToggleはfilter適用後に非表示のコメントを除外する", () => {
  expect(
    Comment.upsertOptimisticToggle(
      [openComment, secondOpenComment],
      openComment.id,
      CommentStatusFilter.Open,
    ),
  ).toEqual([secondOpenComment]);
});

test("Comment.upsertOptimisticToggleは対象idがない場合に元配列を返す", () => {
  const comments = [openComment] as const;

  expect(
    Comment.upsertOptimisticToggle(
      comments,
      commentId("cmt_missing"),
      CommentStatusFilter.All,
    ),
  ).toBe(comments);
});
