import { useCallback, useEffect, useRef, useState } from "react";

import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewListEvent } from "@/features/review-runs/domain/userReviewListState";
import {
  UserReviewArchiveState,
  type UserReviewArchiveState as UserReviewArchiveStateType,
} from "@/features/review-runs/domain/userReviewOperation";
import type {
  UserReviewTarget,
  UserReviewTargetIdentity,
} from "@/features/review-runs/domain/userReviewTarget";
import { archiveUserReview as archiveUserReviewViaGateway } from "@/features/review-runs/infra/userReviewGateway";
import { useUserReviewAsyncGuard } from "@/features/review-runs/hooks/useUserReviewAsyncGuard";
import {
  normalizeCommandError,
  type UserReviewCommands,
} from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";

export type UseArchiveUserReviewOptions = Readonly<{
  workspacePath: WorkspacePath | null;
  target: UserReviewTarget | null;
  targetIdentity: UserReviewTargetIdentity;
  commands: UserReviewCommands;
  onUserReviewEvent: (event: UserReviewListEvent) => void;
}>;

export type UseArchiveUserReviewResult = Readonly<{
  archiveState: UserReviewArchiveStateType;
  archiveUserReview: (userReviewId: string) => Promise<UserReview | null>;
}>;

/** @returns User review archive state and callback for the active target. */
export function useArchiveUserReview(
  options: UseArchiveUserReviewOptions,
): UseArchiveUserReviewResult {
  const { commands, onUserReviewEvent, target, targetIdentity, workspacePath } =
    options;
  const guard = useUserReviewAsyncGuard();
  const operationIdentity = createOperationIdentity(
    workspacePath,
    targetIdentity,
  );
  const previousOperationIdentityRef = useRef(operationIdentity);
  const [archiveState, setArchiveState] = useState<UserReviewArchiveStateType>(
    UserReviewArchiveState.idle(),
  );

  guard.setCurrentIdentity(operationIdentity);

  const archiveUserReview = useCallback(
    async (userReviewId: string): Promise<UserReview | null> => {
      if (workspacePath === null || target === null) {
        return null;
      }

      const payload = { userReviewId };
      const operation = guard.begin(operationIdentity);
      setArchiveState(UserReviewArchiveState.saving(payload));

      try {
        const response = await archiveUserReviewViaGateway(
          commands,
          WorkspacePath.toString(workspacePath),
          target,
          payload.userReviewId,
        );

        if (!guard.isCurrent(operation)) {
          return null;
        }

        setArchiveState(
          UserReviewArchiveState.success(payload, response.userReview),
        );
        onUserReviewEvent({
          type: "reviewArchived",
          review: response.userReview,
        });
        return response.userReview;
      } catch (error) {
        if (!guard.isCurrent(operation)) {
          return null;
        }

        setArchiveState(
          UserReviewArchiveState.error(payload, normalizeCommandError(error)),
        );
        return null;
      }
    },
    [
      commands,
      guard,
      onUserReviewEvent,
      operationIdentity,
      target,
      workspacePath,
    ],
  );

  useEffect(() => {
    if (previousOperationIdentityRef.current === operationIdentity) {
      return;
    }

    previousOperationIdentityRef.current = operationIdentity;
    guard.invalidate();
    setArchiveState(UserReviewArchiveState.idle());
  }, [guard, operationIdentity]);

  return {
    archiveState,
    archiveUserReview,
  };
}

/** @returns Async operation identity scoped by workspace and target. */
function createOperationIdentity(
  workspacePath: WorkspacePath | null,
  targetIdentity: UserReviewTargetIdentity,
): UserReviewTargetIdentity {
  return `${workspacePath ?? "none"}:${targetIdentity}`;
}
