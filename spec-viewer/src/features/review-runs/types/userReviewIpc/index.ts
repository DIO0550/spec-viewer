import type { CommentId } from "@/features/comments/types/comment";
import type {
  StoredUserReview,
  UserReview,
} from "@/features/review-runs/domain/userReview";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";

export type { UserReview };

export type UserReviewDto = StoredUserReview;

export type UserReviewListProblemDtoKind =
  | "legacyFolderBundle"
  | "unsupportedSchemaVersion"
  | "malformedDocument"
  | "recoverableDuplicate"
  | "conflictingCopies";

export type UserReviewListProblemDto = Readonly<{
  recordLocator: string;
  kind: UserReviewListProblemDtoKind;
  message: string;
}>;

export type CreateUserReviewRequest = Readonly<{
  workspacePath: string;
  target: UserReviewTarget;
  commentIds: readonly CommentId[];
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
  problems: readonly UserReviewListProblemDto[];
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
