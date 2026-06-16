import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { UserReviewCollection } from "@/features/review-runs/domain/userReviewCollection";
import {
  UserReviewListState,
  type UserReviewListState as UserReviewListStateType,
} from "@/features/review-runs/domain/userReviewListState";
import {
  UserReviewTargetIdentity,
  type UserReviewTarget,
} from "@/features/review-runs/domain/userReviewTarget";
import { listUserReviews as listUserReviewsViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import {
  createUserReviewViewIdentity,
  type IdentifiedUserReviewListEvent,
  type UserReviewViewIdentity,
} from "@/features/review-runs/hooks/userReviewViewIdentity";
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
  viewIdentity?: UserReviewViewIdentity;
  correlationId?: string | null;
}>;

export type UseUserReviewListResult = Readonly<{
  listState: UserReviewListStateType;
  reloadUserReviews: () => Promise<boolean>;
  applyUserReviewEvent: (event: IdentifiedUserReviewListEvent) => void;
}>;

type IdentifiedListState = Readonly<{
  identity: UserReviewViewIdentity;
  requestVersion: number;
  state: UserReviewListStateType;
}>;

/** @returns User review list state and reload controls for the active target. */
export function useUserReviewList(
  options: UseUserReviewListOptions,
): UseUserReviewListResult {
  const { commands, correlationId, target, workspacePath } = options;
  const targetIdentity = useMemo(
    () => UserReviewTargetIdentity.create(target),
    [target],
  );
  const viewIdentity = useMemo(
    () =>
      options.viewIdentity ??
      createUserReviewViewIdentity(workspacePath, targetIdentity),
    [options.viewIdentity, targetIdentity, workspacePath],
  );
  const requestVersionRef = useRef(0);
  const [listViewState, setListViewState] = useState<IdentifiedListState>({
    identity: viewIdentity,
    requestVersion: requestVersionRef.current,
    state: UserReviewListState.idle(),
  });

  const applyUserReviewEvent = useCallback(
    (identifiedEvent: IdentifiedUserReviewListEvent): void => {
      setListViewState((current) => {
        if (current.identity !== identifiedEvent.identity) {
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
          identity: current.identity,
          requestVersion,
          state: result.state,
        };
      });
    },
    [],
  );

  const reloadUserReviews = useCallback(async (): Promise<boolean> => {
    const activeTarget = target;
    const startedIdentity = viewIdentity;
    const startedRequestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = startedRequestVersion;

    if (workspacePath === null || activeTarget === null) {
      setListViewState({
        identity: startedIdentity,
        requestVersion: startedRequestVersion,
        state: UserReviewListState.idle(),
      });
      return true;
    }

    setListViewState({
      identity: startedIdentity,
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
          current.identity !== startedIdentity ||
          current.requestVersion !== startedRequestVersion
        ) {
          return current;
        }

        return {
          identity: startedIdentity,
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
          current.identity !== startedIdentity ||
          current.requestVersion !== startedRequestVersion
        ) {
          return current;
        }

        return {
          identity: startedIdentity,
          requestVersion: startedRequestVersion,
          state: UserReviewListState.error(
            activeTarget,
            normalizeCommandError(error),
          ),
        };
      });
      return false;
    }
  }, [commands, correlationId, target, viewIdentity, workspacePath]);

  useEffect(() => {
    void reloadUserReviews();
  }, [reloadUserReviews]);

  const listState =
    listViewState.identity === viewIdentity
      ? listViewState.state
      : UserReviewListState.idle();

  return {
    listState,
    reloadUserReviews,
    applyUserReviewEvent,
  };
}
