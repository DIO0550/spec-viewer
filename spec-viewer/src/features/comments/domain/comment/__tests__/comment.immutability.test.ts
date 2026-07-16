import { expect, test } from "vitest";
import {
  Comment,
  type Comment as CommentType,
  type CommentAnchorResolution,
  type CreateCommentInput,
  type RestoreCommentInput,
} from "@/features/comments/domain/comment";
import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
import { commentBody } from "@/features/comments/testing/comment-body-test-fixture";
import * as TestValues from "@/shared/testing/validatedValueObjects";

const restoreInput: RestoreCommentInput & { resolved: boolean } = {
  id: TestValues.commentId("cmt_1"),
  anchor: createCommentAnchorTestFixture(),
  body: commentBody("Clarify this task"),
  status: "resolved",
  resolved: true,
  anchorResolution: null,
  createdAt: TestValues.isoDateTime("2026-05-05T10:00:00Z"),
  updatedAt: TestValues.isoDateTime("2026-05-05T10:10:00Z"),
};

const createInput: CreateCommentInput & { resolved: boolean } = {
  id: restoreInput.id,
  anchor: restoreInput.anchor,
  body: restoreInput.body,
  resolved: false,
  createdAt: restoreInput.createdAt,
};

test("Comment.createはlegacy extra fieldをaggregateへ保持しない", () => {
  expect(Comment.create(createInput)).not.toHaveProperty("resolved");
});

test("Comment.restoreはlegacy extra fieldをaggregateへ保持しない", () => {
  const result = Comment.restore(restoreInput);

  expect(result.ok).toBe(true);
  const comment = (result as Readonly<{ ok: true; value: CommentType }>).value;
  expect(comment).not.toHaveProperty("resolved");
});

test("Comment.restoreは入力objectの後続mutationからaggregateを隔離する", () => {
  const mutableInput = {
    ...restoreInput,
    anchor: {
      ...restoreInput.anchor,
      charRange: { ...restoreInput.anchor.charRange },
    },
  };
  const result = Comment.restore(mutableInput);

  expect(result.ok).toBe(true);
  const comment = (result as Readonly<{ ok: true; value: CommentType }>).value;

  Object.assign(mutableInput, {
    status: "open",
    body: commentBody("Mutated body"),
  });
  Object.assign(mutableInput.anchor.charRange, { start: 9 });

  expect(comment.status).toBe("resolved");
  expect(comment.body).toBe("Clarify this task");
  expect(comment.anchor.charRange.start).toBe(0);
});

test("Comment.createは入力objectの後続mutationからaggregateを隔離する", () => {
  const mutableInput = {
    ...createInput,
    anchor: {
      ...createInput.anchor,
      charRange: { ...createInput.anchor.charRange },
    },
  };
  const comment = Comment.create(mutableInput);

  Object.assign(mutableInput, {
    body: commentBody("Mutated body"),
  });
  Object.assign(mutableInput.anchor.charRange, { start: 9 });

  expect(comment.body).toBe("Clarify this task");
  expect(comment.anchor.charRange.start).toBe(0);
});

test("Comment.restoreはanchor resolutionのnested mutationからaggregateを隔離する", () => {
  const mutableAnchorResolution = {
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
  } satisfies CommentAnchorResolution;
  const result = Comment.restore({
    ...restoreInput,
    anchorResolution: mutableAnchorResolution,
  });

  expect(result.ok).toBe(true);
  const comment = (result as Readonly<{ ok: true; value: CommentType }>).value;

  Object.assign(mutableAnchorResolution.target.sourceRange, {
    startByteOffset: 99,
  });

  expect(comment.anchorResolution?.target?.sourceRange?.startByteOffset).toBe(
    10,
  );
});
