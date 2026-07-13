import type { NonEmptyCommentIds } from "@/features/review-runs/domain/userReviewOperation";
import {
  UserReviewTarget,
  type UserReviewTarget as UserReviewTargetType,
} from "@/features/review-runs/domain/userReviewTarget";
import type { WorkspacePath } from "@/shared/domain/workspacePath";

export type CreateUserReviewCommand = Readonly<{
  workspacePath: WorkspacePath;
  target: UserReviewTargetType;
  commentIds: NonEmptyCommentIds;
}>;

export type CreateUserReviewCommandInput = Readonly<{
  workspacePath: WorkspacePath | null;
  target: UserReviewTargetType | null;
  commentIds: readonly NonEmptyCommentIds[number][];
}>;

export type CreateUserReviewCommandErrorReason =
  | "missingWorkspace"
  | "missingTarget"
  | "invalidTarget"
  | "emptyCommentSelection"
  | "duplicateCommentId";

export type CreateUserReviewCommandResult =
  | Readonly<{ ok: true; command: CreateUserReviewCommand }>
  | Readonly<{
      ok: false;
      error: Readonly<{ reason: CreateUserReviewCommandErrorReason }>;
    }>;

export const CreateUserReviewCommand = {
  /**
   * @param input - Current workspace, target, and selected comment IDs.
   * @returns Valid create command or a typed eligibility error.
   */
  create(input: CreateUserReviewCommandInput): CreateUserReviewCommandResult {
    if (input.workspacePath === null) {
      return failure("missingWorkspace");
    }

    if (input.target === null) {
      return failure("missingTarget");
    }

    if (!UserReviewTarget.isValid(input.target)) {
      return failure("invalidTarget");
    }

    if (input.commentIds.length === 0) {
      return failure("emptyCommentSelection");
    }

    if (new Set(input.commentIds).size !== input.commentIds.length) {
      return failure("duplicateCommentId");
    }

    return {
      ok: true,
      command: {
        workspacePath: input.workspacePath,
        target: input.target,
        commentIds: [
          input.commentIds[0] as NonEmptyCommentIds[number],
          ...input.commentIds.slice(1),
        ],
      },
    };
  },
} as const;

/**
 * @param reason - Typed create-command validation failure.
 * @returns Failed create-command result.
 */
function failure(
  reason: CreateUserReviewCommandErrorReason,
): CreateUserReviewCommandResult {
  return { ok: false, error: { reason } };
}
