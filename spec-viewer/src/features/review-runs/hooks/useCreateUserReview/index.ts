import { useCallback, useEffect, useRef, useState } from "react";

import type { UserReview } from "@/features/review-runs/domain/userReview";
import { UserReviewFeatureError } from "@/features/review-runs/domain/userReviewError";
import {
  type CreateUserReviewPayload,
  UserReviewCreateState,
  type UserReviewCreateState as UserReviewCreateStateType,
} from "@/features/review-runs/domain/userReviewOperation";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { UserReviewListEventWithSelectionId } from "@/features/review-runs/hooks/useUserReviewList";
import { createUserReview as createUserReviewViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { CreateUserReviewCommandError } from "@/shared/api/tauri/createUserReview";
import { WorkspacePath } from "@/shared/domain/workspacePath";

type SelectionId = string;

export type CreateUserReviewInput = CreateUserReviewPayload;

export type UseCreateUserReviewOptions = Readonly<{
  workspacePath: WorkspacePath | null;
  target: UserReviewTarget | null;
  selectionId: SelectionId;
  commands: UserReviewCommands;
  /** Handles a list event. @param event - The user review list event. */
  onUserReviewEvent: (event: UserReviewListEventWithSelectionId) => void;
}>;

type SelectionIdCreateState = Readonly<{
  selectionId: SelectionId;
  state: UserReviewCreateStateType;
}>;

export type UseCreateUserReviewResult = Readonly<{
  createState: UserReviewCreateStateType;
  /** Creates a user review. @param input - The create-review input. */
  createUserReview: (
    input: CreateUserReviewInput,
  ) => Promise<UserReview | null>;
}>;

/** @returns User review create state and callback for the active target. */
export function useCreateUserReview(
  options: UseCreateUserReviewOptions,
): UseCreateUserReviewResult {
  const { commands, onUserReviewEvent, target, selectionId, workspacePath } =
    options;
  const requestIdRef = useRef(0);
  const [createViewState, setCreateViewState] =
    useState<SelectionIdCreateState>({
      selectionId,
      state: UserReviewCreateState.idle(),
    });

  useEffect(() => {
    requestIdRef.current += 1;
    setCreateViewState({
      selectionId,
      state: UserReviewCreateState.idle(),
    });
  }, [selectionId]);

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
      const startedSelectionId = selectionId;
      const startedRequestId = requestIdRef.current + 1;
      requestIdRef.current = startedRequestId;
      setCreateViewState({
        selectionId: startedSelectionId,
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
            current.selectionId !== startedSelectionId ||
            requestIdRef.current !== startedRequestId
          ) {
            return current;
          }

          return {
            selectionId: startedSelectionId,
            state: UserReviewCreateState.success(payload, response.userReview),
          };
        });
        if (requestIdRef.current === startedRequestId) {
          onUserReviewEvent({
            selectionId: startedSelectionId,
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
            current.selectionId !== startedSelectionId ||
            requestIdRef.current !== startedRequestId
          ) {
            return current;
          }

          return {
            selectionId: startedSelectionId,
            state: UserReviewCreateState.error(
              payload,
              UserReviewFeatureError.fromCommandError(
                CreateUserReviewCommandError.fromUnknown(error),
              ),
            ),
          };
        });
        return null;
      }
    },
    [commands, onUserReviewEvent, target, selectionId, workspacePath],
  );

  const createState =
    createViewState.selectionId === selectionId
      ? createViewState.state
      : UserReviewCreateState.idle();

  return {
    createState,
    createUserReview,
  };
}
