import type { CommentId } from "@/features/comments";
import type {
  ReviewSourceFile,
  UserReview,
  UserReviewStatus,
  UserReviewWorkspace,
} from "@/features/review-runs/domain/userReview";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { IsoDateTimeString } from "@/shared/types/isoDateTime";

export type { UserReview };

export type ReviewBundleSchemaVersion = "spec-reviewer.review-run.v1";

export type UserReviewWorkspaceMode = "currentWorkspace" | "worktree";

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

export type UserReviewListProblemState = "malformed" | "missingFolder";

export type UserReviewListProblem = Readonly<{
  folderPath: string;
  state: UserReviewListProblemState;
  message: string;
}>;

export type UserReviewDto = UserReview;
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
  userReview: UserReviewDto;
}>;

export type ListUserReviewsRequest = Readonly<{
  workspacePath: string;
  target: UserReviewTarget;
  correlationId?: string;
}>;

export type ListUserReviewsResponse = Readonly<{
  active: readonly UserReviewDto[];
  archived: readonly UserReviewDto[];
  problems: readonly UserReviewListProblem[];
}>;

export type ArchiveUserReviewRequest = Readonly<{
  workspacePath: string;
  target: UserReviewTarget;
  userReviewId: string;
}>;

export type ArchiveUserReviewResponse = Readonly<{
  userReview: UserReviewDto;
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
