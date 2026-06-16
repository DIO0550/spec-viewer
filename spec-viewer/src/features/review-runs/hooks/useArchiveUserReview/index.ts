import { useCallback, useEffect, useRef, useState } from "react";

import type { UserReview } from "@/features/review-runs/domain/userReview";
import {
  UserReviewArchiveState,
  type UserReviewArchiveState as UserReviewArchiveStateType,
} from "@/features/review-runs/domain/userReviewOperation";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { archiveUserReview as archiveUserReviewViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import type {
  IdentifiedUserReviewListEvent,
  UserReviewViewIdentity,
} from "@/features/review-runs/hooks/userReviewViewIdentity";
import {
  normalizeCommandError,
  type UserReviewCommands,
} from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";

export type UseArchiveUserReviewOptions = Readonly<{
  workspacePath: WorkspacePath | null;
  target: UserReviewTarget | null;
  viewIdentity: UserReviewViewIdentity;
  commands: UserReviewCommands;
  onUserReviewEvent: (event: IdentifiedUserReviewListEvent) => void;
}>;

type IdentifiedArchiveState = Readonly<{
  identity: UserReviewViewIdentity;
  state: UserReviewArchiveStateType;
}>;

export type UseArchiveUserReviewResult = Readonly<{
  archiveState: UserReviewArchiveStateType;
  archiveUserReview: (userReviewId: string) => Promise<UserReview | null>;
}>;

/** @returns User review archive state and callback for the active target. */
export function useArchiveUserReview(
  options: UseArchiveUserReviewOptions,
): UseArchiveUserReviewResult {
  const { commands, onUserReviewEvent, target, viewIdentity, workspacePath } =
    options;
  const requestIdRef = useRef(0);
  const [archiveViewState, setArchiveViewState] =
    useState<IdentifiedArchiveState>({
      identity: viewIdentity,
      state: UserReviewArchiveState.idle(),
    });

  useEffect(() => {
    requestIdRef.current += 1;
    setArchiveViewState({
      identity: viewIdentity,
      state: UserReviewArchiveState.idle(),
    });
  }, [viewIdentity]);

  const archiveUserReview = useCallback(
    async (userReviewId: string): Promise<UserReview | null> => {
      if (workspacePath === null || target === null) {
        return null;
      }

      const payload = { userReviewId };
      const startedIdentity = viewIdentity;
      const startedRequestId = requestIdRef.current + 1;
      requestIdRef.current = startedRequestId;
      setArchiveViewState({
        identity: startedIdentity,
        state: UserReviewArchiveState.saving(payload),
      });

      try {
        const response = await archiveUserReviewViaGateway(
          commands,
          WorkspacePath.toString(workspacePath),
          target,
          payload.userReviewId,
        );

        setArchiveViewState((current) => {
          if (
            current.identity !== startedIdentity ||
            requestIdRef.current !== startedRequestId
          ) {
            return current;
          }

          return {
            identity: startedIdentity,
            state: UserReviewArchiveState.success(payload, response.userReview),
          };
        });
        if (requestIdRef.current === startedRequestId) {
          onUserReviewEvent({
            identity: startedIdentity,
            event: {
              type: "reviewArchived",
              review: response.userReview,
            },
          });
        }
        return response.userReview;
      } catch (error) {
        setArchiveViewState((current) => {
          if (
            current.identity !== startedIdentity ||
            requestIdRef.current !== startedRequestId
          ) {
            return current;
          }

          return {
            identity: startedIdentity,
            state: UserReviewArchiveState.error(
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

  const archiveState =
    archiveViewState.identity === viewIdentity
      ? archiveViewState.state
      : UserReviewArchiveState.idle();

  return {
    archiveState,
    archiveUserReview,
  };
}
