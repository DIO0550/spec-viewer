import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ReviewRunCollection } from "@/features/review-runs/domain/reviewRunCollection";
import type { ReviewRunCollectionTransform } from "@/features/review-runs/domain/reviewRunCollection";
import {
  ReviewRunListState,
  type ReviewRunListState as ReviewRunListStateType,
} from "@/features/review-runs/domain/reviewRunListState";
import type {
  ReviewRunArchiveState,
  ReviewRunCreateState,
} from "@/features/review-runs/domain/reviewRunOperation";
import {
  ReviewRunTarget as ReviewRunTargetDomain,
  ReviewRunTargetIdentity,
  type ReviewRunTargetScope,
} from "@/features/review-runs/domain/reviewRunTarget";
import { listReviewRuns as listReviewRunsViaGateway } from "@/features/review-runs/infra/reviewRunGateway";
import { createUseReviewRunsResult } from "@/features/review-runs/hooks/createUseReviewRunsResult";
import {
  useReviewRunOperations,
  type CreateReviewRunInput,
} from "@/features/review-runs/hooks/useReviewRunOperations";
import {
  normalizeCommandError,
  reviewRunCommands as defaultReviewRunCommands,
  type ReviewRunCommands,
} from "@/shared/api/tauri";
import {
  createPerformanceCorrelationId,
  startPerformanceSpan,
} from "@/shared/lib/performance";
import type {
  ReviewRun,
  ReviewRunTarget,
} from "@/features/review-runs/types/reviewRun";
import type { SpecFileKey } from "@/features/specs/types/spec";

export type { ReviewRunListState } from "@/features/review-runs/domain/reviewRunListState";
export type {
  ReviewRunArchiveState,
  ReviewRunCreateState,
} from "@/features/review-runs/domain/reviewRunOperation";
export type { ReviewRunTargetScope } from "@/features/review-runs/domain/reviewRunTarget";
export type { CreateReviewRunInput } from "@/features/review-runs/hooks/useReviewRunOperations";

export type UseReviewRunsOptions = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: ReviewRunTargetScope;
  correlationId?: string | null;
  commands?: ReviewRunCommands;
}>;

export type UseReviewRunsResult = Readonly<{
  target: ReviewRunTarget | null;
  listState: ReviewRunListStateType;
  createState: ReviewRunCreateState;
  archiveState: ReviewRunArchiveState;
  activeRuns: readonly ReviewRun[];
  archivedRuns: readonly ReviewRun[];
  reloadReviewRuns: () => Promise<boolean>;
  createReviewRun: (input: CreateReviewRunInput) => Promise<ReviewRun | null>;
  archiveReviewRun: (reviewRunId: string) => Promise<ReviewRun | null>;
}>;

/** @returns Review run loading and creation state for the selected target. */
export function useReviewRuns(
  options: UseReviewRunsOptions,
): UseReviewRunsResult {
  const commands = options.commands ?? defaultReviewRunCommands;
  const target = useMemo(
    () =>
      ReviewRunTargetDomain.create({
        specId: options.specId,
        fileKey: options.fileKey,
        targetScope: options.targetScope,
      }),
    [options.fileKey, options.specId, options.targetScope],
  );
  const targetIdentity = useMemo(
    () => ReviewRunTargetIdentity.create(target),
    [target],
  );
  const listRequestIdRef = useRef(0);
  const activeListTargetIdentityRef = useRef(targetIdentity);
  const [listState, setListState] = useState<ReviewRunListStateType>(
    ReviewRunListState.idle(),
  );

  activeListTargetIdentityRef.current = targetIdentity;

  const updateCurrentTargetRuns = useCallback(
    (transform: ReviewRunCollectionTransform): void => {
      setListState((currentState) => {
        const result = ReviewRunListState.applyCollectionTransform(
          currentState,
          transform,
        );

        if (result.invalidatesRequest) {
          listRequestIdRef.current += 1;
        }

        return result.state;
      });
    },
    [],
  );

  const reloadReviewRuns = useCallback(async (): Promise<boolean> => {
    const activeTarget = target;

    if (options.workspacePath === null || activeTarget === null) {
      listRequestIdRef.current += 1;
      setListState(ReviewRunListState.idle());
      return true;
    }

    const requestId = listRequestIdRef.current + 1;
    const requestTargetIdentity = targetIdentity;
    listRequestIdRef.current = requestId;
    setListState(ReviewRunListState.loading(activeTarget));

    const spanCorrelationId =
      options.correlationId ??
      createPerformanceCorrelationId("review-runs-list");
    const commandCorrelationId =
      options.correlationId === undefined || options.correlationId === null
        ? null
        : spanCorrelationId;
    const endSpan = startPerformanceSpan(spanCorrelationId, "reviewRuns.list", {
      targetScope: activeTarget.scope,
      specId: activeTarget.specId,
      fileKey: activeTarget.scope === "file" ? activeTarget.fileKey : null,
    });

    try {
      const response = await listReviewRunsViaGateway(
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

      if (
        listRequestIdRef.current !== requestId ||
        !ReviewRunTargetIdentity.equals(
          activeListTargetIdentityRef.current,
          requestTargetIdentity,
        )
      ) {
        return false;
      }

      setListState(
        ReviewRunListState.loaded(
          activeTarget,
          ReviewRunCollection.fromListResponse(
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

      if (
        listRequestIdRef.current !== requestId ||
        !ReviewRunTargetIdentity.equals(
          activeListTargetIdentityRef.current,
          requestTargetIdentity,
        )
      ) {
        return false;
      }

      setListState(
        ReviewRunListState.error(activeTarget, normalizeCommandError(error)),
      );
      return false;
    }
  }, [
    commands,
    options.correlationId,
    options.workspacePath,
    target,
    targetIdentity,
  ]);

  useEffect(() => {
    void reloadReviewRuns();
  }, [reloadReviewRuns]);

  const reviewRunOperations = useReviewRunOperations({
    workspacePath: options.workspacePath,
    target,
    targetIdentity,
    commands,
    updateCurrentTargetRuns,
  });

  return createUseReviewRunsResult({
    target,
    listState,
    reviewRunOperations,
    reloadReviewRuns,
  });
}
