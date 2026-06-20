import { useCallback, useEffect, useRef, useState } from "react";

import type { UserReview } from "@/features/review-runs/domain/userReview";
import {
  UserReviewArchiveState,
  type UserReviewArchiveState as UserReviewArchiveStateType,
} from "@/features/review-runs/domain/userReviewOperation";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { archiveUserReview as archiveUserReviewViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import type {
  KeyedUserReviewListEvent,
  SpecViewSelectionKey,
} from "@/features/review-runs/hooks/userReviewSelectionKey";
import {
  normalizeCommandError,
  type UserReviewCommands,
} from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";

export type UseArchiveUserReviewOptions = Readonly<{
  workspacePath: WorkspacePath | null;
  target: UserReviewTarget | null;
  selectionKey: SpecViewSelectionKey;
  commands: UserReviewCommands;
  onUserReviewEvent: (event: KeyedUserReviewListEvent) => void;
}>;

type KeyedArchiveState = Readonly<{
  selectionKey: SpecViewSelectionKey;
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
  const { commands, onUserReviewEvent, target, selectionKey, workspacePath } =
    options;
  const requestIdRef = useRef(0);
  const [archiveViewState, setArchiveViewState] = useState<KeyedArchiveState>({
    selectionKey,
    state: UserReviewArchiveState.idle(),
  });

  useEffect(() => {
    requestIdRef.current += 1;
    setArchiveViewState({
      selectionKey,
      state: UserReviewArchiveState.idle(),
    });
  }, [selectionKey]);

  const archiveUserReview = useCallback(
    async (userReviewId: string): Promise<UserReview | null> => {
      if (workspacePath === null || target === null) {
        return null;
      }

      const payload = { userReviewId };
      const startedSelectionKey = selectionKey;
      const startedRequestId = requestIdRef.current + 1;
      requestIdRef.current = startedRequestId;
      setArchiveViewState({
        selectionKey: startedSelectionKey,
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
            current.selectionKey !== startedSelectionKey ||
            requestIdRef.current !== startedRequestId
          ) {
            return current;
          }

          return {
            selectionKey: startedSelectionKey,
            state: UserReviewArchiveState.success(payload, response.userReview),
          };
        });
        if (requestIdRef.current === startedRequestId) {
          onUserReviewEvent({
            selectionKey: startedSelectionKey,
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
            current.selectionKey !== startedSelectionKey ||
            requestIdRef.current !== startedRequestId
          ) {
            return current;
          }

          return {
            selectionKey: startedSelectionKey,
            state: UserReviewArchiveState.error(
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

  const archiveState =
    archiveViewState.selectionKey === selectionKey
      ? archiveViewState.state
      : UserReviewArchiveState.idle();

  return {
    archiveState,
    archiveUserReview,
  };
}
