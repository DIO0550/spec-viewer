import type { UserReviewListEvent } from "@/features/review-runs/domain/userReviewListState";
import type { UserReviewTargetIdentity } from "@/features/review-runs/domain/userReviewTarget";
import type { WorkspacePath } from "@/shared/domain/workspacePath";

export type UserReviewViewIdentity = string;

export type IdentifiedUserReviewListEvent = Readonly<{
  identity: UserReviewViewIdentity;
  event: UserReviewListEvent;
}>;

/**
 * @param workspacePath - Workspace currently shown by the review UI.
 * @param targetIdentity - Review target identity for the current selection.
 * @returns Stable identity for the review view currently allowed to show updates.
 */
export function createUserReviewViewIdentity(
  workspacePath: WorkspacePath | null,
  targetIdentity: UserReviewTargetIdentity,
): UserReviewViewIdentity {
  return `${workspacePath ?? "none"}:${targetIdentity}`;
}
