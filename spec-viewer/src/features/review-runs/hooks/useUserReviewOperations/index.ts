import { useCallback, useEffect, useRef, useState } from "react";
import type { CommentId } from "@/features/comments/types/comment";
import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewCollectionTransform } from "@/features/review-runs/domain/userReviewCollection";
import { UserReviewCollection } from "@/features/review-runs/domain/userReviewCollection";
import {
  UserReviewArchiveState,
  type UserReviewArchiveState as UserReviewArchiveStateType,
  UserReviewCreateState,
  type UserReviewCreateState as UserReviewCreateStateType,
} from "@/features/review-runs/domain/userReviewOperation";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { UserReviewAsyncToken } from "@/features/review-runs/hooks/userReviewAsyncToken";
import {
  archiveUserReview as archiveUserReviewViaGateway,
  createUserReview as createUserReviewViaGateway,
} from "@/features/review-runs/infra/userReviewGateway";
import type { UserReviewWorkspaceMode } from "@/features/review-runs/types/userReviewIpc";
import {
  normalizeCommandError,
  type UserReviewCommands,
} from "@/shared/api/tauri";

export type CreateUserReviewInput = Readonly<{
  commentIds: readonly CommentId[];
  workspaceMode: UserReviewWorkspaceMode;
}>;

export type UseUserReviewOperationsOptions = Readonly<{
  workspacePath: string | null;
  target: UserReviewTarget | null;
  targetIdentity: string;
  commands: UserReviewCommands;
  /** @param transform - Transform applied to the current target's review collection */
  updateCurrentTargetReviews: (
    transform: UserReviewCollectionTransform,
  ) => void;
}>;

export type UseUserReviewOperationsResult = Readonly<{
  createState: UserReviewCreateStateType;
  archiveState: UserReviewArchiveStateType;
  /** @param input - User review creation input for the active target */
  createUserReview: (
    input: CreateUserReviewInput,
  ) => Promise<UserReview | null>;
  /** @param userReviewId - Identifier of the user review to archive */
  archiveUserReview: (userReviewId: string) => Promise<UserReview | null>;
}>;

/**
 * @param options - Active target, command boundary, and list update callback.
 * @returns User review create/archive states and operation callbacks.
 */
export function useUserReviewOperations(
  options: UseUserReviewOperationsOptions,
): UseUserReviewOperationsResult {
  const {
    commands,
    target,
    targetIdentity,
    updateCurrentTargetReviews,
    workspacePath,
  } = options;
  const createRequestIdRef = useRef(0);
  const archiveRequestIdRef = useRef(0);
  const operationIdentity = createOperationIdentity(
    workspacePath,
    targetIdentity,
  );
  const activeOperationIdentityRef = useRef(operationIdentity);
  const [createState, setCreateState] = useState<UserReviewCreateStateType>(
    UserReviewCreateState.idle(),
  );
  const [archiveState, setArchiveState] = useState<UserReviewArchiveStateType>(
    UserReviewArchiveState.idle(),
  );

  activeOperationIdentityRef.current = operationIdentity;

  const createUserReview = useCallback(
    async (input: CreateUserReviewInput): Promise<UserReview | null> => {
      if (
        workspacePath === null ||
        target === null ||
        input.commentIds.length === 0
      ) {
        return null;
      }

      const operation = UserReviewAsyncToken.create(
        createRequestIdRef.current + 1,
        operationIdentity,
      );
      createRequestIdRef.current = operation.requestId;
      setCreateState(UserReviewCreateState.saving());

      try {
        const response = await createUserReviewViaGateway(
          commands,
          workspacePath,
          target,
          input,
        );

        if (
          !UserReviewAsyncToken.isCurrent(
            operation,
            activeOperationIdentityRef.current,
            createRequestIdRef.current,
          )
        ) {
          return null;
        }

        setCreateState(UserReviewCreateState.success(response.userReview));
        updateCurrentTargetReviews((collection) =>
          UserReviewCollection.addCreated(collection, response.userReview),
        );
        return response.userReview;
      } catch (error) {
        if (
          !UserReviewAsyncToken.isCurrent(
            operation,
            activeOperationIdentityRef.current,
            createRequestIdRef.current,
          )
        ) {
          return null;
        }

        setCreateState(
          UserReviewCreateState.error(normalizeCommandError(error)),
        );
        return null;
      }
    },
    [
      commands,
      operationIdentity,
      target,
      updateCurrentTargetReviews,
      workspacePath,
    ],
  );

  const archiveUserReview = useCallback(
    async (userReviewId: string): Promise<UserReview | null> => {
      if (workspacePath === null || target === null) {
        return null;
      }

      const operation = UserReviewAsyncToken.create(
        archiveRequestIdRef.current + 1,
        operationIdentity,
      );
      archiveRequestIdRef.current = operation.requestId;
      setArchiveState(UserReviewArchiveState.saving(userReviewId));

      try {
        const response = await archiveUserReviewViaGateway(
          commands,
          workspacePath,
          target,
          userReviewId,
        );

        if (
          !UserReviewAsyncToken.isCurrent(
            operation,
            activeOperationIdentityRef.current,
            archiveRequestIdRef.current,
          )
        ) {
          return null;
        }

        setArchiveState(
          UserReviewArchiveState.success(userReviewId, response.userReview),
        );
        updateCurrentTargetReviews((collection) =>
          UserReviewCollection.moveArchived(collection, response.userReview),
        );
        return response.userReview;
      } catch (error) {
        if (
          !UserReviewAsyncToken.isCurrent(
            operation,
            activeOperationIdentityRef.current,
            archiveRequestIdRef.current,
          )
        ) {
          return null;
        }

        setArchiveState(
          UserReviewArchiveState.error(
            userReviewId,
            normalizeCommandError(error),
          ),
        );
        return null;
      }
    },
    [
      commands,
      operationIdentity,
      target,
      updateCurrentTargetReviews,
      workspacePath,
    ],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies(operationIdentity): 操作対象の切り替えを契機に進行中操作を無効化し状態を初期化するための意図的な依存
  useEffect(() => {
    createRequestIdRef.current += 1;
    archiveRequestIdRef.current += 1;
    setCreateState(UserReviewCreateState.idle());
    setArchiveState(UserReviewArchiveState.idle());
  }, [operationIdentity]);

  return {
    createState,
    archiveState,
    createUserReview,
    archiveUserReview,
  };
}

/** @returns Identity for async operation invalidation. */
function createOperationIdentity(
  workspacePath: string | null,
  targetIdentity: string,
): string {
  return `${workspacePath ?? "none"}:${targetIdentity}`;
}
