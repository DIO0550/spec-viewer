import type { CreateUserReviewCommand } from "@/features/review-runs/domain/createUserReviewCommand";
import type {
  ActiveUserReview,
  ArchivedUserReview,
} from "@/features/review-runs/domain/userReview";
import type { UserReviewListOutcome } from "@/features/review-runs/domain/userReviewListOutcome";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { WorkspacePath } from "@/shared/domain/workspacePath";

export type UserReviewRepositoryErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "invalidSpec"
  | "invalidComment"
  | "commentRepository"
  | "invalidUserReview"
  | "userReviewCollision"
  | "userReviewRepository"
  | "unexpected"
  | "unknown";

export type UserReviewRepositoryError = Readonly<{
  code: UserReviewRepositoryErrorCode;
  message: string;
  cause: unknown;
}>;

export type UserReviewRepositoryResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: UserReviewRepositoryError }>;

export type ListUserReviewsRepositoryInput = Readonly<{
  workspacePath: WorkspacePath;
  target: UserReviewTarget;
  correlationId: string | null;
}>;

export type ArchiveUserReviewRepositoryInput = Readonly<{
  workspacePath: WorkspacePath;
  userReview: ActiveUserReview;
}>;

export type UserReviewRepository = Readonly<{
  /** @returns User reviews for the selected target. */
  list: (
    input: ListUserReviewsRepositoryInput,
  ) => Promise<UserReviewRepositoryResult<UserReviewListOutcome>>;
  /** @returns The newly persisted active user review. */
  create: (
    command: CreateUserReviewCommand,
  ) => Promise<UserReviewRepositoryResult<ActiveUserReview>>;
  /** @returns The persisted archived user review. */
  archive: (
    input: ArchiveUserReviewRepositoryInput,
  ) => Promise<UserReviewRepositoryResult<ArchivedUserReview>>;
}>;
