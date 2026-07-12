import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewCreateFeatureState } from "@/features/review-runs/application/userReviewError";
import {
  type CreateUserReviewPayload,
  UserReviewCreateState,
} from "@/features/review-runs/domain/userReviewOperation";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { UserReviewListEventWithSelectionIdentity } from "@/features/review-runs/hooks/useUserReviewList";
import { createUserReview as createUserReviewViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import type { UserReviewCommands } from "@/features/review-runs/application/ports/userReviewCommands";
import { toUserReviewFeatureError } from "@/features/review-runs/infra/tauri/userReviewErrorMapper";
import { SelectionIdentity } from "@/shared/domain/specViewSelection";
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
  state: UserReviewCreateFeatureState;
}>;

type CreateRequestToken = Readonly<{
  requestId: number;
  selectionIdentity: SelectionIdentity;
}>;

export type UseCreateUserReviewResult = Readonly<{
  createState: UserReviewCreateFeatureState;
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

  useLayoutEffect(() => {
    activeSelectionIdentityRef.current = selectionIdentity;
  }, [selectionIdentity]);

  /**
   * @param request - Request token captured before invoking the gateway.
   * @returns Whether the request still belongs to the latest committed selection.
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
              toUserReviewFeatureError("create", error),
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
