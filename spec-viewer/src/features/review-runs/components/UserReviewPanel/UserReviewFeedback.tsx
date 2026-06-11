import {
  formatArchiveErrorMessage,
  formatArchiveSuccessMessage,
  formatCreateErrorMessage,
  formatCreateSuccessMessage,
} from "@/features/review-runs/components/userReviewPanelPresenter";
import type { PathCopyState } from "@/features/review-runs/domain/pathCopyState";
import type {
  UserReviewArchiveState,
  UserReviewCreateState,
} from "@/features/review-runs/hooks/useUserReviews";

type Props = Readonly<{
  createState: UserReviewCreateState;
  archiveState: UserReviewArchiveState;
  copyState: PathCopyState;
}>;

/** @returns The latest create/copy feedback message. */
export function UserReviewFeedback({
  createState,
  archiveState,
  copyState,
}: Props) {
  if (archiveState.status === "success") {
    return (
      <p
        className="review-run-panel__feedback review-run-panel__feedback--success"
        role="status"
      >
        {formatArchiveSuccessMessage(archiveState.userReview)}
      </p>
    );
  }

  if (archiveState.status === "error") {
    return (
      <p
        className="review-run-panel__feedback review-run-panel__feedback--error"
        role="alert"
      >
        {formatArchiveErrorMessage(archiveState.error.message)}
      </p>
    );
  }

  if (createState.status === "success") {
    return (
      <p
        className="review-run-panel__feedback review-run-panel__feedback--success"
        role="status"
      >
        {formatCreateSuccessMessage(createState.userReview)}
      </p>
    );
  }

  if (createState.status === "error") {
    return (
      <p
        className="review-run-panel__feedback review-run-panel__feedback--error"
        role="alert"
      >
        {formatCreateErrorMessage(createState.error.message)}
      </p>
    );
  }

  if (copyState.status === "idle") {
    return null;
  }

  return (
    <p
      className={`review-run-panel__feedback review-run-panel__feedback--${copyState.status}`}
      role={copyState.status === "error" ? "alert" : "status"}
    >
      {copyState.message}
    </p>
  );
}
