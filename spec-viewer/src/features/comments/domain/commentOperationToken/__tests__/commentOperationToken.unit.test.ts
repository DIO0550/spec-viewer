import { expect, test } from "vitest";

import { CommentOperationToken } from "@/features/comments/domain/commentOperationToken";

const token = CommentOperationToken.create(3, "scope-a");

test("matchesはrequestIdとscopeKeyが両方一致するときtrueを返す", () => {
  expect(
    CommentOperationToken.matches(token, { requestId: 3, scopeKey: "scope-a" }),
  ).toBe(true);
});

test.each([
  ["requestIdが進んだ", 4, "scope-a"],
  ["scopeが切り替わった", 3, "scope-b"],
] as const)("matchesは%sときfalseを返す", (_label, requestId, scopeKey) => {
  expect(CommentOperationToken.matches(token, { requestId, scopeKey })).toBe(
    false,
  );
});
