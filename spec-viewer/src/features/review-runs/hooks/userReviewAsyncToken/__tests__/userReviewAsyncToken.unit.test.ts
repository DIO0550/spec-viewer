import { expect, test } from "vitest";

import { UserReviewAsyncToken } from "@/features/review-runs/hooks/userReviewAsyncToken";

test("UserReviewAsyncToken.isCurrentはrequest idとidentityが一致するとtrueを返す", () => {
  const token = UserReviewAsyncToken.create(2, "workspace:file:auth:tasks");

  expect(
    UserReviewAsyncToken.isCurrent(token, "workspace:file:auth:tasks", 2),
  ).toBe(true);
});

test("UserReviewAsyncToken.isCurrentは古いrequest idならfalseを返す", () => {
  const token = UserReviewAsyncToken.create(1, "workspace:file:auth:tasks");

  expect(
    UserReviewAsyncToken.isCurrent(token, "workspace:file:auth:tasks", 2),
  ).toBe(false);
});

test("UserReviewAsyncToken.isCurrentはidentityが変わるとfalseを返す", () => {
  const token = UserReviewAsyncToken.create(2, "workspace:file:auth:tasks");

  expect(UserReviewAsyncToken.isCurrent(token, "workspace:spec:auth", 2)).toBe(
    false,
  );
});
