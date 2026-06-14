import { useMemo } from "react";

import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewListState as UserReviewListStateType } from "@/features/review-runs/domain/userReviewListState";
import type {
  UserReviewArchiveState,
  UserReviewCreateState,
} from "@/features/review-runs/domain/userReviewOperation";
import {
  UserReviewTarget,
  UserReviewTargetIdentity,
  type UserReviewTargetScope,
} from "@/features/review-runs/domain/userReviewTarget";
import { buildUserReviewsResult } from "@/features/review-runs/hooks/buildUserReviewsResult";
import { useUserReviewList } from "@/features/review-runs/hooks/useUserReviewList";
import { WorkspacePath } from "@/shared/domain/workspacePath";
import {
  useUserReviewOperations,
  type CreateUserReviewInput,
} from "@/features/review-runs/hooks/useUserReviewOperations";
import {
  userReviewCommands as defaultUserReviewCommands,
  type UserReviewCommands,
} from "@/shared/api/tauri";
import type { SpecFileKey } from "@/features/specs/types/spec";

export type { UserReviewListState } from "@/features/review-runs/domain/userReviewListState";
export type {
  UserReviewArchiveState,
  UserReviewCreateState,
} from "@/features/review-runs/domain/userReviewOperation";
export type { UserReviewTargetScope } from "@/features/review-runs/domain/userReviewTarget";
export type { CreateUserReviewInput } from "@/features/review-runs/hooks/useUserReviewOperations";

export type UserReviewsSelectionInput = Readonly<{
  workspacePath: WorkspacePath | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: UserReviewTargetScope;
}>;

export type UseUserReviewsOptions = Readonly<{
  selection: UserReviewsSelectionInput;
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
  const { selection } = options;
  const target = useMemo(
    () =>
      UserReviewTarget.create({
        specId: selection.specId,
        fileKey: selection.fileKey,
        targetScope: selection.targetScope,
      }),
    [selection.fileKey, selection.specId, selection.targetScope],
  );
  const targetIdentity = useMemo(
    () => UserReviewTargetIdentity.create(target),
    [target],
  );
  const list = useUserReviewList({
    commands,
    target,
    workspacePath: selection.workspacePath,
    correlationId: options.correlationId,
  });

  const userReviewOperations = useUserReviewOperations({
    workspacePath: selection.workspacePath,
    target,
    targetIdentity,
    commands,
    onUserReviewEvent: list.applyUserReviewEvent,
  });

  return buildUserReviewsResult({
    list: {
      target,
      listState: list.listState,
      reloadUserReviews: list.reloadUserReviews,
    },
    operations: userReviewOperations,
  });
}
