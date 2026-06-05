import type { IsoDateTimeString } from "@/features/comments/types/comment";
import type {
  ReviewRun,
  ReviewRunExecutionTarget,
  ReviewRunSourceFile,
  ReviewRunStatus,
  ReviewRunTarget,
} from "@/features/review-runs/types/reviewRun";

export type ReviewSessionBase = Readonly<{
  id: string;
  target: ReviewRunTarget;
  executionTarget: ReviewRunExecutionTarget;
  specFolderPath: string;
  folderPath: string;
  sourceFiles: readonly ReviewRunSourceFile[];
  commentCount: number;
  createdAt: IsoDateTimeString;
  summary: string | null;
  warnings: readonly string[];
}>;

export type ActiveReviewSession = ReviewSessionBase &
  Readonly<{
    status: "active";
    archivedAt: null;
  }>;

export type InProgressReviewSession = ReviewSessionBase &
  Readonly<{
    status: "inProgress";
    archivedAt: null;
  }>;

export type CompletedReviewSession = ReviewSessionBase &
  Readonly<{
    status: "completed";
    archivedAt: null;
  }>;

export type ArchivedReviewSession = ReviewSessionBase &
  Readonly<{
    status: "archived";
    archivedAt: IsoDateTimeString;
  }>;

export type NonArchivedReviewSession =
  | ActiveReviewSession
  | InProgressReviewSession
  | CompletedReviewSession;

export type ReviewSession = NonArchivedReviewSession | ArchivedReviewSession;

export const ReviewSession = {
  /** @returns Review run narrowed to a review-session lifecycle variant. */
  fromReviewRun(reviewRun: ReviewRun): ReviewSession {
    ReviewSession.assertValidLifecycle(reviewRun);
    return reviewRun as ReviewSession;
  },

  /** @returns True when the session belongs to archived collection. */
  isArchived(reviewRun: ReviewSession): reviewRun is ArchivedReviewSession {
    return reviewRun.status === "archived";
  },

  /** @returns True when the session belongs to active collection. */
  isNonArchived(
    reviewRun: ReviewSession,
  ): reviewRun is NonArchivedReviewSession {
    return reviewRun.status !== "archived";
  },

  /**
   * @param reviewRun - Review run from the command boundary.
   * @throws Error when status and archivedAt violate lifecycle invariants.
   */
  assertValidLifecycle(reviewRun: ReviewRun): void {
    if (reviewRun.status === "archived" && reviewRun.archivedAt === null) {
      throw new Error(
        `Archived review run must have archivedAt: ${reviewRun.id}`,
      );
    }

    if (
      isNonArchivedStatus(reviewRun.status) &&
      reviewRun.archivedAt !== null
    ) {
      throw new Error(
        `Non-archived review run must not have archivedAt: ${reviewRun.id}`,
      );
    }
  },
} as const;

/** @returns True when the status is visible in the active session list. */
function isNonArchivedStatus(
  status: ReviewRunStatus,
): status is NonArchivedReviewSession["status"] {
  return status !== "archived";
}
