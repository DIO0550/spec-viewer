import { useCallback, useEffect, useRef, useState } from "react";

import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewListEvent } from "@/features/review-runs/domain/userReviewListState";
import {
  UserReviewCreateState,
  type CreateUserReviewPayload,
  type UserReviewCreateState as UserReviewCreateStateType,
} from "@/features/review-runs/domain/userReviewOperation";
import type {
  UserReviewTarget,
  UserReviewTargetIdentity,
} from "@/features/review-runs/domain/userReviewTarget";
import { createUserReview as createUserReviewViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import { useUserReviewAsyncGuard } from "@/features/review-runs/hooks/useUserReviewAsyncGuard";
import {
  normalizeCommandError,
  type UserReviewCommands,
} from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";

export type CreateUserReviewInput = CreateUserReviewPayload;

export type UseCreateUserReviewOptions = Readonly<{
  workspacePath: WorkspacePath | null;
  target: UserReviewTarget | null;
  targetIdentity: UserReviewTargetIdentity;
  commands: UserReviewCommands;
  onUserReviewEvent: (event: UserReviewListEvent) => void;
}>;

export type UseCreateUserReviewResult = Readonly<{
  createState: UserReviewCreateStateType;
  createUserReview: (
    input: CreateUserReviewInput,
  ) => Promise<UserReview | null>;
}>;

/** @returns User review create state and callback for the active target. */
export function useCreateUserReview(
  options: UseCreateUserReviewOptions,
): UseCreateUserReviewResult {
  const { commands, onUserReviewEvent, target, targetIdentity, workspacePath } =
    options;
  const guard = useUserReviewAsyncGuard();
  const operationIdentity = createOperationIdentity(
    workspacePath,
    targetIdentity,
  );
  const previousOperationIdentityRef = useRef(operationIdentity);
  const [createState, setCreateState] = useState<UserReviewCreateStateType>(
    UserReviewCreateState.idle(),
  );

  guard.setCurrentIdentity(operationIdentity);

  const createUserReview = useCallback(
    async (input: CreateUserReviewInput): Promise<UserReview | null> => {
      if (
        workspacePath === null ||
        target === null ||
        input.commentIds.length === 0
      ) {
        return null;
      }

      const payload = input;
      const operation = guard.begin(operationIdentity);
      setCreateState(UserReviewCreateState.saving(payload));

      try {
        const response = await createUserReviewViaGateway(
          commands,
          WorkspacePath.toString(workspacePath),
          target,
          payload,
        );

        if (!guard.isCurrent(operation)) {
          return null;
        }

        setCreateState(
          UserReviewCreateState.success(payload, response.userReview),
        );
        onUserReviewEvent({
          type: "reviewCreated",
          review: response.userReview,
        });
        return response.userReview;
      } catch (error) {
        if (!guard.isCurrent(operation)) {
          return null;
        }

        setCreateState(
          UserReviewCreateState.error(payload, normalizeCommandError(error)),
        );
        return null;
      }
    },
    [
      commands,
      guard,
      onUserReviewEvent,
      operationIdentity,
      target,
      workspacePath,
    ],
  );

  useEffect(() => {
    if (previousOperationIdentityRef.current === operationIdentity) {
      return;
    }

    previousOperationIdentityRef.current = operationIdentity;
    guard.invalidate();
    setCreateState(UserReviewCreateState.idle());
  }, [guard, operationIdentity]);

  return {
    createState,
    createUserReview,
  };
}

/** @returns Async operation identity scoped by workspace and target. */
function createOperationIdentity(
  workspacePath: WorkspacePath | null,
  targetIdentity: UserReviewTargetIdentity,
): UserReviewTargetIdentity {
  return `${workspacePath ?? "none"}:${targetIdentity}`;
}
