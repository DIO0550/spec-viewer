import type { CreateUserReviewCommand } from "@/features/review-runs/domain/createUserReviewCommand";
import {
  type ActiveUserReview,
  type ArchivedUserReview,
  UserReview,
} from "@/features/review-runs/domain/userReview";
import type { UserReviewListOutcome } from "@/features/review-runs/domain/userReviewListOutcome";
import {
  UserReviewTarget,
  type UserReviewTarget as UserReviewTargetType,
} from "@/features/review-runs/domain/userReviewTarget";
import {
  mapListUserReviewsResponseToUserReviews,
  mapUserReviewResponseToUserReview,
} from "@/features/review-runs/infra/userReviewIpcAdapter";
import type { ListUserReviewsRequest } from "@/features/review-runs/types/userReviewIpc";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";

export class UserReviewMutationRestoreError extends Error {
  readonly reason: "createReturnedArchived" | "archiveReturnedActive";
  readonly userReviewId: string;

  /**
   * @param reason - Mutation response status mismatch.
   * @param userReviewId - Restored aggregate identity.
   */
  constructor(
    reason: "createReturnedArchived" | "archiveReturnedActive",
    userReviewId: string,
  ) {
    super(`Invalid user review mutation response ${userReviewId}: ${reason}`);
    this.name = "UserReviewMutationRestoreError";
    this.reason = reason;
    this.userReviewId = userReviewId;
  }
}

export type UserReviewGatewayResponseMismatchReason =
  | "listTargetMismatch"
  | "createTargetMismatch"
  | "createCommentCountMismatch"
  | "archiveIdMismatch"
  | "archiveTargetMismatch"
  | "archiveRecordLocatorMismatch"
  | "archiveCommentCountMismatch"
  | "archiveCreatedAtMismatch";

type UserReviewGatewayResponseMismatchInput = Readonly<{
  reason: UserReviewGatewayResponseMismatchReason;
  userReviewId: string;
}>;

export class UserReviewGatewayResponseMismatchError extends Error {
  readonly reason: UserReviewGatewayResponseMismatchReason;
  readonly userReviewId: string;

  /**
   * @param input - Response mismatch reason and returned review identity.
   */
  constructor(input: UserReviewGatewayResponseMismatchInput) {
    super(
      `Invalid user review gateway response ${input.userReviewId}: ${input.reason}`,
    );
    this.name = "UserReviewGatewayResponseMismatchError";
    this.reason = input.reason;
    this.userReviewId = input.userReviewId;
  }
}

export type CreateUserReviewOutcome = Readonly<{
  userReview: ActiveUserReview;
}>;

export type ArchiveUserReviewOutcome = Readonly<{
  userReview: ArchivedUserReview;
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
  target: UserReviewTargetType,
  correlationId: string | null,
): Promise<UserReviewListOutcome> {
  const response: unknown = await commands.listUserReviews(
    createListUserReviewsRequest(workspacePath, target, correlationId),
  );
  const outcome = mapListUserReviewsResponseToUserReviews(response);
  const mismatched = [...outcome.active, ...outcome.archived].find(
    (userReview) => !UserReviewTarget.equals(userReview.target, target),
  );

  if (mismatched !== undefined) {
    throw new UserReviewGatewayResponseMismatchError({
      reason: "listTargetMismatch",
      userReviewId: mismatched.id,
    });
  }

  return outcome;
}

/**
 * @param commands - User review command boundary.
 * @param command - Validated user review creation command.
 * @returns Created user review response from the command boundary.
 */
export async function createUserReview(
  commands: UserReviewCommands,
  command: CreateUserReviewCommand,
): Promise<CreateUserReviewOutcome> {
  const response: unknown = await commands.createUserReview({
    workspacePath: WorkspacePath.toString(command.workspacePath),
    target: command.target,
    commentIds: command.commentIds,
  });

  const userReview = mapUserReviewResponseToUserReview(response);

  if (!UserReview.isNonArchived(userReview)) {
    throw new UserReviewMutationRestoreError(
      "createReturnedArchived",
      userReview.id,
    );
  }

  if (!UserReviewTarget.equals(userReview.target, command.target)) {
    throw new UserReviewGatewayResponseMismatchError({
      reason: "createTargetMismatch",
      userReviewId: userReview.id,
    });
  }

  if (userReview.commentCount !== command.commentIds.length) {
    throw new UserReviewGatewayResponseMismatchError({
      reason: "createCommentCountMismatch",
      userReviewId: userReview.id,
    });
  }

  return { userReview };
}

/**
 * @param commands - User review command boundary.
 * @param workspacePath - Active workspace path.
 * @param userReview - Active user review to archive.
 * @returns Archived user review response from the command boundary.
 */
export async function archiveUserReview(
  commands: UserReviewCommands,
  workspacePath: string,
  userReview: ActiveUserReview,
): Promise<ArchiveUserReviewOutcome> {
  const response: unknown = await commands.archiveUserReview({
    workspacePath,
    target: userReview.target,
    userReviewId: userReview.id,
  });

  const archivedUserReview = mapUserReviewResponseToUserReview(response);

  if (!UserReview.isArchived(archivedUserReview)) {
    throw new UserReviewMutationRestoreError(
      "archiveReturnedActive",
      archivedUserReview.id,
    );
  }

  if (archivedUserReview.id !== userReview.id) {
    throw new UserReviewGatewayResponseMismatchError({
      reason: "archiveIdMismatch",
      userReviewId: archivedUserReview.id,
    });
  }

  if (!UserReviewTarget.equals(archivedUserReview.target, userReview.target)) {
    throw new UserReviewGatewayResponseMismatchError({
      reason: "archiveTargetMismatch",
      userReviewId: archivedUserReview.id,
    });
  }

  if (archivedUserReview.recordLocator !== userReview.recordLocator) {
    throw new UserReviewGatewayResponseMismatchError({
      reason: "archiveRecordLocatorMismatch",
      userReviewId: archivedUserReview.id,
    });
  }

  if (archivedUserReview.commentCount !== userReview.commentCount) {
    throw new UserReviewGatewayResponseMismatchError({
      reason: "archiveCommentCountMismatch",
      userReviewId: archivedUserReview.id,
    });
  }

  if (archivedUserReview.createdAt !== userReview.createdAt) {
    throw new UserReviewGatewayResponseMismatchError({
      reason: "archiveCreatedAtMismatch",
      userReviewId: archivedUserReview.id,
    });
  }

  return { userReview: archivedUserReview };
}

/**
 * @param workspacePath - Active workspace path.
 * @param target - Active user review target.
 * @param correlationId - Optional explicit command correlation id.
 * @returns IPC request for listing user reviews.
 */
export function createListUserReviewsRequest(
  workspacePath: string,
  target: UserReviewTargetType,
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
