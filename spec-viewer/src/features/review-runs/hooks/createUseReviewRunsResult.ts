import type { ReviewRunListState } from "@/features/review-runs/domain/reviewRunListState";
import type { UseReviewRunOperationsResult } from "@/features/review-runs/hooks/useReviewRunOperations";
import type { UseReviewRunsResult } from "@/features/review-runs/hooks/useReviewRuns";
import type { ReviewRunTarget } from "@/features/review-runs/types/reviewRun";

export type CreateUseReviewRunsResultInput = Readonly<{
  target: ReviewRunTarget | null;
  listState: ReviewRunListState;
  reviewRunOperations: UseReviewRunOperationsResult;
  reloadReviewRuns: () => Promise<boolean>;
}>;

/**
 * @param input - Current target, list state, operation callbacks, and reload function.
 * @returns Public result object exposed by useReviewRuns.
 */
export function createUseReviewRunsResult({
  target,
  listState,
  reviewRunOperations,
  reloadReviewRuns,
}: CreateUseReviewRunsResultInput): UseReviewRunsResult {
  return {
    target,
    listState,
    createState: reviewRunOperations.createState,
    archiveState: reviewRunOperations.archiveState,
    activeRuns: listState.active,
    archivedRuns: listState.archived,
    reloadReviewRuns,
    createReviewRun: reviewRunOperations.createReviewRun,
    archiveReviewRun: reviewRunOperations.archiveReviewRun,
  };
}
