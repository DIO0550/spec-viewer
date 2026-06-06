import type {
  ArchiveReviewRunResponse,
  CreateReviewRunResponse,
  ListReviewRunsRequest,
  ListReviewRunsResponse,
  ReviewRunExecutionMode,
  ReviewRunTarget,
} from "@/features/review-runs/types/reviewRun";
import type { CommentId } from "@/features/comments/types/comment";
import type { ReviewRunCommands } from "@/shared/api/tauri";

export type CreateReviewRunParam = Readonly<{
  commentIds: readonly CommentId[];
  executionMode: ReviewRunExecutionMode;
}>;

/**
 * @param commands - Review-run command boundary.
 * @param workspacePath - Active workspace path.
 * @param target - Active review-run target.
 * @param correlationId - Optional explicit command correlation id.
 * @returns List review runs response from the command boundary.
 */
export async function listReviewRuns(
  commands: ReviewRunCommands,
  workspacePath: string,
  target: ReviewRunTarget,
  correlationId: string | null,
): Promise<ListReviewRunsResponse> {
  return commands.listReviewRuns(
    createListReviewRunsRequest(workspacePath, target, correlationId),
  );
}

/**
 * @param commands - Review-run command boundary.
 * @param workspacePath - Active workspace path.
 * @param target - Active review-run target.
 * @param param - Review-run creation input.
 * @returns Created review run response from the command boundary.
 */
export async function createReviewRun(
  commands: ReviewRunCommands,
  workspacePath: string,
  target: ReviewRunTarget,
  param: CreateReviewRunParam,
): Promise<CreateReviewRunResponse> {
  return commands.createReviewRun({
    workspacePath,
    target,
    commentIds: param.commentIds,
    executionMode: param.executionMode,
  });
}

/**
 * @param commands - Review-run command boundary.
 * @param workspacePath - Active workspace path.
 * @param target - Active review-run target.
 * @param reviewRunId - Review run id to archive.
 * @returns Archived review run response from the command boundary.
 */
export async function archiveReviewRun(
  commands: ReviewRunCommands,
  workspacePath: string,
  target: ReviewRunTarget,
  reviewRunId: string,
): Promise<ArchiveReviewRunResponse> {
  return commands.archiveReviewRun({
    workspacePath,
    target,
    reviewRunId,
  });
}

/**
 * @param workspacePath - Active workspace path.
 * @param target - Active review-run target.
 * @param correlationId - Optional explicit command correlation id.
 * @returns IPC request for listing review runs.
 */
export function createListReviewRunsRequest(
  workspacePath: string,
  target: ReviewRunTarget,
  correlationId: string | null,
): ListReviewRunsRequest {
  const request: ListReviewRunsRequest = {
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
