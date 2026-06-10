import { useCallback, useEffect, useMemo, useState } from "react";

import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewCollectionTransform } from "@/features/review-runs/domain/userReviewCollection";
import { UserReviewCollection } from "@/features/review-runs/domain/userReviewCollection";
import {
  UserReviewListState,
  type UserReviewListState as UserReviewListStateType,
} from "@/features/review-runs/domain/userReviewListState";
import type {
  UserReviewArchiveState,
  UserReviewCreateState,
} from "@/features/review-runs/domain/userReviewOperation";
import {
  UserReviewTarget,
  UserReviewTargetIdentity,
  type UserReviewTargetScope,
} from "@/features/review-runs/domain/userReviewTarget";
import { createUseUserReviewsResult } from "@/features/review-runs/hooks/createUseUserReviewsResult";
import { useUserReviewListRequest } from "@/features/review-runs/hooks/useUserReviewListRequest";
import {
  type CreateUserReviewInput,
  useUserReviewOperations,
} from "@/features/review-runs/hooks/useUserReviewOperations";
import { listUserReviews as listUserReviewsViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import {
  userReviewCommands as defaultUserReviewCommands,
  normalizeCommandError,
  type UserReviewCommands,
} from "@/shared/api/tauri";
import {
  createPerformanceCorrelationId,
  startPerformanceSpan,
} from "@/shared/lib/performance";
import type { SpecFileKey } from "@/shared/types/specFileKey";

export type { UserReviewListState } from "@/features/review-runs/domain/userReviewListState";
export type {
  UserReviewArchiveState,
  UserReviewCreateState,
} from "@/features/review-runs/domain/userReviewOperation";
export type { UserReviewTargetScope } from "@/features/review-runs/domain/userReviewTarget";
export type { CreateUserReviewInput } from "@/features/review-runs/hooks/useUserReviewOperations";

export type UseUserReviewsOptions = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: UserReviewTargetScope;
  correlationId?: string | null;
  commands?: UserReviewCommands;
}>;

export type UseUserReviewsResult = Readonly<{
  target: UserReviewTarget | null;
  listState: UserReviewListStateType;
  createState: UserReviewCreateState;
  archiveState: UserReviewArchiveState;
  activeReviews: readonly UserReview[];
  archivedReviews: readonly UserReview[];
  reloadUserReviews: () => Promise<boolean>;
  createUserReview: (
    input: CreateUserReviewInput,
  ) => Promise<UserReview | null>;
  archiveUserReview: (userReviewId: string) => Promise<UserReview | null>;
}>;

/** @returns User review loading and creation state for the selected target. */
export function useUserReviews(
  options: UseUserReviewsOptions,
): UseUserReviewsResult {
  const commands = options.commands ?? defaultUserReviewCommands;
  const target = useMemo(
    () =>
      UserReviewTarget.create({
        specId: options.specId,
        fileKey: options.fileKey,
        targetScope: options.targetScope,
      }),
    [options.fileKey, options.specId, options.targetScope],
  );
  const targetIdentity = useMemo(
    () => UserReviewTargetIdentity.create(target),
    [target],
  );
  const listRequest = useUserReviewListRequest(targetIdentity);
  const [listState, setListState] = useState<UserReviewListStateType>(
    UserReviewListState.idle(),
  );

  listRequest.setCurrentIdentity(targetIdentity);

  const updateCurrentTargetReviews = useCallback(
    (transform: UserReviewCollectionTransform): void => {
      setListState((currentState) => {
        const result = UserReviewListState.applyCollectionTransform(
          currentState,
          transform,
        );

        if (result.invalidatesRequest) {
          listRequest.invalidate();
        }

        return result.state;
      });
    },
    [listRequest],
  );

  const reloadUserReviews = useCallback(async (): Promise<boolean> => {
    const activeTarget = target;

    if (options.workspacePath === null || activeTarget === null) {
      listRequest.invalidate();
      setListState(UserReviewListState.idle());
      return true;
    }

    const token = listRequest.begin(targetIdentity);
    setListState(UserReviewListState.loading(activeTarget));

    const spanCorrelationId =
      options.correlationId ??
      createPerformanceCorrelationId("review-runs-list");
    const commandCorrelationId =
      options.correlationId === undefined || options.correlationId === null
        ? null
        : spanCorrelationId;
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
        options.workspacePath,
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
    listRequest,
    options.correlationId,
    options.workspacePath,
    target,
    targetIdentity,
  ]);

  useEffect(() => {
    void reloadUserReviews();
  }, [reloadUserReviews]);

  const userReviewOperations = useUserReviewOperations({
    workspacePath: options.workspacePath,
    target,
    targetIdentity,
    commands,
    updateCurrentTargetReviews,
  });

  return createUseUserReviewsResult({
    target,
    listState,
    userReviewOperations,
    reloadUserReviews,
  });
}
