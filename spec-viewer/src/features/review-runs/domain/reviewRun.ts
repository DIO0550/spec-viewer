import type { IsoDateTimeString } from "@/features/comments/types/comment";
import type {
  ReviewRun,
  ReviewRunStatus,
} from "@/features/review-runs/types/reviewRun";

export type ReviewRunBase = Omit<ReviewRun, "archivedAt" | "status">;

export type ActiveReviewRun = ReviewRunBase &
  Readonly<{
    status: "active";
    archivedAt: null;
  }>;

export type InProgressReviewRun = ReviewRunBase &
  Readonly<{
    status: "inProgress";
    archivedAt: null;
  }>;

export type CompletedReviewRun = ReviewRunBase &
  Readonly<{
    status: "completed";
    archivedAt: null;
  }>;

export type ArchivedReviewRun = ReviewRunBase &
  Readonly<{
    status: "archived";
    archivedAt: IsoDateTimeString;
  }>;

export type NonArchivedReviewRun =
  | ActiveReviewRun
  | InProgressReviewRun
  | CompletedReviewRun;

export type ReviewRunEntity = NonArchivedReviewRun | ArchivedReviewRun;

export const ReviewRunEntity = {
  /** @returns Review run narrowed to a lifecycle variant. */
  fromDto(dto: ReviewRun): ReviewRunEntity {
    ReviewRunEntity.assertValidLifecycle(dto);
    return dto as ReviewRunEntity;
  },

  /** @returns True when the run belongs to archived review-run collection. */
  isArchived(reviewRun: ReviewRunEntity): reviewRun is ArchivedReviewRun {
    return reviewRun.status === "archived";
  },

  /** @returns True when the run belongs to active review-run collection. */
  isNonArchived(reviewRun: ReviewRunEntity): reviewRun is NonArchivedReviewRun {
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

/** @returns True when the status is visible in the active review-run list. */
function isNonArchivedStatus(
  status: ReviewRunStatus,
): status is NonArchivedReviewRun["status"] {
  return status !== "archived";
}
