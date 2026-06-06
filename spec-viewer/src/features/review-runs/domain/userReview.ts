import type { IsoDateTimeString } from "@/features/comments/types/comment";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { SpecFileKey } from "@/features/specs/types/spec";

export type UserReviewStatus =
  | "active"
  | "inProgress"
  | "completed"
  | "archived";

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
export type UserReviewRestoreInput = UserReviewBase &
  Readonly<{
    status: UserReviewStatus;
    archivedAt: IsoDateTimeString | null;
  }>;

export const UserReview = {
  /** @returns User review restored from a boundary-safe domain input. */
  restore(userReview: UserReviewRestoreInput): UserReview {
    UserReview.assertValidLifecycle(userReview);
    return userReview as UserReview;
  },

  /** @returns True when the review belongs to archived collection. */
  isArchived(userReview: UserReview): userReview is ArchivedUserReview {
    return userReview.status === "archived";
  },

  /** @returns True when the review belongs to active collection. */
  isNonArchived(
    userReview: UserReview,
  ): userReview is NonArchivedUserReview {
    return userReview.status !== "archived";
  },

  /**
   * @param userReview - User review shaped for domain restoration.
   * @throws Error when status and archivedAt violate lifecycle invariants.
   */
  assertValidLifecycle(userReview: UserReviewRestoreInput): void {
    if (userReview.status === "archived" && userReview.archivedAt === null) {
      throw new Error(
        `Archived user review must have archivedAt: ${userReview.id}`,
      );
    }

    if (
      isNonArchivedStatus(userReview.status) &&
      userReview.archivedAt !== null
    ) {
      throw new Error(
        `Non-archived user review must not have archivedAt: ${userReview.id}`,
      );
    }
  },
} as const;

/** @returns True when the status is visible in the active user review list. */
function isNonArchivedStatus(
  status: UserReviewStatus,
): status is NonArchivedUserReview["status"] {
  return status !== "archived";
}
