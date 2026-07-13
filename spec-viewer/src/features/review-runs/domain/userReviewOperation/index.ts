import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewId } from "@/features/review-runs/domain/userReviewId";
import type { UserReviewWorkspaceMode } from "@/features/review-runs/domain/userReviewWorkspaceMode";
import type { CommentId } from "@/shared/domain/commentId";

export type AsyncOperationState<TPayload, TResult, TError = unknown> =
  | Readonly<{
      status: "idle";
    }>
  | Readonly<{
      status: "saving";
      payload: TPayload;
    }>
  | Readonly<{
      status: "success";
      payload: TPayload;
      result: TResult;
    }>
  | Readonly<{
      status: "error";
      payload: TPayload;
      error: TError;
    }>;

export type CreateUserReviewPayload = Readonly<{
  commentIds: readonly CommentId[];
  workspaceMode: UserReviewWorkspaceMode;
}>;

export type ArchiveUserReviewPayload = Readonly<{
  userReviewId: UserReviewId;
}>;

export type UserReviewCreateState<TError = unknown> = AsyncOperationState<
  CreateUserReviewPayload,
  UserReview,
  TError
>;

export type UserReviewArchiveState<TError = unknown> = AsyncOperationState<
  ArchiveUserReviewPayload,
  UserReview,
  TError
>;

export const UserReviewCreateState = {
  /** @returns Idle create operation state. */
  idle(): UserReviewCreateState<never> {
    return { status: "idle" };
  },

  /**
   * @param payload - Input used for the in-flight create operation.
   * @returns Saving create operation state.
   */
  saving(payload: CreateUserReviewPayload): UserReviewCreateState<never> {
    return { status: "saving", payload };
  },

  /**
   * @param payload - Input used for the completed create operation.
   * @param userReview - Created user review.
   * @returns Successful create operation state.
   */
  success(
    payload: CreateUserReviewPayload,
    userReview: UserReview,
  ): UserReviewCreateState<never> {
    return { status: "success", payload, result: userReview };
  },

  /**
   * @param payload - Input used for the failed create operation.
   * @param error - Feature-level user review error.
   * @returns Failed create operation state.
   */
  error<TError>(
    payload: CreateUserReviewPayload,
    error: TError,
  ): UserReviewCreateState<TError> {
    return { status: "error", payload, error };
  },
} as const;

export const UserReviewArchiveState = {
  /** @returns Idle archive operation state. */
  idle(): UserReviewArchiveState<never> {
    return { status: "idle" };
  },

  /**
   * @param payload - Input used for the in-flight archive operation.
   * @returns Saving archive operation state.
   */
  saving(payload: ArchiveUserReviewPayload): UserReviewArchiveState<never> {
    return { status: "saving", payload };
  },

  /**
   * @param payload - Input used for the completed archive operation.
   * @param userReview - Archived user review.
   * @returns Successful archive operation state.
   */
  success(
    payload: ArchiveUserReviewPayload,
    userReview: UserReview,
  ): UserReviewArchiveState<never> {
    return { status: "success", payload, result: userReview };
  },

  /**
   * @param payload - Input used for the failed archive operation.
   * @param error - Feature-level user review error.
   * @returns Failed archive operation state.
   */
  error<TError>(
    payload: ArchiveUserReviewPayload,
    error: TError,
  ): UserReviewArchiveState<TError> {
    return { status: "error", payload, error };
  },
} as const;
