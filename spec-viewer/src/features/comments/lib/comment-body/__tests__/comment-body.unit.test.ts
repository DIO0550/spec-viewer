import { expect, test } from "vitest";

import { CommentBody } from "@/features/comments/lib/comment-body";

test("CommentBodyは空本文をsubmit不可として扱う", () => {
  const body = CommentBody.create();

  expect(CommentBody.getTrimmedValue(body)).toBe("");
  expect(CommentBody.isEmpty(body)).toBe(true);
  expect(CommentBody.validate(body)).toBe("empty_body");
});

test("CommentBodyは本文を更新しsubmit用にtrimできる", () => {
  const body = CommentBody.update(CommentBody.create(), " body ");

  expect(body.value).toBe(" body ");
  expect(CommentBody.getTrimmedValue(body)).toBe("body");
  expect(CommentBody.isEmpty(body)).toBe(false);
  expect(CommentBody.validate(body)).toBeNull();
});
