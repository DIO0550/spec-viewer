import { useCallback, useEffect, useRef, useState } from "react";

import { UserReviewCollection } from "@/features/review-runs/domain/userReviewCollection";
import { UserReviewFeatureError } from "@/features/review-runs/domain/userReviewError";
import {
  type UserReviewListEvent,
  UserReviewListState,
  type UserReviewListState as UserReviewListStateType,
} from "@/features/review-runs/domain/userReviewListState";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { SelectionIdentity } from "@/features/specs/domain/specViewSelection";
import { listUserReviews as listUserReviewsViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { ListUserReviewsCommandError } from "@/shared/api/tauri/listUserReviews";
import { WorkspacePath } from "@/shared/domain/workspacePath";
import {
  createPerformanceCorrelationId,
  startPerformanceSpan,
} from "@/shared/lib/performance";

export type UserReviewListEventWithSelectionIdentity = Readonly<{
  selectionIdentity: SelectionIdentity;
  event: UserReviewListEvent;
}>;

export type UseUserReviewListOptions = Readonly<{
  commands: UserReviewCommands;
  target: UserReviewTarget | null;
  workspacePath: WorkspacePath | null;
  selectionIdentity: SelectionIdentity;
  correlationId?: string | null;
}>;

export type UseUserReviewListResult = Readonly<{
  listState: UserReviewListStateType;
  /** Reloads the user review list. */
  reloadUserReviews: () => Promise<boolean>;
  /** Applies a list event. @param event - The user review list event to apply. */
  applyUserReviewEvent: (
    event: UserReviewListEventWithSelectionIdentity,
  ) => void;
}>;

type SelectionIdentityListState = Readonly<{
  selectionIdentity: SelectionIdentity;
  requestVersion: number;
  state: UserReviewListStateType;
}>;

/** @returns User review list state and reload controls for the active target. */
export function useUserReviewList(
  options: UseUserReviewListOptions,
): UseUserReviewListResult {
  const { commands, correlationId, target, selectionIdentity, workspacePath } =
    options;
  const requestVersionRef = useRef(0);
  const [listViewState, setListViewState] =
    useState<SelectionIdentityListState>({
      selectionIdentity,
      requestVersion: requestVersionRef.current,
      state: UserReviewListState.idle(),
    });

  const applyUserReviewEvent = useCallback(
    (
      eventWithSelectionIdentity: UserReviewListEventWithSelectionIdentity,
    ): void => {
      setListViewState((current) => {
        if (
          current.selectionIdentity !==
          eventWithSelectionIdentity.selectionIdentity
        ) {
          return current;
        }

        const result = UserReviewListState.reduceUserReviewEvent(
          current.state,
          eventWithSelectionIdentity.event,
        );
        const requestVersion = result.invalidatesInFlightListRequest
          ? current.requestVersion + 1
          : current.requestVersion;

        return {
          selectionIdentity: current.selectionIdentity,
          requestVersion,
          state: result.state,
        };
      });
    },
    [],
  );

  const reloadUserReviews = useCallback(async (): Promise<boolean> => {
    const activeTarget = target;
    const startedSelectionIdentity = selectionIdentity;
    const startedRequestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = startedRequestVersion;

    if (workspacePath === null || activeTarget === null) {
      setListViewState({
        selectionIdentity: startedSelectionIdentity,
        requestVersion: startedRequestVersion,
        state: UserReviewListState.idle(),
      });
      return true;
    }

    setListViewState({
      selectionIdentity: startedSelectionIdentity,
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
          current.selectionIdentity !== startedSelectionIdentity ||
          current.requestVersion !== startedRequestVersion
        ) {
          return current;
        }

        return {
          selectionIdentity: startedSelectionIdentity,
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
          current.selectionIdentity !== startedSelectionIdentity ||
          current.requestVersion !== startedRequestVersion
        ) {
          return current;
        }

        return {
          selectionIdentity: startedSelectionIdentity,
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
  }, [commands, correlationId, target, selectionIdentity, workspacePath]);

  useEffect(() => {
    void reloadUserReviews();
  }, [reloadUserReviews]);

  const listState =
    listViewState.selectionIdentity === selectionIdentity
      ? listViewState.state
      : UserReviewListState.idle();

  return {
    listState,
    reloadUserReviews,
    applyUserReviewEvent,
  };
}
