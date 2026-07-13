import type {
  ActiveUserReview,
  ArchivedUserReview,
} from "@/features/review-runs/domain/userReview";
import type { UserReviewRecordProblem } from "@/features/review-runs/domain/userReviewRecordProblem";

export type UserReviewListOutcome = Readonly<{
  active: readonly ActiveUserReview[];
  archived: readonly ArchivedUserReview[];
  problems: readonly UserReviewRecordProblem[];
}>;
