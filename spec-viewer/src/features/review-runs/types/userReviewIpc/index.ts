import type {
  ReviewSourceFile,
  UserReview,
  UserReviewStatus,
  UserReviewWorkspace,
} from "@/features/review-runs/domain/userReview";
import type { UserReviewListProblem } from "@/features/review-runs/domain/userReviewListProblem";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { UserReviewWorkspaceMode } from "@/features/review-runs/domain/userReviewWorkspaceMode";
import type { CommentId } from "@/shared/domain/commentId";
import type { IsoDateTimeString } from "@/shared/domain/isoDateTime";
export type {
  UserReviewListProblem,
  UserReviewListProblemState,
} from "@/features/review-runs/domain/userReviewListProblem";
export type { UserReviewWorkspaceMode } from "@/features/review-runs/domain/userReviewWorkspaceMode";

export type { UserReview };

export type ReviewBundleSchemaVersion = "spec-reviewer.review-run.v1";

export type ReviewBundleManifest = Readonly<{
  schemaVersion: ReviewBundleSchemaVersion;
  id: string;
  status: UserReviewStatus;
  workspacePath: string;
  target: UserReviewTarget;
  specFolderPath: string;
  workspace: UserReviewWorkspace;
  sourceFiles: readonly ReviewSourceFile[];
  commentIds: readonly CommentId[];
  createdAt: IsoDateTimeString;
  archivedAt: IsoDateTimeString | null;
}>;

export type ReviewBundleStatusDocument = Readonly<{
  status: UserReviewStatus;
  updatedAt: IsoDateTimeString;
  summary: string | null;
  warnings: readonly string[];
}>;

export type UserReviewExecutionMode = UserReviewWorkspaceMode;
export type UserReviewExecutionTarget = UserReviewWorkspace;
export type UserReviewSourceFile = ReviewSourceFile;
export type UserReviewManifest = ReviewBundleManifest;
export type UserReviewStatusDocument = ReviewBundleStatusDocument;

export type CreateUserReviewRequest = Readonly<{
  workspacePath: string;
  target: UserReviewTarget;
  commentIds: readonly CommentId[];
  workspaceMode: UserReviewWorkspaceMode;
}>;

export type CreateUserReviewResponse = Readonly<{
  userReview: UserReview;
}>;

export type ListUserReviewsRequest = Readonly<{
  workspacePath: string;
  target: UserReviewTarget;
  correlationId?: string;
}>;

export type ListUserReviewsResponse = Readonly<{
  active: readonly UserReview[];
  archived: readonly UserReview[];
  problems: readonly UserReviewListProblem[];
}>;

export type ArchiveUserReviewRequest = Readonly<{
  workspacePath: string;
  target: UserReviewTarget;
  userReviewId: string;
}>;

export type ArchiveUserReviewResponse = Readonly<{
  userReview: UserReview;
}>;

export type UserReviewCommandPayloads = Readonly<{
  create_user_review: Readonly<{
    request: CreateUserReviewRequest;
    response: CreateUserReviewResponse;
  }>;
  list_user_reviews: Readonly<{
    request: ListUserReviewsRequest;
    response: ListUserReviewsResponse;
  }>;
  archive_user_review: Readonly<{
    request: ArchiveUserReviewRequest;
    response: ArchiveUserReviewResponse;
  }>;
}>;
