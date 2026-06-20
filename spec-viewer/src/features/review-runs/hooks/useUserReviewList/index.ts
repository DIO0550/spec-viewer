import { useCallback, useEffect, useRef, useState } from "react";

import { UserReviewCollection } from "@/features/review-runs/domain/userReviewCollection";
import {
  UserReviewListState,
  type UserReviewListState as UserReviewListStateType,
} from "@/features/review-runs/domain/userReviewListState";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { listUserReviews as listUserReviewsViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import type {
  KeyedUserReviewListEvent,
  SpecViewSelectionKey,
} from "@/features/review-runs/hooks/userReviewSelectionKey";
import {
  normalizeCommandError,
  type UserReviewCommands,
} from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";
import {
  createPerformanceCorrelationId,
  startPerformanceSpan,
} from "@/shared/lib/performance";

export type UseUserReviewListOptions = Readonly<{
  commands: UserReviewCommands;
  target: UserReviewTarget | null;
  workspacePath: WorkspacePath | null;
  selectionKey: SpecViewSelectionKey;
  correlationId?: string | null;
}>;

export type UseUserReviewListResult = Readonly<{
  listState: UserReviewListStateType;
  reloadUserReviews: () => Promise<boolean>;
  applyUserReviewEvent: (event: KeyedUserReviewListEvent) => void;
}>;

type KeyedListState = Readonly<{
  selectionKey: SpecViewSelectionKey;
  requestVersion: number;
  state: UserReviewListStateType;
}>;

/** @returns User review list state and reload controls for the active target. */
export function useUserReviewList(
  options: UseUserReviewListOptions,
): UseUserReviewListResult {
  const { commands, correlationId, target, selectionKey, workspacePath } =
    options;
  const requestVersionRef = useRef(0);
  const [listViewState, setListViewState] = useState<KeyedListState>({
    selectionKey,
    requestVersion: requestVersionRef.current,
    state: UserReviewListState.idle(),
  });

  const applyUserReviewEvent = useCallback(
    (identifiedEvent: KeyedUserReviewListEvent): void => {
      setListViewState((current) => {
        if (current.selectionKey !== identifiedEvent.selectionKey) {
          return current;
        }

        const result = UserReviewListState.reduceUserReviewEvent(
          current.state,
          identifiedEvent.event,
        );
        const requestVersion = result.invalidatesInFlightListRequest
          ? current.requestVersion + 1
          : current.requestVersion;

        return {
          selectionKey: current.selectionKey,
          requestVersion,
          state: result.state,
        };
      });
    },
    [],
  );

  const reloadUserReviews = useCallback(async (): Promise<boolean> => {
    const activeTarget = target;
    const startedSelectionKey = selectionKey;
    const startedRequestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = startedRequestVersion;

    if (workspacePath === null || activeTarget === null) {
      setListViewState({
        selectionKey: startedSelectionKey,
        requestVersion: startedRequestVersion,
        state: UserReviewListState.idle(),
      });
      return true;
    }

    setListViewState({
      selectionKey: startedSelectionKey,
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
          current.selectionKey !== startedSelectionKey ||
          current.requestVersion !== startedRequestVersion
        ) {
          return current;
        }

        return {
          selectionKey: startedSelectionKey,
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
          current.selectionKey !== startedSelectionKey ||
          current.requestVersion !== startedRequestVersion
        ) {
          return current;
        }

        return {
          selectionKey: startedSelectionKey,
          requestVersion: startedRequestVersion,
          state: UserReviewListState.error(
            activeTarget,
            normalizeCommandError(error),
          ),
        };
      });
      return false;
    }
  }, [commands, correlationId, target, selectionKey, workspacePath]);

  useEffect(() => {
    void reloadUserReviews();
  }, [reloadUserReviews]);

  const listState =
    listViewState.selectionKey === selectionKey
      ? listViewState.state
      : UserReviewListState.idle();

  return {
    listState,
    reloadUserReviews,
    applyUserReviewEvent,
  };
}
