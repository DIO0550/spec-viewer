import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewRecordProblemKind } from "@/features/review-runs/domain/userReviewRecordProblem";

export const userReviewStatusLabels: Readonly<
  Record<UserReview["status"], string>
> = {
  active: "受付中",
  archived: "アーカイブ済み",
};

export type UserReviewRecordProblemPresentation = Readonly<{
  label: string;
  description: string;
}>;

const userReviewRecordProblemPresentations: Readonly<
  Record<UserReviewRecordProblemKind, UserReviewRecordProblemPresentation>
> = {
  legacyRecord: {
    label: "旧形式のレビュー",
    description: "フォルダ形式のレビューは一覧に表示できません。",
  },
  unsupportedRecordVersion: {
    label: "未対応のバージョン",
    description: "このレビューは新しいバージョンで作成されています。",
  },
  malformedRecord: {
    label: "壊れたレビュー",
    description: "レビューJSONの内容を読み取れませんでした。",
  },
  recoverableDuplicate: {
    label: "重複レコードを復旧",
    description: "同じレビューの重複から有効なレコードを使用しました。",
  },
  conflictingCopies: {
    label: "競合するレコード",
    description: "同じレビューIDを持つ異なるレコードがあります。",
  },
};

/**
 * @param openCommentCount - Number of open comments to be included.
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
 * @returns A Japanese success message for user review creation.
 */
export function formatCreateSuccessMessage(userReview: UserReview): string {
  return `レビューを作成しました。${userReview.commentCount}件 / ${userReview.recordLocator}`;
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
  return `レビューをアーカイブしました。${userReview.recordLocator}`;
}

/**
 * @param message - The underlying failure message.
 * @returns A Japanese error message for archive failures.
 */
export function formatArchiveErrorMessage(message: string): string {
  return `レビューをアーカイブできませんでした。${message}`;
}

/**
 * @param userReview - The user review to summarize.
 * @returns A compact status and comment summary.
 */
export function formatUserReviewSummary(userReview: UserReview): string {
  return `${userReviewStatusLabels[userReview.status]} / コメント ${userReview.commentCount}件`;
}

/**
 * @param kind - Typed record problem produced by the domain boundary.
 * @returns Japanese label and description for the problem kind.
 */
export function formatUserReviewRecordProblem(
  kind: UserReviewRecordProblemKind,
): UserReviewRecordProblemPresentation {
  return userReviewRecordProblemPresentations[kind];
}
