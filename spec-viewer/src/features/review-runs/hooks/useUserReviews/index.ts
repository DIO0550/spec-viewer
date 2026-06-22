import { useMemo } from "react";

import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewListState as UserReviewListStateType } from "@/features/review-runs/domain/userReviewListState";
import type {
  UserReviewArchiveState,
  UserReviewCreateState,
} from "@/features/review-runs/domain/userReviewOperation";
import {
  UserReviewTarget,
  type UserReviewTargetScope,
} from "@/features/review-runs/domain/userReviewTarget";
import { buildUserReviewsResult } from "@/features/review-runs/hooks/buildUserReviewsResult";
import {
  useArchiveUserReview,
  type UseArchiveUserReviewResult,
} from "@/features/review-runs/hooks/useArchiveUserReview";
import {
  useCreateUserReview,
  type CreateUserReviewInput,
  type UseCreateUserReviewResult,
} from "@/features/review-runs/hooks/useCreateUserReview";
import { useUserReviewList } from "@/features/review-runs/hooks/useUserReviewList";
import {
  userReviewCommands as defaultUserReviewCommands,
  type UserReviewCommands,
} from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";
import type { SpecFileKey } from "@/features/specs/types/spec";

export type { UserReviewListState } from "@/features/review-runs/domain/userReviewListState";
export type {
  UserReviewArchiveState,
  UserReviewCreateState,
} from "@/features/review-runs/domain/userReviewOperation";
export type { UserReviewTargetScope } from "@/features/review-runs/domain/userReviewTarget";
export type { CreateUserReviewInput } from "@/features/review-runs/hooks/useCreateUserReview";

export type UserReviewsSelectionInput = Readonly<{
  workspacePath: WorkspacePath | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: UserReviewTargetScope;
}>;

export type UserReviewsSelectionSnapshot = Readonly<{
  selection: UserReviewsSelectionInput;
  selectionId: string;
}>;

export type UseUserReviewsOptions = Readonly<{
  selectionSnapshot: UserReviewsSelectionSnapshot;
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
  const { selection, selectionId } = options.selectionSnapshot;
  const target = useMemo(
    () =>
      UserReviewTarget.create({
        specId: selection.specId,
        fileKey: selection.fileKey,
        targetScope: selection.targetScope,
      }),
    [selection.fileKey, selection.specId, selection.targetScope],
  );
  const list = useUserReviewList({
    commands,
    target,
    workspacePath: selection.workspacePath,
    selectionId,
    correlationId: options.correlationId,
  });

  const create: UseCreateUserReviewResult = useCreateUserReview({
    workspacePath: selection.workspacePath,
    target,
    selectionId,
    commands,
    onUserReviewEvent: list.applyUserReviewEvent,
  });
  const archive: UseArchiveUserReviewResult = useArchiveUserReview({
    workspacePath: selection.workspacePath,
    target,
    selectionId,
    commands,
    onUserReviewEvent: list.applyUserReviewEvent,
  });

  return buildUserReviewsResult({
    list: {
      target,
      listState: list.listState,
      reloadUserReviews: list.reloadUserReviews,
    },
    operations: {
      createState: create.createState,
      archiveState: archive.archiveState,
      createUserReview: create.createUserReview,
      archiveUserReview: archive.archiveUserReview,
    },
  });
}
