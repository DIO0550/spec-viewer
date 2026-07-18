import { expect, expectTypeOf, test } from "vitest";

import {
  UserReviewFeatureError,
  type UserReviewCommandError,
  type UserReviewFeatureError as UserReviewFeatureErrorType,
  type UserReviewFeatureErrorCode,
} from "@/features/review-runs/domain/userReviewError";
import { CreateUserReviewCommandError } from "@/shared/api/tauri/createUserReview";

test("UserReviewFeatureErrorはfeatureとcommand-local causeを必須にする", () => {
  expectTypeOf<UserReviewFeatureErrorType>().toEqualTypeOf<
    Readonly<{
      feature: "userReviews";
      code: UserReviewFeatureErrorCode;
      message: string;
      cause: UserReviewCommandError;
    }>
  >();
});

test.each([
  ["invalidRequest", "invalidRequest"],
  ["invalidComment", "invalidComment"],
  ["commentRepository", "commentRepository"],
  ["userReviewExport", "userReviewExport"],
  ["unexpected", "unknown"],
  ["unknown", "unknown"],
] as const)("UserReviewFeatureError.fromCommandErrorCodeは%sを%sへ写す", (commandCode, featureCode) => {
  expect(UserReviewFeatureError.fromCommandErrorCode(commandCode)).toBe(
    featureCode,
  );
});

test("UserReviewFeatureError.fromCommandErrorはfeature/message/causeを保持する", () => {
  const cause = CreateUserReviewCommandError.fromUnknown({
    command: "create_user_review",
    code: "userReviewExport",
    message: "export failed",
    raw: { runId: "run-1" },
  });

  expect(UserReviewFeatureError.fromCommandError(cause)).toEqual({
    feature: "userReviews",
    code: "userReviewExport",
    message: "export failed",
    cause,
  });
});
