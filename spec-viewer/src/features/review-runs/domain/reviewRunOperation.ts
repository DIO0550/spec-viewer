import type { ReviewRun } from "@/features/review-runs/types/reviewRun";
import type { NormalizedCommandError } from "@/shared/types/ipc";

export type ReviewRunCreateState =
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

export type ReviewRunArchiveState =
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

export const ReviewRunCreateState = {
  /** @returns Idle create operation state. */
  idle(): ReviewRunCreateState {
    return {
      status: "idle",
      reviewRun: null,
      error: null,
    };
  },

  /** @returns Saving create operation state. */
  saving(): ReviewRunCreateState {
    return {
      status: "saving",
      reviewRun: null,
      error: null,
    };
  },

  /** @returns Successful create operation state. */
  success(reviewRun: ReviewRun): ReviewRunCreateState {
    return {
      status: "success",
      reviewRun,
      error: null,
    };
  },

  /** @returns Failed create operation state. */
  error(error: NormalizedCommandError): ReviewRunCreateState {
    return {
      status: "error",
      reviewRun: null,
      error,
    };
  },
} as const;

export const ReviewRunArchiveState = {
  /** @returns Idle archive operation state. */
  idle(): ReviewRunArchiveState {
    return {
      status: "idle",
      reviewRunId: null,
      reviewRun: null,
      error: null,
    };
  },

  /** @returns Saving archive operation state. */
  saving(reviewRunId: string): ReviewRunArchiveState {
    return {
      status: "saving",
      reviewRunId,
      reviewRun: null,
      error: null,
    };
  },

  /** @returns Successful archive operation state. */
  success(reviewRunId: string, reviewRun: ReviewRun): ReviewRunArchiveState {
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
  ): ReviewRunArchiveState {
    return {
      status: "error",
      reviewRunId,
      reviewRun: null,
      error,
    };
  },
} as const;
