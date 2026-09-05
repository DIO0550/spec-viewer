import { expect, expectTypeOf, test } from "vitest";

import {
  Comment,
  type IsoDateTimeString,
} from "@/features/comments/domain/comment";
import type {
  CommentAnchor,
  CommentAnchorResolution,
} from "@/features/comments/domain/commentAnchor";
import {
  CommentId,
  type CommentId as CommentIdType,
} from "@/features/comments/domain/commentId";

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

const anchorResolution: CommentAnchorResolution = {
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
};

const openComment: Comment = {
  id: CommentId.fromString("cmt_1"),
  anchor,
  body: "Clarify this task",
  status: "open",
  anchorResolution,
  createdAt: "2026-05-05T10:00:00Z",
  updatedAt: "2026-05-05T10:00:00Z",
};

test("Commentの値型はcanonical domain moduleだけで構成される", () => {
  expectTypeOf<Comment>().toEqualTypeOf<
    Readonly<{
      id: CommentIdType;
      anchor: CommentAnchor;
      body: string;
      status: "open" | "resolved";
      anchorResolution?: CommentAnchorResolution | null;
      createdAt: IsoDateTimeString;
      updatedAt: IsoDateTimeString;
    }>
  >();
});

test("Comment.resolveはstatusだけを変更してanchorResolutionを維持する", () => {
  expect(Comment.resolve(openComment)).toEqual({
    ...openComment,
    status: "resolved",
  });
});

test("Comment.reopenはstatusだけを変更してanchorResolutionを維持する", () => {
  const resolvedComment: Comment = {
    ...openComment,
    status: "resolved",
  };

  expect(Comment.reopen(resolvedComment)).toEqual(openComment);
});
