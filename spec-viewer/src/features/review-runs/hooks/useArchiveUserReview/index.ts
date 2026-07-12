import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewArchiveFeatureState } from "@/features/review-runs/application/userReviewError";
import { UserReviewArchiveState } from "@/features/review-runs/domain/userReviewOperation";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { UserReviewListEventWithSelectionIdentity } from "@/features/review-runs/hooks/useUserReviewList";
import { archiveUserReview as archiveUserReviewViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import type { UserReviewCommands } from "@/features/review-runs/application/ports/userReviewCommands";
import { toUserReviewFeatureError } from "@/features/review-runs/infra/tauri/userReviewErrorMapper";
import { SelectionIdentity } from "@/shared/domain/specViewSelection";
import { WorkspacePath } from "@/shared/domain/workspacePath";

export type UseArchiveUserReviewOptions = Readonly<{
  workspacePath: WorkspacePath | null;
  target: UserReviewTarget | null;
  selectionIdentity: SelectionIdentity;
  commands: UserReviewCommands;
  /** Handles a list event. @param event - The user review list event. */
  onUserReviewEvent: (event: UserReviewListEventWithSelectionIdentity) => void;
}>;

type SelectionIdentityArchiveState = Readonly<{
  selectionIdentity: SelectionIdentity;
  state: UserReviewArchiveFeatureState;
}>;

type ArchiveRequestToken = Readonly<{
  requestId: number;
  selectionIdentity: SelectionIdentity;
}>;

export type UseArchiveUserReviewResult = Readonly<{
  archiveState: UserReviewArchiveFeatureState;
  /** Archives a user review. @param userReviewId - ID of the review to archive. */
  archiveUserReview: (userReviewId: string) => Promise<UserReview | null>;
}>;

/** @returns User review archive state and callback for the active target. */
export function useArchiveUserReview(
  options: UseArchiveUserReviewOptions,
): UseArchiveUserReviewResult {
  const {
    commands,
    onUserReviewEvent,
    target,
    selectionIdentity,
    workspacePath,
  } = options;
  const requestIdRef = useRef(0);
  const activeSelectionIdentityRef = useRef(selectionIdentity);
  const [archiveViewState, setArchiveViewState] =
    useState<SelectionIdentityArchiveState>({
      selectionIdentity,
      state: UserReviewArchiveState.idle(),
    });

  useLayoutEffect(() => {
    activeSelectionIdentityRef.current = selectionIdentity;
  }, [selectionIdentity]);

  /**
   * @param request - Request token captured before invoking the gateway.
   * @returns Whether the request still belongs to the latest committed selection.
   */
  const isCurrentRequest = useCallback(
    (request: ArchiveRequestToken): boolean =>
      requestIdRef.current === request.requestId &&
      SelectionIdentity.equals(
        activeSelectionIdentityRef.current,
        request.selectionIdentity,
      ),
    [],
  );

  useEffect(() => {
    requestIdRef.current += 1;
    setArchiveViewState({
      selectionIdentity,
      state: UserReviewArchiveState.idle(),
    });
  }, [selectionIdentity]);

  const archiveUserReview = useCallback(
    async (userReviewId: string): Promise<UserReview | null> => {
      if (workspacePath === null || target === null) {
        return null;
      }

      const payload = { userReviewId };
      const request: ArchiveRequestToken = {
        requestId: requestIdRef.current + 1,
        selectionIdentity,
      };
      requestIdRef.current = request.requestId;
      setArchiveViewState({
        selectionIdentity: request.selectionIdentity,
        state: UserReviewArchiveState.saving(payload),
      });

      try {
        const response = await archiveUserReviewViaGateway(
          commands,
          WorkspacePath.toString(workspacePath),
          target,
          payload.userReviewId,
        );

        if (!isCurrentRequest(request)) {
          return null;
        }

        setArchiveViewState((current) => {
          if (
            current.selectionIdentity !== request.selectionIdentity ||
            !isCurrentRequest(request)
          ) {
            return current;
          }

          return {
            selectionIdentity: request.selectionIdentity,
            state: UserReviewArchiveState.success(payload, response.userReview),
          };
        });
        onUserReviewEvent({
          selectionIdentity: request.selectionIdentity,
          event: {
            type: "reviewArchived",
            review: response.userReview,
          },
        });
        return response.userReview;
      } catch (error) {
        if (!isCurrentRequest(request)) {
          return null;
        }

        setArchiveViewState((current) => {
          if (
            current.selectionIdentity !== request.selectionIdentity ||
            !isCurrentRequest(request)
          ) {
            return current;
          }

          return {
            selectionIdentity: request.selectionIdentity,
            state: UserReviewArchiveState.error(
              payload,
              toUserReviewFeatureError("archive", error),
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

  const archiveState =
    archiveViewState.selectionIdentity === selectionIdentity
      ? archiveViewState.state
      : UserReviewArchiveState.idle();

  return {
    archiveState,
    archiveUserReview,
  };
}
