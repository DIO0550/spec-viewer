import { useCallback, useEffect, useState } from "react";

import type { UserReview } from "@/features/review-runs/domain/userReview";
import {
  UserReviewCreateState,
  type CreateUserReviewPayload,
  type UserReviewCreateState as UserReviewCreateStateType,
} from "@/features/review-runs/domain/userReviewOperation";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { createUserReview as createUserReviewViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import type {
  IdentifiedUserReviewListEvent,
  UserReviewViewIdentity,
} from "@/features/review-runs/hooks/userReviewViewIdentity";
import {
  normalizeCommandError,
  type UserReviewCommands,
} from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";

export type CreateUserReviewInput = CreateUserReviewPayload;

export type UseCreateUserReviewOptions = Readonly<{
  workspacePath: WorkspacePath | null;
  target: UserReviewTarget | null;
  viewIdentity: UserReviewViewIdentity;
  commands: UserReviewCommands;
  onUserReviewEvent: (event: IdentifiedUserReviewListEvent) => void;
}>;

type IdentifiedCreateState = Readonly<{
  identity: UserReviewViewIdentity;
  state: UserReviewCreateStateType;
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
  const { commands, onUserReviewEvent, target, viewIdentity, workspacePath } =
    options;
  const [createViewState, setCreateViewState] = useState<IdentifiedCreateState>(
    {
      identity: viewIdentity,
      state: UserReviewCreateState.idle(),
    },
  );

  useEffect(() => {
    setCreateViewState({
      identity: viewIdentity,
      state: UserReviewCreateState.idle(),
    });
  }, [viewIdentity]);

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
      const startedIdentity = viewIdentity;
      setCreateViewState({
        identity: startedIdentity,
        state: UserReviewCreateState.saving(payload),
      });

      try {
        const response = await createUserReviewViaGateway(
          commands,
          WorkspacePath.toString(workspacePath),
          target,
          payload,
        );

        setCreateViewState((current) => {
          if (current.identity !== startedIdentity) {
            return current;
          }

          return {
            identity: startedIdentity,
            state: UserReviewCreateState.success(payload, response.userReview),
          };
        });
        onUserReviewEvent({
          identity: startedIdentity,
          event: {
            type: "reviewCreated",
            review: response.userReview,
          },
        });
        return response.userReview;
      } catch (error) {
        setCreateViewState((current) => {
          if (current.identity !== startedIdentity) {
            return current;
          }

          return {
            identity: startedIdentity,
            state: UserReviewCreateState.error(
              payload,
              normalizeCommandError(error),
            ),
          };
        });
        return null;
      }
    },
    [commands, onUserReviewEvent, target, viewIdentity, workspacePath],
  );

  const createState =
    createViewState.identity === viewIdentity
      ? createViewState.state
      : UserReviewCreateState.idle();

  return {
    createState,
    createUserReview,
  };
}
