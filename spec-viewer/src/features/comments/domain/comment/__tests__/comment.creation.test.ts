import * as TestValues from "@/shared/testing/validatedValueObjects";
import { expect, expectTypeOf, test } from "vitest";

import {
  Comment,
  type CreateCommentInput,
} from "@/features/comments/domain/comment";
import type { CommentBody } from "@/features/comments/domain/commentBody";
import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
import { commentBody } from "@/features/comments/testing/comment-body-test-fixture";

const createdAt = TestValues.isoDateTime("2026-05-05T10:00:00Z");
const createInput: CreateCommentInput = {
  id: TestValues.commentId("cmt_1"),
  anchor: createCommentAnchorTestFixture({
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 0,
    textHash: "sha256:f1a57001",
    textSnippet: "Clarify this task",
    charRange: { start: 0, end: 18 },
  }),
  body: commentBody("Clarify this task"),
  createdAt,
};

test("Comment.createはvalidated inputから必ずopenのaggregateを作る", () => {
  const comment = Comment.create(createInput);

  expect(comment).toEqual({
    ...createInput,
    status: "open",
    anchorResolution: null,
    updatedAt: createdAt,
  });
  expect(comment).not.toHaveProperty("resolved");
});

test("Comment.createはvalidated CommentBodyを要求する", () => {
  expectTypeOf<CreateCommentInput["body"]>().toEqualTypeOf<CommentBody>();
});

test("Comment.restoreはresolved aggregateと同時刻更新を復元する", () => {
  expect(
    Comment.restore({
      ...createInput,
      status: "resolved",
      anchorResolution: null,
      updatedAt: createdAt,
    }),
  ).toEqual({
    ok: true,
    value: {
      ...createInput,
      status: "resolved",
      anchorResolution: null,
      updatedAt: createdAt,
    },
  });
});

test("Comment.restoreはupdatedAtがcreatedAtより前なら拒否する", () => {
  const updatedAt = TestValues.isoDateTime("2026-05-05T09:59:59Z");

  expect(
    Comment.restore({
      ...createInput,
      status: "open",
      anchorResolution: null,
      updatedAt,
    }),
  ).toEqual({
    ok: false,
    error: {
      reason: "updatedAtBeforeCreatedAt",
      createdAt,
      updatedAt,
    },
  });
});

test("Comment.restoreはoffsetを同一instantへ正規化して順序を検証する", () => {
  expect(
    Comment.restore({
      ...createInput,
      createdAt: TestValues.isoDateTime("2026-05-05T10:00:00+09:00"),
      status: "open",
      anchorResolution: null,
      updatedAt: TestValues.isoDateTime("2026-05-05T01:00:00.0000001Z"),
    }),
  ).toMatchObject({ ok: true });
});

test("Comment.restoreはmillisecondより細かいrollbackも拒否する", () => {
  const fractionalCreatedAt = TestValues.isoDateTime(
    "2026-05-05T10:00:00.0000002Z",
  );
  const updatedAt = TestValues.isoDateTime("2026-05-05T10:00:00.0000001Z");

  expect(
    Comment.restore({
      ...createInput,
      createdAt: fractionalCreatedAt,
      status: "open",
      anchorResolution: null,
      updatedAt,
    }),
  ).toEqual({
    ok: false,
    error: {
      reason: "updatedAtBeforeCreatedAt",
      createdAt: fractionalCreatedAt,
      updatedAt,
    },
  });
});
