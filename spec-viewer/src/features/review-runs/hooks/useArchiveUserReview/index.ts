import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ActiveUserReview,
  ArchivedUserReview,
} from "@/features/review-runs/domain/userReview";
import { UserReviewFeatureError } from "@/features/review-runs/domain/userReviewError";
import {
  UserReviewArchiveState,
  type UserReviewArchiveState as UserReviewArchiveStateType,
} from "@/features/review-runs/domain/userReviewOperation";
import {
  UserReviewTarget,
  type UserReviewTarget as UserReviewTargetType,
} from "@/features/review-runs/domain/userReviewTarget";
import type { UserReviewListEventWithSelectionId } from "@/features/review-runs/hooks/useUserReviewList";
import { archiveUserReview as archiveUserReviewViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { ArchiveUserReviewCommandError } from "@/shared/api/tauri/archiveUserReview";
import { WorkspacePath } from "@/shared/domain/workspacePath";

type SelectionId = string;

export type UseArchiveUserReviewOptions = Readonly<{
  workspacePath: WorkspacePath | null;
  target: UserReviewTargetType | null;
  selectionId: SelectionId;
  commands: UserReviewCommands;
  /** Handles a list event. @param event - The user review list event. */
  onUserReviewEvent: (event: UserReviewListEventWithSelectionId) => void;
}>;

type SelectionIdArchiveState = Readonly<{
  selectionId: SelectionId;
  state: UserReviewArchiveStateType;
}>;

export type UseArchiveUserReviewResult = Readonly<{
  archiveState: UserReviewArchiveStateType;
  /** Archives a user review. @param userReview - Aggregate to archive. */
  archiveUserReview: (
    userReview: ActiveUserReview,
  ) => Promise<ArchivedUserReview | null>;
}>;

/** @returns User review archive state and callback for the active target. */
export function useArchiveUserReview(
  options: UseArchiveUserReviewOptions,
): UseArchiveUserReviewResult {
  const { commands, onUserReviewEvent, target, selectionId, workspacePath } =
    options;
  const requestIdRef = useRef(0);
  const isArchivingRef = useRef(false);
  const [archiveViewState, setArchiveViewState] =
    useState<SelectionIdArchiveState>({
      selectionId,
      state: UserReviewArchiveState.idle(),
    });

  useEffect(() => {
    requestIdRef.current += 1;
    isArchivingRef.current = false;
    setArchiveViewState({
      selectionId,
      state: UserReviewArchiveState.idle(),
    });
  }, [selectionId]);

  const archiveUserReview = useCallback(
    async (
      userReview: ActiveUserReview,
    ): Promise<ArchivedUserReview | null> => {
      if (
        workspacePath === null ||
        target === null ||
        isArchivingRef.current ||
        !UserReviewTarget.equals(target, userReview.target)
      ) {
        return null;
      }

      isArchivingRef.current = true;
      const payload = { userReviewId: userReview.id };
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
          userReview,
        );

        if (requestIdRef.current === startedRequestId) {
          isArchivingRef.current = false;
        }

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
        if (requestIdRef.current === startedRequestId) {
          isArchivingRef.current = false;
        }

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
              UserReviewFeatureError.fromCommandError(
                ArchiveUserReviewCommandError.fromUnknown(error),
              ),
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
