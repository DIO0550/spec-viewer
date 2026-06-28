import type { CommentId } from "@/features/comments/types/comment";
import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewWorkspaceMode } from "@/features/review-runs/types/userReviewIpc";
import type { IpcCommandError } from "@/shared/types/ipc";

export type AsyncOperationState<TPayload, TResult> =
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
      error: IpcCommandError;
    }>;

export type CreateUserReviewPayload = Readonly<{
  commentIds: readonly CommentId[];
  workspaceMode: UserReviewWorkspaceMode;
}>;

export type ArchiveUserReviewPayload = Readonly<{
  userReviewId: string;
}>;

export type UserReviewCreateState = AsyncOperationState<
  CreateUserReviewPayload,
  UserReview
>;

export type UserReviewArchiveState = AsyncOperationState<
  ArchiveUserReviewPayload,
  UserReview
>;

export const UserReviewCreateState = {
  /** @returns Idle create operation state. */
  idle(): UserReviewCreateState {
    return { status: "idle" };
  },

  /**
   * @param payload - Input used for the in-flight create operation.
   * @returns Saving create operation state.
   */
  saving(payload: CreateUserReviewPayload): UserReviewCreateState {
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
  ): UserReviewCreateState {
    return { status: "success", payload, result: userReview };
  },

  /**
   * @param payload - Input used for the failed create operation.
   * @param error - Normalized command error.
   * @returns Failed create operation state.
   */
  error(
    payload: CreateUserReviewPayload,
    error: IpcCommandError,
  ): UserReviewCreateState {
    return { status: "error", payload, error };
  },
} as const;

export const UserReviewArchiveState = {
  /** @returns Idle archive operation state. */
  idle(): UserReviewArchiveState {
    return { status: "idle" };
  },

  /**
   * @param payload - Input used for the in-flight archive operation.
   * @returns Saving archive operation state.
   */
  saving(payload: ArchiveUserReviewPayload): UserReviewArchiveState {
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
  ): UserReviewArchiveState {
    return { status: "success", payload, result: userReview };
  },

  /**
   * @param payload - Input used for the failed archive operation.
   * @param error - Normalized command error.
   * @returns Failed archive operation state.
   */
  error(
    payload: ArchiveUserReviewPayload,
    error: IpcCommandError,
  ): UserReviewArchiveState {
    return { status: "error", payload, error };
  },
} as const;
