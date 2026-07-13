import { useCallback, useEffect, useRef, useState } from "react";

import { UserReviewCollection } from "@/features/review-runs/domain/userReviewCollection";
import { UserReviewFeatureError } from "@/features/review-runs/domain/userReviewError";
import {
  type UserReviewListEvent,
  UserReviewListState,
  type UserReviewListState as UserReviewListStateType,
} from "@/features/review-runs/domain/userReviewListState";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { listUserReviews as listUserReviewsViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { ListUserReviewsCommandError } from "@/shared/api/tauri/listUserReviews";
import { WorkspacePath } from "@/features/workspace";
import {
  createPerformanceCorrelationId,
  startPerformanceSpan,
} from "@/shared/lib/performance";

type SelectionId = string;

export type UserReviewListEventWithSelectionId = Readonly<{
  selectionId: SelectionId;
  event: UserReviewListEvent;
}>;

export type UseUserReviewListOptions = Readonly<{
  commands: UserReviewCommands;
  target: UserReviewTarget | null;
  workspacePath: WorkspacePath | null;
  selectionId: SelectionId;
  correlationId?: string | null;
}>;

export type UseUserReviewListResult = Readonly<{
  listState: UserReviewListStateType;
  /** Reloads the user review list. */
  reloadUserReviews: () => Promise<boolean>;
  /** Applies a list event. @param event - The user review list event to apply. */
  applyUserReviewEvent: (event: UserReviewListEventWithSelectionId) => void;
}>;

type SelectionIdListState = Readonly<{
  selectionId: SelectionId;
  requestVersion: number;
  state: UserReviewListStateType;
}>;

/** @returns User review list state and reload controls for the active target. */
export function useUserReviewList(
  options: UseUserReviewListOptions,
): UseUserReviewListResult {
  const { commands, correlationId, target, selectionId, workspacePath } =
    options;
  const requestVersionRef = useRef(0);
  const [listViewState, setListViewState] = useState<SelectionIdListState>({
    selectionId,
    requestVersion: requestVersionRef.current,
    state: UserReviewListState.idle(),
  });

  const applyUserReviewEvent = useCallback(
    (eventWithSelectionId: UserReviewListEventWithSelectionId): void => {
      setListViewState((current) => {
        if (current.selectionId !== eventWithSelectionId.selectionId) {
          return current;
        }

        const result = UserReviewListState.reduceUserReviewEvent(
          current.state,
          eventWithSelectionId.event,
        );
        const requestVersion = result.invalidatesInFlightListRequest
          ? current.requestVersion + 1
          : current.requestVersion;

        return {
          selectionId: current.selectionId,
          requestVersion,
          state: result.state,
        };
      });
    },
    [],
  );

  const reloadUserReviews = useCallback(async (): Promise<boolean> => {
    const activeTarget = target;
    const startedSelectionId = selectionId;
    const startedRequestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = startedRequestVersion;

    if (workspacePath === null || activeTarget === null) {
      setListViewState({
        selectionId: startedSelectionId,
        requestVersion: startedRequestVersion,
        state: UserReviewListState.idle(),
      });
      return true;
    }

    setListViewState({
      selectionId: startedSelectionId,
      requestVersion: startedRequestVersion,
      state: UserReviewListState.loading(activeTarget),
    });

    const spanCorrelationId =
      correlationId ?? createPerformanceCorrelationId("review-runs-list");
    const commandCorrelationId =
      correlationId === undefined || correlationId === null
        ? null
        : spanCorrelationId;
    // Frontend span measures IPC round trip plus list state application.
    const endSpan = startPerformanceSpan(
      spanCorrelationId,
      "userReviews.list",
      {
        targetScope: activeTarget.scope,
        specId: activeTarget.specId,
        fileKey: activeTarget.scope === "file" ? activeTarget.fileKey : null,
      },
    );

    try {
      const response = await listUserReviewsViaGateway(
        commands,
        WorkspacePath.toString(workspacePath),
        activeTarget,
        commandCorrelationId,
      );
      endSpan({
        activeCount: response.active.length,
        archivedCount: response.archived.length,
        problemCount: response.problems.length,
      });

      setListViewState((current) => {
        if (
          current.selectionId !== startedSelectionId ||
          current.requestVersion !== startedRequestVersion
        ) {
          return current;
        }

        return {
          selectionId: startedSelectionId,
          requestVersion: startedRequestVersion,
          state: UserReviewListState.loaded(
            activeTarget,
            UserReviewCollection.fromListResponse(
              response.active,
              response.archived,
              response.problems,
            ),
          ),
        };
      });
      return true;
    } catch (error) {
      endSpan({
        error: true,
      });

      setListViewState((current) => {
        if (
          current.selectionId !== startedSelectionId ||
          current.requestVersion !== startedRequestVersion
        ) {
          return current;
        }

        return {
          selectionId: startedSelectionId,
          requestVersion: startedRequestVersion,
          state: UserReviewListState.error(
            activeTarget,
            UserReviewFeatureError.fromCommandError(
              ListUserReviewsCommandError.fromUnknown(error),
            ),
          ),
        };
      });
      return false;
    }
  }, [commands, correlationId, target, selectionId, workspacePath]);

  useEffect(() => {
    void reloadUserReviews();
  }, [reloadUserReviews]);

  const listState =
    listViewState.selectionId === selectionId
      ? listViewState.state
      : UserReviewListState.idle();

  return {
    listState,
    reloadUserReviews,
    applyUserReviewEvent,
  };
}
