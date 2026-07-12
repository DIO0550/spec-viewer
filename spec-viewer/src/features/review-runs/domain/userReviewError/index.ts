import type { ArchiveUserReviewCommandError } from "@/features/review-runs/infra/tauri/archiveUserReview";
import type { CreateUserReviewCommandError } from "@/features/review-runs/infra/tauri/createUserReview";
import type { ListUserReviewsCommandError } from "@/features/review-runs/infra/tauri/listUserReviews";

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
  /** @deprecated Optional only while legacy fixtures migrate to feature-level errors. */
  feature?: "userReviews";
  code: UserReviewFeatureErrorCode | string;
  message: string;
  cause?: UserReviewCommandError;
  /** @deprecated Compatibility field for legacy normalized command error fixtures. */
  raw?: unknown;
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
