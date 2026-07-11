import { useCallback, useEffect, useRef, useState } from "react";

import type { UserReview } from "@/features/review-runs/domain/userReview";
import { UserReviewFeatureError } from "@/features/review-runs/domain/userReviewError";
import {
  UserReviewArchiveState,
  type UserReviewArchiveState as UserReviewArchiveStateType,
} from "@/features/review-runs/domain/userReviewOperation";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { SelectionIdentity } from "@/features/specs/domain/specViewSelection";
import type { UserReviewListEventWithSelectionIdentity } from "@/features/review-runs/hooks/useUserReviewList";
import { archiveUserReview as archiveUserReviewViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { ArchiveUserReviewCommandError } from "@/shared/api/tauri/archiveUserReview";
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
  state: UserReviewArchiveStateType;
}>;

export type UseArchiveUserReviewResult = Readonly<{
  archiveState: UserReviewArchiveStateType;
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
  const [archiveViewState, setArchiveViewState] =
    useState<SelectionIdentityArchiveState>({
      selectionIdentity,
      state: UserReviewArchiveState.idle(),
    });

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
      const startedSelectionIdentity = selectionIdentity;
      const startedRequestId = requestIdRef.current + 1;
      requestIdRef.current = startedRequestId;
      setArchiveViewState({
        selectionIdentity: startedSelectionIdentity,
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
            current.selectionIdentity !== startedSelectionIdentity ||
            requestIdRef.current !== startedRequestId
          ) {
            return current;
          }

          return {
            selectionIdentity: startedSelectionIdentity,
            state: UserReviewArchiveState.success(payload, response.userReview),
          };
        });
        if (requestIdRef.current === startedRequestId) {
          onUserReviewEvent({
            selectionIdentity: startedSelectionIdentity,
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
            current.selectionIdentity !== startedSelectionIdentity ||
            requestIdRef.current !== startedRequestId
          ) {
            return current;
          }

          return {
            selectionIdentity: startedSelectionIdentity,
            state: UserReviewArchiveState.error(
              payload,
              UserReviewFeatureError.fromCommandError(
                ArchiveUserReviewCommandError.fromUnknown(error),
              ),
            ),
          };
        });
        return null;
      }
    },
    [commands, onUserReviewEvent, target, selectionIdentity, workspacePath],
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
