import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ReviewSessionCollection } from "@/features/review-runs/domain/reviewSessionCollection";
import type { ReviewSessionCollectionTransform } from "@/features/review-runs/domain/reviewSessionCollection";
import {
  ReviewSessionListState,
  type ReviewSessionListState as ReviewSessionListStateType,
} from "@/features/review-runs/domain/reviewSessionListState";
import type {
  ReviewSessionArchiveState,
  ReviewSessionCreateState,
} from "@/features/review-runs/domain/reviewSessionOperation";
import {
  ReviewSessionTarget,
  ReviewSessionTargetIdentity,
  type ReviewSessionTargetScope,
} from "@/features/review-runs/domain/reviewSessionTarget";
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

export type { ReviewSessionListState } from "@/features/review-runs/domain/reviewSessionListState";
export type {
  ReviewSessionArchiveState,
  ReviewSessionCreateState,
} from "@/features/review-runs/domain/reviewSessionOperation";
export type { ReviewSessionTargetScope } from "@/features/review-runs/domain/reviewSessionTarget";
export type { CreateReviewRunInput } from "@/features/review-runs/hooks/useReviewRunOperations";

export type ReviewRunListState = ReviewSessionListStateType;
export type ReviewRunCreateState = ReviewSessionCreateState;
export type ReviewRunArchiveState = ReviewSessionArchiveState;
export type ReviewRunTargetScope = ReviewSessionTargetScope;

export type UseReviewRunsOptions = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: ReviewSessionTargetScope;
  correlationId?: string | null;
  commands?: ReviewRunCommands;
}>;

export type UseReviewRunsResult = Readonly<{
  target: ReviewRunTarget | null;
  listState: ReviewSessionListStateType;
  createState: ReviewSessionCreateState;
  archiveState: ReviewSessionArchiveState;
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
      ReviewSessionTarget.create({
        specId: options.specId,
        fileKey: options.fileKey,
        targetScope: options.targetScope,
      }),
    [options.fileKey, options.specId, options.targetScope],
  );
  const targetIdentity = useMemo(
    () => ReviewSessionTargetIdentity.create(target),
    [target],
  );
  const listRequestIdRef = useRef(0);
  const activeListTargetIdentityRef = useRef(targetIdentity);
  const [listState, setListState] = useState<ReviewSessionListStateType>(
    ReviewSessionListState.idle(),
  );

  activeListTargetIdentityRef.current = targetIdentity;

  const updateCurrentTargetRuns = useCallback(
    (transform: ReviewSessionCollectionTransform): void => {
      setListState((currentState) => {
        const result = ReviewSessionListState.applyCollectionTransform(
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
      setListState(ReviewSessionListState.idle());
      return true;
    }

    const requestId = listRequestIdRef.current + 1;
    const requestTargetIdentity = targetIdentity;
    listRequestIdRef.current = requestId;
    setListState(ReviewSessionListState.loading(activeTarget));

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
        !ReviewSessionTargetIdentity.equals(
          activeListTargetIdentityRef.current,
          requestTargetIdentity,
        )
      ) {
        return false;
      }

      setListState(
        ReviewSessionListState.loaded(
          activeTarget,
          ReviewSessionCollection.fromListResponse(
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
        !ReviewSessionTargetIdentity.equals(
          activeListTargetIdentityRef.current,
          requestTargetIdentity,
        )
      ) {
        return false;
      }

      setListState(
        ReviewSessionListState.error(
          activeTarget,
          normalizeCommandError(error),
        ),
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
