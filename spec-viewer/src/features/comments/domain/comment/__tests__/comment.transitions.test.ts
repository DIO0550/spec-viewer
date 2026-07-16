import { expect, test } from "vitest";
import {
  Comment,
  type Comment as CommentType,
  type CreateCommentInput,
} from "@/features/comments/domain/comment";
import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
import { commentBody } from "@/features/comments/testing/comment-body-test-fixture";
import * as TestValues from "@/shared/testing/validatedValueObjects";

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
const openComment = Comment.create(createInput);
const resolvedComment = (
  Comment.restore({
    ...openComment,
    status: "resolved",
  }) as Readonly<{ ok: true; value: CommentType }>
).value;

test("Comment.isOpenとisResolvedはstatus唯一のsource of truthを問い合わせる", () => {
  expect(Comment.isOpen(openComment)).toBe(true);
  expect(Comment.isResolved(openComment)).toBe(false);
  expect(Comment.isOpen(resolvedComment)).toBe(false);
  expect(Comment.isResolved(resolvedComment)).toBe(true);
});

test("Comment.updateBodyはimmutable fieldsを維持しbodyとupdatedAtだけ更新する", () => {
  const updatedAt = TestValues.isoDateTime("2026-05-05T10:05:00Z");

  expect(
    Comment.updateBody(openComment, {
      body: commentBody("Updated body"),
      updatedAt,
    }),
  ).toEqual({
    ok: true,
    value: {
      ...openComment,
      body: "Updated body",
      updatedAt,
    },
  });
});

test.each([
  [
    "updateBody",
    (updatedAt: CommentType["updatedAt"]) =>
      Comment.updateBody(openComment, {
        body: commentBody("Updated body"),
        updatedAt,
      }),
  ],
  [
    "resolve",
    (updatedAt: CommentType["updatedAt"]) =>
      Comment.resolve(openComment, { updatedAt }),
  ],
  [
    "reopen",
    (updatedAt: CommentType["updatedAt"]) =>
      Comment.reopen(resolvedComment, { updatedAt }),
  ],
] as const)("Comment.%sはupdatedAtのrollbackを拒否する", (_label, mutate) => {
  const updatedAt = TestValues.isoDateTime("2026-05-05T09:59:59Z");

  expect(mutate(updatedAt)).toEqual({
    ok: false,
    error: {
      reason: "updatedAtBeforePreviousUpdate",
      previousUpdatedAt: openComment.updatedAt,
      updatedAt,
    },
  });
});

test("Comment.reopenはcreatedAtより後でもprevious updatedAtより前の時刻を拒否する", () => {
  const previousUpdatedAt = TestValues.isoDateTime("2026-05-05T10:10:00Z");
  const proposedUpdatedAt = TestValues.isoDateTime("2026-05-05T10:05:00Z");
  const current = Comment.restore({
    ...resolvedComment,
    updatedAt: previousUpdatedAt,
  }) as Readonly<{ ok: true; value: CommentType }>;

  expect(
    Comment.reopen(current.value, { updatedAt: proposedUpdatedAt }),
  ).toEqual({
    ok: false,
    error: {
      reason: "updatedAtBeforePreviousUpdate",
      previousUpdatedAt,
      updatedAt: proposedUpdatedAt,
    },
  });
});

test("Comment.resolveとreopenはimmutable fieldsを維持してstatusを遷移する", () => {
  const resolvedAt = TestValues.isoDateTime("2026-05-05T10:05:00Z");
  const resolved = Comment.resolve(openComment, {
    updatedAt: resolvedAt,
  }) as Readonly<{ ok: true; value: CommentType }>;
  const reopenedAt = TestValues.isoDateTime("2026-05-05T10:10:00Z");

  expect(resolved).toEqual({
    ok: true,
    value: { ...openComment, status: "resolved", updatedAt: resolvedAt },
  });
  expect(Comment.reopen(resolved.value, { updatedAt: reopenedAt })).toEqual({
    ok: true,
    value: { ...openComment, status: "open", updatedAt: reopenedAt },
  });
});

test("Comment.resolveは同一timestampのoptimistic遷移を許可する", () => {
  expect(
    Comment.resolve(openComment, { updatedAt: openComment.updatedAt }),
  ).toMatchObject({
    ok: true,
    value: { status: "resolved", updatedAt: openComment.updatedAt },
  });
});
