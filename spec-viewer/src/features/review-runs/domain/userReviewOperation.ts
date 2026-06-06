import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { NormalizedCommandError } from "@/shared/types/ipc";

export type UserReviewCreateState =
  | Readonly<{
      status: "idle";
      userReview: null;
      error: null;
    }>
  | Readonly<{
      status: "saving";
      userReview: null;
      error: null;
    }>
  | Readonly<{
      status: "success";
      userReview: UserReview;
      error: null;
    }>
  | Readonly<{
      status: "error";
      userReview: null;
      error: NormalizedCommandError;
    }>;

export type UserReviewArchiveState =
  | Readonly<{
      status: "idle";
      userReviewId: null;
      userReview: null;
      error: null;
    }>
  | Readonly<{
      status: "saving";
      userReviewId: string;
      userReview: null;
      error: null;
    }>
  | Readonly<{
      status: "success";
      userReviewId: string;
      userReview: UserReview;
      error: null;
    }>
  | Readonly<{
      status: "error";
      userReviewId: string;
      userReview: null;
      error: NormalizedCommandError;
    }>;

export const UserReviewCreateState = {
  /** @returns Idle create operation state. */
  idle(): UserReviewCreateState {
    return {
      status: "idle",
      userReview: null,
      error: null,
    };
  },

  /** @returns Saving create operation state. */
  saving(): UserReviewCreateState {
    return {
      status: "saving",
      userReview: null,
      error: null,
    };
  },

  /** @returns Successful create operation state. */
  success(userReview: UserReview): UserReviewCreateState {
    return {
      status: "success",
      userReview,
      error: null,
    };
  },

  /** @returns Failed create operation state. */
  error(error: NormalizedCommandError): UserReviewCreateState {
    return {
      status: "error",
      userReview: null,
      error,
    };
  },
} as const;

export const UserReviewArchiveState = {
  /** @returns Idle archive operation state. */
  idle(): UserReviewArchiveState {
    return {
      status: "idle",
      userReviewId: null,
      userReview: null,
      error: null,
    };
  },

  /** @returns Saving archive operation state. */
  saving(userReviewId: string): UserReviewArchiveState {
    return {
      status: "saving",
      userReviewId,
      userReview: null,
      error: null,
    };
  },

  /** @returns Successful archive operation state. */
  success(
    userReviewId: string,
    userReview: UserReview,
  ): UserReviewArchiveState {
    return {
      status: "success",
      userReviewId,
      userReview,
      error: null,
    };
  },

  /** @returns Failed archive operation state. */
  error(
    userReviewId: string,
    error: NormalizedCommandError,
  ): UserReviewArchiveState {
    return {
      status: "error",
      userReviewId,
      userReview: null,
      error,
    };
  },
} as const;
