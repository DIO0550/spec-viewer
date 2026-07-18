import type { ArchiveUserReviewCommandError } from "@/shared/api/tauri/archiveUserReview";
import type { CreateUserReviewCommandError } from "@/shared/api/tauri/createUserReview";
import type { ListUserReviewsCommandError } from "@/shared/api/tauri/listUserReviews";

export type UserReviewCommandError =
  | ArchiveUserReviewCommandError
  | CreateUserReviewCommandError
  | ListUserReviewsCommandError;

export type UserReviewFeatureErrorCode =
  | "invalidRequest"
  | "invalidComment"
  | "commentRepository"
  | "userReviewExport"
  | "unknown";

export type UserReviewFeatureError = Readonly<{
  feature: "userReviews";
  code: UserReviewFeatureErrorCode;
  message: string;
  cause: UserReviewCommandError;
}>;

export const UserReviewFeatureError = {
  /** @returns A feature-level review-run error from a command error. */
  fromCommandError(error: UserReviewCommandError): UserReviewFeatureError {
    return {
      feature: "userReviews",
      code: UserReviewFeatureError.fromCommandErrorCode(error.code),
      message: error.message,
      cause: error,
    };
  },

  /** @returns A review-run feature error code mapped from a command code. */
  fromCommandErrorCode(
    code: UserReviewCommandError["code"],
  ): UserReviewFeatureErrorCode {
    if (
      code === "invalidRequest" ||
      code === "invalidComment" ||
      code === "commentRepository" ||
      code === "userReviewExport"
    ) {
      return code;
    }

    return "unknown";
  },
} as const;
