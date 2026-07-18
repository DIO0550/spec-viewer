import type { CommentId } from "@/features/comments/domain/commentId";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import {
  mapListUserReviewsResponseToUserReviews,
  mapUserReviewDtoToUserReview,
} from "@/features/review-runs/infra/userReviewIpcAdapter";
import type {
  ArchiveUserReviewResponse,
  CreateUserReviewResponse,
  ListUserReviewsRequest,
  ListUserReviewsResponse,
  UserReviewWorkspaceMode,
} from "@/features/review-runs/types/userReviewIpc";
import type { UserReviewCommands } from "@/shared/api/tauri";

export type CreateUserReviewParam = Readonly<{
  commentIds: readonly CommentId[];
  workspaceMode: UserReviewWorkspaceMode;
}>;

/**
 * @param commands - User review command boundary.
 * @param workspacePath - Active workspace path.
 * @param target - Active user review target.
 * @param correlationId - Optional explicit command correlation id.
 * @returns List user reviews response from the command boundary.
 */
export async function listUserReviews(
  commands: UserReviewCommands,
  workspacePath: string,
  target: UserReviewTarget,
  correlationId: string | null,
): Promise<ListUserReviewsResponse> {
  const response = await commands.listUserReviews(
    createListUserReviewsRequest(workspacePath, target, correlationId),
  );

  return mapListUserReviewsResponseToUserReviews(response);
}

/**
 * @param commands - User review command boundary.
 * @param workspacePath - Active workspace path.
 * @param target - Active user review target.
 * @param param - User review creation input.
 * @returns Created user review response from the command boundary.
 */
export async function createUserReview(
  commands: UserReviewCommands,
  workspacePath: string,
  target: UserReviewTarget,
  param: CreateUserReviewParam,
): Promise<CreateUserReviewResponse> {
  const response = await commands.createUserReview({
    workspacePath,
    target,
    commentIds: param.commentIds,
    workspaceMode: param.workspaceMode,
  });

  return {
    userReview: mapUserReviewDtoToUserReview(response.userReview),
  };
}

/**
 * @param commands - User review command boundary.
 * @param workspacePath - Active workspace path.
 * @param target - Active user review target.
 * @param userReviewId - User review id to archive.
 * @returns Archived user review response from the command boundary.
 */
export async function archiveUserReview(
  commands: UserReviewCommands,
  workspacePath: string,
  target: UserReviewTarget,
  userReviewId: string,
): Promise<ArchiveUserReviewResponse> {
  const response = await commands.archiveUserReview({
    workspacePath,
    target,
    userReviewId,
  });

  return {
    userReview: mapUserReviewDtoToUserReview(response.userReview),
  };
}

/**
 * @param workspacePath - Active workspace path.
 * @param target - Active user review target.
 * @param correlationId - Optional explicit command correlation id.
 * @returns IPC request for listing user reviews.
 */
export function createListUserReviewsRequest(
  workspacePath: string,
  target: UserReviewTarget,
  correlationId: string | null,
): ListUserReviewsRequest {
  const request: ListUserReviewsRequest = {
    workspacePath,
    target,
  };

  if (correlationId === null) {
    return request;
  }

  return {
    ...request,
    correlationId,
  };
}
