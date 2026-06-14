import { useCallback, useEffect, useMemo, useState } from "react";

import { UserReviewCollection } from "@/features/review-runs/domain/userReviewCollection";
import {
  UserReviewListState,
  type UserReviewListEvent,
  type UserReviewListState as UserReviewListStateType,
} from "@/features/review-runs/domain/userReviewListState";
import {
  UserReviewTargetIdentity,
  type UserReviewTarget,
} from "@/features/review-runs/domain/userReviewTarget";
import { listUserReviews as listUserReviewsViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import { useUserReviewListRequest } from "@/features/review-runs/hooks/useUserReviewListRequest";
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
  correlationId?: string | null;
}>;

export type UseUserReviewListResult = Readonly<{
  listState: UserReviewListStateType;
  reloadUserReviews: () => Promise<boolean>;
  invalidateListRequest: () => void;
  applyUserReviewEvent: (event: UserReviewListEvent) => void;
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
  const listRequest = useUserReviewListRequest(targetIdentity);
  const [listState, setListState] = useState<UserReviewListStateType>(
    UserReviewListState.idle(),
  );

  listRequest.setCurrentIdentity(targetIdentity);

  const applyUserReviewEvent = useCallback(
    (event: UserReviewListEvent): void => {
      setListState((currentState) => {
        const result = UserReviewListState.reduceUserReviewEvent(
          currentState,
          event,
        );

        if (result.invalidatesInFlightListRequest) {
          listRequest.invalidate();
        }

        return result.state;
      });
    },
    [listRequest],
  );

  const reloadUserReviews = useCallback(async (): Promise<boolean> => {
    const activeTarget = target;

    if (workspacePath === null || activeTarget === null) {
      listRequest.invalidate();
      setListState(UserReviewListState.idle());
      return true;
    }

    const token = listRequest.begin(targetIdentity);
    setListState(UserReviewListState.loading(activeTarget));

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

      if (!listRequest.isCurrent(token)) {
        return false;
      }

      setListState(
        UserReviewListState.loaded(
          activeTarget,
          UserReviewCollection.fromListResponse(
            response.active,
            response.archived,
            response.problems,
          ),
        ),
      );
      return true;
    } catch (error) {
      endSpan({
        error: true,
      });

      if (!listRequest.isCurrent(token)) {
        return false;
      }

      setListState(
        UserReviewListState.error(activeTarget, normalizeCommandError(error)),
      );
      return false;
    }
  }, [
    commands,
    correlationId,
    listRequest,
    target,
    targetIdentity,
    workspacePath,
  ]);

  useEffect(() => {
    void reloadUserReviews();
  }, [reloadUserReviews]);

  return {
    listState,
    reloadUserReviews,
    invalidateListRequest: listRequest.invalidate,
    applyUserReviewEvent,
  };
}
