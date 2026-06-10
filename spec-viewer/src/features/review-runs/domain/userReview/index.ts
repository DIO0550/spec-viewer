import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { IsoDateTimeString } from "@/shared/types/isoDateTime";
import type { SpecFileKey } from "@/shared/types/specFileKey";

export type UserReviewStatus =
  | "active"
  | "inProgress"
  | "completed"
  | "archived";

export const UserReviewStatus = {
  /** @returns True when the status belongs to archived collection. */
  isArchived(status: UserReviewStatus): status is ArchivedUserReview["status"] {
    return status === "archived";
  },

  /** @returns True when the status is visible in the active user review list. */
  isNonArchived(
    status: UserReviewStatus,
  ): status is NonArchivedUserReview["status"] {
    return status !== "archived";
  },
} as const;

export type UserReviewWorkspace =
  | Readonly<{
      mode: "currentWorkspace";
      workspacePath: string;
    }>
  | Readonly<{
      mode: "worktree";
      repositoryPath: string;
      worktreePath: string;
      branchName: string;
    }>;

export type ReviewSourceFile = Readonly<{
  specId: string;
  fileKey: SpecFileKey;
  relativePath: string;
}>;

export type UserReviewBase = Readonly<{
  id: string;
  target: UserReviewTarget;
  workspace: UserReviewWorkspace;
  specFolderPath: string;
  folderPath: string;
  sourceFiles: readonly ReviewSourceFile[];
  commentCount: number;
  createdAt: IsoDateTimeString;
  summary: string | null;
  warnings: readonly string[];
}>;

export type ActiveUserReview = UserReviewBase &
  Readonly<{
    status: "active";
    archivedAt: null;
  }>;

export type InProgressUserReview = UserReviewBase &
  Readonly<{
    status: "inProgress";
    archivedAt: null;
  }>;

export type CompletedUserReview = UserReviewBase &
  Readonly<{
    status: "completed";
    archivedAt: null;
  }>;

export type ArchivedUserReview = UserReviewBase &
  Readonly<{
    status: "archived";
    archivedAt: IsoDateTimeString;
  }>;

export type NonArchivedUserReview =
  | ActiveUserReview
  | InProgressUserReview
  | CompletedUserReview;

export type UserReview = NonArchivedUserReview | ArchivedUserReview;
export type StoredUserReview = UserReviewBase &
  Readonly<{
    status: UserReviewStatus;
    archivedAt: IsoDateTimeString | null;
  }>;

export type UserReviewArchiveStateErrorReason =
  | "archivedMissingArchivedAt"
  | "nonArchivedHasArchivedAt";
export type UserReviewArchiveStateError = Readonly<{
  reason: UserReviewArchiveStateErrorReason;
  id: string;
  message: string;
}>;

export const UserReview = {
  /** @returns True when the review belongs to archived collection. */
  isArchived(userReview: UserReview): userReview is ArchivedUserReview {
    return UserReviewStatus.isArchived(userReview.status);
  },

  /** @returns True when the review belongs to active collection. */
  isNonArchived(userReview: UserReview): userReview is NonArchivedUserReview {
    return UserReviewStatus.isNonArchived(userReview.status);
  },
} as const;
