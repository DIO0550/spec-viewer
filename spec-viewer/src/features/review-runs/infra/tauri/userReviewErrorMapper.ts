import type {
  UserReviewFeatureError,
  UserReviewFeatureErrorCode,
} from "@/features/review-runs/application/userReviewError";
import type { UserReviewErrorReason } from "@/features/review-runs/domain/userReviewError";
import {
  ArchiveUserReviewCommandError,
  type ArchiveUserReviewCommandError as ArchiveUserReviewCommandErrorType,
} from "@/features/review-runs/infra/tauri/archiveUserReview";
import {
  CreateUserReviewCommandError,
  type CreateUserReviewCommandError as CreateUserReviewCommandErrorType,
} from "@/features/review-runs/infra/tauri/createUserReview";
import {
  ListUserReviewsCommandError,
  type ListUserReviewsCommandError as ListUserReviewsCommandErrorType,
} from "@/features/review-runs/infra/tauri/listUserReviews";

export type UserReviewErrorOperation = "archive" | "create" | "list";

type UserReviewCommandError =
  | ArchiveUserReviewCommandErrorType
  | CreateUserReviewCommandErrorType
  | ListUserReviewsCommandErrorType;

/**
 * @param operation - User-review command that rejected.
 * @param error - Unknown value rejected by the command boundary.
 * @returns Application error with a pure domain reason and stable display contract.
 */
export function toUserReviewFeatureError(
  operation: UserReviewErrorOperation,
  error: unknown,
): UserReviewFeatureError {
  const cause = toUserReviewCommandError(operation, error);
  const mapping = toUserReviewErrorMapping(cause.code);

  return {
    feature: "userReviews",
    code: mapping.code,
    message: cause.message,
    domainError: { reason: mapping.reason },
    cause,
  };
}

/**
 * @param operation - User-review command that rejected.
 * @param error - Unknown value rejected by the command boundary.
 * @returns The command-specific infrastructure error for a rejected operation.
 */
function toUserReviewCommandError(
  operation: UserReviewErrorOperation,
  error: unknown,
): UserReviewCommandError {
  switch (operation) {
    case "archive":
      return ArchiveUserReviewCommandError.fromUnknown(error);
    case "create":
      return CreateUserReviewCommandError.fromUnknown(error);
    case "list":
      return ListUserReviewsCommandError.fromUnknown(error);
  }
}

/**
 * @param code - Parsed user-review command error code.
 * @returns Domain reason and display code for a user-review command error code.
 */
function toUserReviewErrorMapping(
  code: UserReviewCommandError["code"],
): Readonly<{
  code: UserReviewFeatureErrorCode;
  reason: UserReviewErrorReason;
}> {
  switch (code) {
    case "invalidRequest":
      return { code, reason: "requestRejected" };
    case "invalidComment":
      return { code, reason: "commentRejected" };
    case "commentRepository":
      return { code, reason: "commentReadFailed" };
    case "userReviewExport":
      return { code, reason: "reviewExportFailed" };
    default:
      return { code: "unknown", reason: "unexpectedFailure" };
  }
}
