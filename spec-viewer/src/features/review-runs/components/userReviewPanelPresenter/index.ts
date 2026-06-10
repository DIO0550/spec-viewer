import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewListState } from "@/features/review-runs/domain/userReviewListState";

export const userReviewStatusLabels: Readonly<
  Record<UserReview["status"], string>
> = {
  active: "受付中",
  inProgress: "対応中",
  completed: "完了",
  archived: "アーカイブ済み",
};

/**
 * @param input - Open comment count and create operation state.
 * @returns True when a user review can be created.
 */
export function canCreateUserReview(input: {
  openCommentCount: number;
  isCreating: boolean;
}): boolean {
  return input.openCommentCount > 0 && !input.isCreating;
}

/**
 * @param review - User review shown in the active list.
 * @param isSaving - Whether this review is currently being archived.
 * @returns True when a user review can be archived.
 */
export function canArchiveUserReview(
  review: UserReview,
  isSaving: boolean,
): boolean {
  return review.status === "completed" && !isSaving;
}

/**
 * @param openCommentCount - Number of open comments eligible for the review.
 * @returns A Japanese summary for open comments included in a new review.
 */
export function formatOpenCommentSummary(openCommentCount: number): string {
  if (openCommentCount === 0) {
    return "未解決コメントはありません。";
  }

  return `未解決コメント ${openCommentCount}件を対象にできます。`;
}

/**
 * @param userReview - The newly created user review.
 * @returns A Japanese success message for a newly created review.
 */
export function formatCreateSuccessMessage(userReview: UserReview): string {
  return `レビューを作成しました。${userReview.commentCount}件 / ${userReview.folderPath}`;
}

/**
 * @param message - The underlying failure message.
 * @returns A Japanese error message for user review creation failures.
 */
export function formatCreateErrorMessage(message: string): string {
  return `レビューを作成できませんでした。${message}`;
}

/**
 * @param userReview - The archived user review.
 * @returns A Japanese success message for an archived review.
 */
export function formatArchiveSuccessMessage(userReview: UserReview): string {
  return `レビューをアーカイブしました。${userReview.folderPath}`;
}

/**
 * @param message - The underlying failure message.
 * @returns A Japanese error message for archive failures.
 */
export function formatArchiveErrorMessage(message: string): string {
  return `レビューをアーカイブできませんでした。${message}`;
}

/**
 * @param userReview - The active user review to summarize.
 * @returns A compact status and comment summary for an active review.
 */
export function formatUserReviewSummary(userReview: UserReview): string {
  return `${userReviewStatusLabels[userReview.status]} / コメント ${userReview.commentCount}件`;
}

/**
 * @param state - The problem state of a malformed or missing folder entry.
 * @returns A short Japanese label for malformed/missing folder list states.
 */
export function formatProblemState(
  state: UserReviewListState["problems"][number]["state"],
): string {
  if (state === "missingFolder") {
    return "フォルダなし";
  }

  return "壊れたレビュー";
}
