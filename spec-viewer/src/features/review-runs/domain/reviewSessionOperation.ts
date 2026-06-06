import type { ReviewRun } from "@/features/review-runs/types/reviewRun";
import type { NormalizedCommandError } from "@/shared/types/ipc";

export type ReviewSessionCreateState =
  | Readonly<{
      status: "idle";
      reviewRun: null;
      error: null;
    }>
  | Readonly<{
      status: "saving";
      reviewRun: null;
      error: null;
    }>
  | Readonly<{
      status: "success";
      reviewRun: ReviewRun;
      error: null;
    }>
  | Readonly<{
      status: "error";
      reviewRun: null;
      error: NormalizedCommandError;
    }>;

export type ReviewSessionArchiveState =
  | Readonly<{
      status: "idle";
      reviewRunId: null;
      reviewRun: null;
      error: null;
    }>
  | Readonly<{
      status: "saving";
      reviewRunId: string;
      reviewRun: null;
      error: null;
    }>
  | Readonly<{
      status: "success";
      reviewRunId: string;
      reviewRun: ReviewRun;
      error: null;
    }>
  | Readonly<{
      status: "error";
      reviewRunId: string;
      reviewRun: null;
      error: NormalizedCommandError;
    }>;

export const ReviewSessionCreateState = {
  /** @returns Idle create operation state. */
  idle(): ReviewSessionCreateState {
    return {
      status: "idle",
      reviewRun: null,
      error: null,
    };
  },

  /** @returns Saving create operation state. */
  saving(): ReviewSessionCreateState {
    return {
      status: "saving",
      reviewRun: null,
      error: null,
    };
  },

  /** @returns Successful create operation state. */
  success(reviewRun: ReviewRun): ReviewSessionCreateState {
    return {
      status: "success",
      reviewRun,
      error: null,
    };
  },

  /** @returns Failed create operation state. */
  error(error: NormalizedCommandError): ReviewSessionCreateState {
    return {
      status: "error",
      reviewRun: null,
      error,
    };
  },
} as const;

export const ReviewSessionArchiveState = {
  /** @returns Idle archive operation state. */
  idle(): ReviewSessionArchiveState {
    return {
      status: "idle",
      reviewRunId: null,
      reviewRun: null,
      error: null,
    };
  },

  /** @returns Saving archive operation state. */
  saving(reviewRunId: string): ReviewSessionArchiveState {
    return {
      status: "saving",
      reviewRunId,
      reviewRun: null,
      error: null,
    };
  },

  /** @returns Successful archive operation state. */
  success(
    reviewRunId: string,
    reviewRun: ReviewRun,
  ): ReviewSessionArchiveState {
    return {
      status: "success",
      reviewRunId,
      reviewRun,
      error: null,
    };
  },

  /** @returns Failed archive operation state. */
  error(
    reviewRunId: string,
    error: NormalizedCommandError,
  ): ReviewSessionArchiveState {
    return {
      status: "error",
      reviewRunId,
      reviewRun: null,
      error,
    };
  },
} as const;
