import { expect, test } from "vitest";

import { toUserReviewFeatureError } from "@/features/review-runs/infra/tauri/userReviewErrorMapper";

test.each([
  ["list", "invalidRequest", "requestRejected"],
  ["create", "invalidComment", "commentRejected"],
  ["create", "commentRepository", "commentReadFailed"],
  ["archive", "userReviewExport", "reviewExportFailed"],
] as const)("toUserReviewFeatureErrorは%sの%sをdomain reason %sへ写して表示契約を維持する", (operation, code, expectedReason) => {
  const rawError = { code, message: `review: ${code}` };

  const result = toUserReviewFeatureError(operation, rawError);

  expect(result).toMatchObject({
    feature: "userReviews",
    code,
    message: rawError.message,
    domainError: { reason: expectedReason },
  });
  expect(result.cause).toMatchObject({
    code,
    message: rawError.message,
    cause: rawError,
  });
});

test.each([
  ["create", "invalidSpec"],
  ["list", "workspaceDetection"],
  ["archive", "unexpected"],
] as const)("toUserReviewFeatureErrorは%sの非domain wire code %sをunknown表示へ写してraw payloadを保持する", (operation, code) => {
  const rawError = { code, message: `review: ${code}` };

  const result = toUserReviewFeatureError(operation, rawError);

  expect(result).toMatchObject({
    feature: "userReviews",
    code: "unknown",
    message: rawError.message,
    domainError: { reason: "unexpectedFailure" },
  });
  expect(result.cause).toMatchObject({ cause: rawError });
});

test.each([
  ["archive", "archive_user_review"],
  ["create", "create_user_review"],
  ["list", "list_user_reviews"],
] as const)("toUserReviewFeatureErrorは%sを%s command境界で正規化する", (operation, expectedCommand) => {
  const result = toUserReviewFeatureError(operation, {
    code: "invalidRequest",
    message: "invalid request",
  });

  expect(result.cause).toMatchObject({ command: expectedCommand });
});
