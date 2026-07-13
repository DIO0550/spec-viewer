import { assert, expect, test } from "vitest";

import { CommentBody } from "@/features/comments/domain/commentBody";

test.each([
  "",
  "   ",
  "\n\t",
])("CommentBody.parseはblank draft %jを共通理由で拒否する", (draft) => {
  expect(CommentBody.parse(draft)).toEqual({
    ok: false,
    error: {
      reason: "empty_body",
      message: "コメント本文を入力してください。",
    },
  });
});

test("CommentBody.parseは前後空白を除いたvalidated bodyを返す", () => {
  const result = CommentBody.parse("  Please clarify this requirement.  ");

  expect(result).toEqual({
    ok: true,
    commentBody: "Please clarify this requirement.",
  });
});

test("CommentBody.toStringはvalidated bodyをtransport文字列へ戻す", () => {
  const result = CommentBody.parse("Normalized body");

  expect(result).toEqual({
    ok: true,
    commentBody: "Normalized body",
  });
  assert(result.ok);

  expect(CommentBody.toString(result.commentBody)).toBe("Normalized body");
});
