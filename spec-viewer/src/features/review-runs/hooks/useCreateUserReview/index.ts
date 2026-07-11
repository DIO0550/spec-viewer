import { useCallback, useEffect, useRef, useState } from "react";

import type { UserReview } from "@/features/review-runs/domain/userReview";
import { UserReviewFeatureError } from "@/features/review-runs/domain/userReviewError";
import {
  type CreateUserReviewPayload,
  UserReviewCreateState,
  type UserReviewCreateState as UserReviewCreateStateType,
} from "@/features/review-runs/domain/userReviewOperation";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { UserReviewListEventWithSelectionIdentity } from "@/features/review-runs/hooks/useUserReviewList";
import { createUserReview as createUserReviewViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import { SelectionIdentity } from "@/features/specs/domain/specViewSelection";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { CreateUserReviewCommandError } from "@/shared/api/tauri/createUserReview";
import { WorkspacePath } from "@/shared/domain/workspacePath";

export type CreateUserReviewInput = CreateUserReviewPayload;

export type UseCreateUserReviewOptions = Readonly<{
  workspacePath: WorkspacePath | null;
  target: UserReviewTarget | null;
  selectionIdentity: SelectionIdentity;
  commands: UserReviewCommands;
  /** Handles a list event. @param event - The user review list event. */
  onUserReviewEvent: (event: UserReviewListEventWithSelectionIdentity) => void;
}>;

type SelectionIdentityCreateState = Readonly<{
  selectionIdentity: SelectionIdentity;
  state: UserReviewCreateStateType;
}>;

type CreateRequestToken = Readonly<{
  requestId: number;
  selectionIdentity: SelectionIdentity;
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
  const {
    commands,
    onUserReviewEvent,
    target,
    selectionIdentity,
    workspacePath,
  } = options;
  const requestIdRef = useRef(0);
  const activeSelectionIdentityRef = useRef(selectionIdentity);
  const [createViewState, setCreateViewState] =
    useState<SelectionIdentityCreateState>({
      selectionIdentity,
      state: UserReviewCreateState.idle(),
    });
  activeSelectionIdentityRef.current = selectionIdentity;

  /**
   * @param request - Request token captured before invoking the gateway.
   * @returns Whether the request still belongs to the latest rendered selection.
   */
  const isCurrentRequest = useCallback(
    (request: CreateRequestToken): boolean =>
      requestIdRef.current === request.requestId &&
      SelectionIdentity.equals(
        activeSelectionIdentityRef.current,
        request.selectionIdentity,
      ),
    [],
  );

  useEffect(() => {
    requestIdRef.current += 1;
    setCreateViewState({
      selectionIdentity,
      state: UserReviewCreateState.idle(),
    });
  }, [selectionIdentity]);

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
      const request: CreateRequestToken = {
        requestId: requestIdRef.current + 1,
        selectionIdentity,
      };
      requestIdRef.current = request.requestId;
      setCreateViewState({
        selectionIdentity: request.selectionIdentity,
        state: UserReviewCreateState.saving(payload),
      });

      try {
        const response = await createUserReviewViaGateway(
          commands,
          WorkspacePath.toString(workspacePath),
          target,
          payload,
        );

        if (!isCurrentRequest(request)) {
          return null;
        }

        setCreateViewState((current) => {
          if (
            current.selectionIdentity !== request.selectionIdentity ||
            !isCurrentRequest(request)
          ) {
            return current;
          }

          return {
            selectionIdentity: request.selectionIdentity,
            state: UserReviewCreateState.success(payload, response.userReview),
          };
        });
        onUserReviewEvent({
          selectionIdentity: request.selectionIdentity,
          event: {
            type: "reviewCreated",
            review: response.userReview,
          },
        });
        return response.userReview;
      } catch (error) {
        if (!isCurrentRequest(request)) {
          return null;
        }

        setCreateViewState((current) => {
          if (
            current.selectionIdentity !== request.selectionIdentity ||
            !isCurrentRequest(request)
          ) {
            return current;
          }

          return {
            selectionIdentity: request.selectionIdentity,
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
    [
      commands,
      isCurrentRequest,
      onUserReviewEvent,
      target,
      selectionIdentity,
      workspacePath,
    ],
  );

  const createState =
    createViewState.selectionIdentity === selectionIdentity
      ? createViewState.state
      : UserReviewCreateState.idle();

  return {
    createState,
    createUserReview,
  };
}
