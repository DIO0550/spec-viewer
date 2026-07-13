import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type {
  ArchiveUserReviewResponse,
  CreateUserReviewResponse,
  ListUserReviewsRequest,
  ListUserReviewsResponse,
  UserReviewWorkspaceMode,
} from "@/features/review-runs/types/userReviewIpc";
import type { UserReviewCommands } from "@/features/review-runs/application/ports/userReviewCommands";
import type { CommentId } from "@/shared/domain/commentId";

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
  return commands.listUserReviews(
    createListUserReviewsRequest(workspacePath, target, correlationId),
  );
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
  return commands.createUserReview({
    workspacePath,
    target,
    commentIds: param.commentIds,
    workspaceMode: param.workspaceMode,
  });
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
  return commands.archiveUserReview({
    workspacePath,
    target,
    userReviewId,
  });
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
