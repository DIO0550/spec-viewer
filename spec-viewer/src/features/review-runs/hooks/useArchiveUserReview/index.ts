import { useCallback, useEffect, useRef, useState } from "react";

import type { UserReview } from "@/features/review-runs/domain/userReview";
import {
  UserReviewArchiveState,
  type UserReviewArchiveState as UserReviewArchiveStateType,
} from "@/features/review-runs/domain/userReviewOperation";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { archiveUserReview as archiveUserReviewViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import type { UserReviewListEventWithSelectionId } from "@/features/review-runs/hooks/useUserReviewList";
import type { SpecViewSelectionId } from "@/features/specs/domain/specViewSelectionId";
import {
  normalizeCommandError,
  type UserReviewCommands,
} from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";

export type UseArchiveUserReviewOptions = Readonly<{
  workspacePath: WorkspacePath | null;
  target: UserReviewTarget | null;
  selectionId: SpecViewSelectionId;
  commands: UserReviewCommands;
  onUserReviewEvent: (event: UserReviewListEventWithSelectionId) => void;
}>;

type SelectionIdArchiveState = Readonly<{
  selectionId: SpecViewSelectionId;
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
  const { commands, onUserReviewEvent, target, selectionId, workspacePath } =
    options;
  const requestIdRef = useRef(0);
  const [archiveViewState, setArchiveViewState] =
    useState<SelectionIdArchiveState>({
      selectionId,
      state: UserReviewArchiveState.idle(),
    });

  useEffect(() => {
    requestIdRef.current += 1;
    setArchiveViewState({
      selectionId,
      state: UserReviewArchiveState.idle(),
    });
  }, [selectionId]);

  const archiveUserReview = useCallback(
    async (userReviewId: string): Promise<UserReview | null> => {
      if (workspacePath === null || target === null) {
        return null;
      }

      const payload = { userReviewId };
      const startedSelectionId = selectionId;
      const startedRequestId = requestIdRef.current + 1;
      requestIdRef.current = startedRequestId;
      setArchiveViewState({
        selectionId: startedSelectionId,
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
            current.selectionId !== startedSelectionId ||
            requestIdRef.current !== startedRequestId
          ) {
            return current;
          }

          return {
            selectionId: startedSelectionId,
            state: UserReviewArchiveState.success(payload, response.userReview),
          };
        });
        if (requestIdRef.current === startedRequestId) {
          onUserReviewEvent({
            selectionId: startedSelectionId,
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
            current.selectionId !== startedSelectionId ||
            requestIdRef.current !== startedRequestId
          ) {
            return current;
          }

          return {
            selectionId: startedSelectionId,
            state: UserReviewArchiveState.error(
              payload,
              normalizeCommandError(error),
            ),
          };
        });
        return null;
      }
    },
    [commands, onUserReviewEvent, target, selectionId, workspacePath],
  );

  const archiveState =
    archiveViewState.selectionId === selectionId
      ? archiveViewState.state
      : UserReviewArchiveState.idle();

  return {
    archiveState,
    archiveUserReview,
  };
}
