import { useCallback, useEffect, useRef, useState } from "react";

import { ReviewSessionCollection } from "@/features/review-runs/domain/reviewSessionCollection";
import type { ReviewSessionCollectionTransform } from "@/features/review-runs/domain/reviewSessionCollection";
import {
  ReviewSessionArchiveState,
  ReviewSessionCreateState,
  type ReviewSessionArchiveState as ReviewSessionArchiveStateType,
  type ReviewSessionCreateState as ReviewSessionCreateStateType,
} from "@/features/review-runs/domain/reviewSessionOperation";
import {
  archiveReviewRun as archiveReviewRunViaGateway,
  createReviewRun as createReviewRunViaGateway,
} from "@/features/review-runs/infra/reviewRunGateway";
import type {
  ReviewRun,
  ReviewRunExecutionMode,
  ReviewRunTarget,
} from "@/features/review-runs/types/reviewRun";
import type { CommentId } from "@/features/comments/types/comment";
import {
  normalizeCommandError,
  type ReviewRunCommands,
} from "@/shared/api/tauri";

export type CreateReviewRunInput = Readonly<{
  commentIds: readonly CommentId[];
  executionMode: ReviewRunExecutionMode;
}>;

export type UseReviewRunOperationsOptions = Readonly<{
  workspacePath: string | null;
  target: ReviewRunTarget | null;
  targetIdentity: string;
  commands: ReviewRunCommands;
  updateCurrentTargetRuns: (
    transform: ReviewSessionCollectionTransform,
  ) => void;
}>;

export type UseReviewRunOperationsResult = Readonly<{
  createState: ReviewSessionCreateStateType;
  archiveState: ReviewSessionArchiveStateType;
  createReviewRun: (input: CreateReviewRunInput) => Promise<ReviewRun | null>;
  archiveReviewRun: (reviewRunId: string) => Promise<ReviewRun | null>;
}>;

type StartedReviewRunOperation = Readonly<{
  requestId: number;
  targetIdentity: string;
}>;

/**
 * @param options - Active target, command boundary, and list update callback.
 * @returns Review-run create/archive states and operation callbacks.
 */
export function useReviewRunOperations(
  options: UseReviewRunOperationsOptions,
): UseReviewRunOperationsResult {
  const {
    commands,
    target,
    targetIdentity,
    updateCurrentTargetRuns,
    workspacePath,
  } = options;
  const createRequestIdRef = useRef(0);
  const archiveRequestIdRef = useRef(0);
  const operationIdentity = createOperationIdentity(
    workspacePath,
    targetIdentity,
  );
  const activeOperationIdentityRef = useRef(operationIdentity);
  const [createState, setCreateState] = useState<ReviewSessionCreateStateType>(
    ReviewSessionCreateState.idle(),
  );
  const [archiveState, setArchiveState] =
    useState<ReviewSessionArchiveStateType>(ReviewSessionArchiveState.idle());

  activeOperationIdentityRef.current = operationIdentity;

  const createReviewRun = useCallback(
    async (input: CreateReviewRunInput): Promise<ReviewRun | null> => {
      if (
        workspacePath === null ||
        target === null ||
        input.commentIds.length === 0
      ) {
        return null;
      }

      const operation = startOperation(
        createRequestIdRef.current + 1,
        operationIdentity,
      );
      createRequestIdRef.current = operation.requestId;
      setCreateState(ReviewSessionCreateState.saving());

      try {
        const response = await createReviewRunViaGateway(
          commands,
          workspacePath,
          target,
          input,
        );

        if (
          !canApplyOperationResult(
            operation,
            activeOperationIdentityRef.current,
            createRequestIdRef.current,
          )
        ) {
          return null;
        }

        setCreateState(ReviewSessionCreateState.success(response.reviewRun));
        updateCurrentTargetRuns((collection) =>
          ReviewSessionCollection.addCreated(collection, response.reviewRun),
        );
        return response.reviewRun;
      } catch (error) {
        if (
          !canApplyOperationResult(
            operation,
            activeOperationIdentityRef.current,
            createRequestIdRef.current,
          )
        ) {
          return null;
        }

        setCreateState(
          ReviewSessionCreateState.error(normalizeCommandError(error)),
        );
        return null;
      }
    },
    [
      commands,
      operationIdentity,
      target,
      updateCurrentTargetRuns,
      workspacePath,
    ],
  );

  const archiveReviewRun = useCallback(
    async (reviewRunId: string): Promise<ReviewRun | null> => {
      if (workspacePath === null || target === null) {
        return null;
      }

      const operation = startOperation(
        archiveRequestIdRef.current + 1,
        operationIdentity,
      );
      archiveRequestIdRef.current = operation.requestId;
      setArchiveState(ReviewSessionArchiveState.saving(reviewRunId));

      try {
        const response = await archiveReviewRunViaGateway(
          commands,
          workspacePath,
          target,
          reviewRunId,
        );

        if (
          !canApplyOperationResult(
            operation,
            activeOperationIdentityRef.current,
            archiveRequestIdRef.current,
          )
        ) {
          return null;
        }

        setArchiveState(
          ReviewSessionArchiveState.success(reviewRunId, response.reviewRun),
        );
        updateCurrentTargetRuns((collection) =>
          ReviewSessionCollection.moveArchived(collection, response.reviewRun),
        );
        return response.reviewRun;
      } catch (error) {
        if (
          !canApplyOperationResult(
            operation,
            activeOperationIdentityRef.current,
            archiveRequestIdRef.current,
          )
        ) {
          return null;
        }

        setArchiveState(
          ReviewSessionArchiveState.error(
            reviewRunId,
            normalizeCommandError(error),
          ),
        );
        return null;
      }
    },
    [
      commands,
      operationIdentity,
      target,
      updateCurrentTargetRuns,
      workspacePath,
    ],
  );

  useEffect(() => {
    createRequestIdRef.current += 1;
    archiveRequestIdRef.current += 1;
    setCreateState(ReviewSessionCreateState.idle());
    setArchiveState(ReviewSessionArchiveState.idle());
  }, [operationIdentity]);

  return {
    createState,
    archiveState,
    createReviewRun,
    archiveReviewRun,
  };
}

/**
 * @param requestId - Operation request id.
 * @param targetIdentity - Target identity captured when the operation started.
 * @returns Token used to reject stale operation results.
 */
function startOperation(
  requestId: number,
  targetIdentity: string,
): StartedReviewRunOperation {
  return { requestId, targetIdentity };
}

/**
 * @param operation - Captured operation token.
 * @param currentTargetIdentity - Current operation identity.
 * @param latestRequestId - Latest operation request id.
 * @returns True when the async operation still belongs to current state.
 */
function canApplyOperationResult(
  operation: StartedReviewRunOperation,
  currentTargetIdentity: string,
  latestRequestId: number,
): boolean {
  return (
    operation.requestId === latestRequestId &&
    operation.targetIdentity === currentTargetIdentity
  );
}

/** @returns Identity for async operation invalidation. */
function createOperationIdentity(
  workspacePath: string | null,
  targetIdentity: string,
): string {
  return `${workspacePath ?? "none"}:${targetIdentity}`;
}
