import { useCallback, useEffect, useRef, useState } from "react";

import type { UserReview } from "@/features/review-runs/domain/userReview";
import {
  UserReviewCreateState,
  type CreateUserReviewPayload,
  type UserReviewCreateState as UserReviewCreateStateType,
} from "@/features/review-runs/domain/userReviewOperation";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { createUserReview as createUserReviewViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import type {
  KeyedUserReviewListEvent,
  SpecViewSelectionKey,
} from "@/features/review-runs/hooks/userReviewSelectionKey";
import {
  normalizeCommandError,
  type UserReviewCommands,
} from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";

export type CreateUserReviewInput = CreateUserReviewPayload;

export type UseCreateUserReviewOptions = Readonly<{
  workspacePath: WorkspacePath | null;
  target: UserReviewTarget | null;
  selectionKey: SpecViewSelectionKey;
  commands: UserReviewCommands;
  onUserReviewEvent: (event: KeyedUserReviewListEvent) => void;
}>;

type KeyedCreateState = Readonly<{
  selectionKey: SpecViewSelectionKey;
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
  const { commands, onUserReviewEvent, target, selectionKey, workspacePath } =
    options;
  const requestIdRef = useRef(0);
  const [createViewState, setCreateViewState] = useState<KeyedCreateState>({
    selectionKey,
    state: UserReviewCreateState.idle(),
  });

  useEffect(() => {
    requestIdRef.current += 1;
    setCreateViewState({
      selectionKey,
      state: UserReviewCreateState.idle(),
    });
  }, [selectionKey]);

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
      const startedSelectionKey = selectionKey;
      const startedRequestId = requestIdRef.current + 1;
      requestIdRef.current = startedRequestId;
      setCreateViewState({
        selectionKey: startedSelectionKey,
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
          if (
            current.selectionKey !== startedSelectionKey ||
            requestIdRef.current !== startedRequestId
          ) {
            return current;
          }

          return {
            selectionKey: startedSelectionKey,
            state: UserReviewCreateState.success(payload, response.userReview),
          };
        });
        if (requestIdRef.current === startedRequestId) {
          onUserReviewEvent({
            selectionKey: startedSelectionKey,
            event: {
              type: "reviewCreated",
              review: response.userReview,
            },
          });
        }
        return response.userReview;
      } catch (error) {
        setCreateViewState((current) => {
          if (
            current.selectionKey !== startedSelectionKey ||
            requestIdRef.current !== startedRequestId
          ) {
            return current;
          }

          return {
            selectionKey: startedSelectionKey,
            state: UserReviewCreateState.error(
              payload,
              normalizeCommandError(error),
            ),
          };
        });
        return null;
      }
    },
    [commands, onUserReviewEvent, target, selectionKey, workspacePath],
  );

  const createState =
    createViewState.selectionKey === selectionKey
      ? createViewState.state
      : UserReviewCreateState.idle();

  return {
    createState,
    createUserReview,
  };
}
