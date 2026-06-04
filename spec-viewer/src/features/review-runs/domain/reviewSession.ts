import type { IsoDateTimeString } from "@/features/comments/types/comment";
import type {
  ReviewRun,
  ReviewRunStatus,
} from "@/features/review-runs/types/reviewRun";

export type ReviewSessionBase = Omit<ReviewRun, "archivedAt" | "status">;

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
  /** @returns Review run DTO narrowed to a review-session lifecycle variant. */
  fromDto(dto: ReviewRun): ReviewSession {
    ReviewSession.assertValidLifecycle(dto);
    return dto as ReviewSession;
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
   * @param dto - Review run DTO from the command boundary.
   * @throws Error when status and archivedAt violate lifecycle invariants.
   */
  assertValidLifecycle(dto: ReviewRun): void {
    if (dto.status === "archived" && dto.archivedAt === null) {
      throw new Error(`Archived review run must have archivedAt: ${dto.id}`);
    }

    if (isNonArchivedStatus(dto.status) && dto.archivedAt !== null) {
      throw new Error(
        `Non-archived review run must not have archivedAt: ${dto.id}`,
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
