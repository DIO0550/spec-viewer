import { expect, expectTypeOf, test } from "vitest";

import { Comment } from "@/features/comments/domain/comment";
import type { Comment as CommentType } from "@/features/comments/domain/comment";
import type {
  Comment as CompatComment,
  CommentAnchor,
} from "@/features/comments/types/comment";

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

const openComment: CommentType = {
  id: "cmt_1",
  anchor,
  body: "Clarify this task",
  status: "open",
  resolved: false,
  createdAt: "2026-05-05T10:00:00Z",
  updatedAt: "2026-05-05T10:00:00Z",
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
  expectTypeOf<CommentType>().toEqualTypeOf<CompatComment>();
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
  const resolvedComment: CommentType = {
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
] as const)(
  "Comment.toggleResolvedはstatusとresolvedを同期して反転する",
  (comment, expectedComment) => {
    expect(Comment.toggleResolved(comment)).toEqual(expectedComment);
  },
);

test("Comment.preserveAnchorResolutionはnextにresolutionがある場合nextを優先する", () => {
  const currentComment: CommentType = {
    ...openComment,
    anchorResolution: movedAnchorResolution,
  };
  const nextComment: CommentType = {
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
] as const)(
  "Comment.preserveAnchorResolutionはnextのresolutionがない場合currentの値を維持する",
  (nextComment, expectedAnchorResolution) => {
    const currentComment: CommentType = {
      ...openComment,
      anchorResolution: expectedAnchorResolution,
    };

    expect(
      Comment.preserveAnchorResolution(currentComment, nextComment),
    ).toEqual({
      ...nextComment,
      anchorResolution: expectedAnchorResolution,
    });
  },
);
