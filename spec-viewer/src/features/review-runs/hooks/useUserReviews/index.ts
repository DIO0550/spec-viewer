import { useMemo } from "react";

import type { UserReviewCommands } from "@/features/review-runs/application/ports/userReviewCommands";
import type { UserReview } from "@/features/review-runs/domain/userReview";
import type {
  UserReviewArchiveFeatureState,
  UserReviewCreateFeatureState,
  UserReviewListFeatureState,
} from "@/features/review-runs/application/userReviewError";
import { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { buildUserReviewsResult } from "@/features/review-runs/hooks/buildUserReviewsResult";
import {
  type UseArchiveUserReviewResult,
  useArchiveUserReview,
} from "@/features/review-runs/hooks/useArchiveUserReview";
import {
  type CreateUserReviewInput,
  type UseCreateUserReviewResult,
  useCreateUserReview,
} from "@/features/review-runs/hooks/useCreateUserReview";
import { useUserReviewList } from "@/features/review-runs/hooks/useUserReviewList";
import { userReviewCommands as defaultUserReviewCommands } from "@/features/review-runs/infra/tauri";
import {
  SelectionIdentity,
  type SpecViewSelection,
} from "@/shared/domain/specViewSelection";

export type {
  UserReviewArchiveFeatureState as UserReviewArchiveState,
  UserReviewCreateFeatureState as UserReviewCreateState,
  UserReviewListFeatureState as UserReviewListState,
} from "@/features/review-runs/application/userReviewError";
export type { UserReviewTargetScope } from "@/features/review-runs/domain/userReviewTarget";
export type { CreateUserReviewInput } from "@/features/review-runs/hooks/useCreateUserReview";

export type UserReviewsSelectionInput = SpecViewSelection;

export type UseUserReviewsOptions = Readonly<{
  selection: SpecViewSelection;
  correlationId?: string | null;
  commands?: UserReviewCommands;
}>;

export type UseUserReviewsResult = Readonly<{
  target: UserReviewTarget | null;
  listState: UserReviewListFeatureState;
  createState: UserReviewCreateFeatureState;
  archiveState: UserReviewArchiveFeatureState;
  activeReviews: readonly UserReview[];
  archivedReviews: readonly UserReview[];
  /** Reloads the user review list. */
  reloadUserReviews: () => Promise<boolean>;
  /** Creates a user review. @param input - The create-review input. */
  createUserReview: (
    input: CreateUserReviewInput,
  ) => Promise<UserReview | null>;
  /** Archives a user review. @param userReviewId - ID of the review to archive. */
  archiveUserReview: (userReviewId: string) => Promise<UserReview | null>;
}>;

/** @returns User review loading and creation state for the selected target. */
export function useUserReviews(
  options: UseUserReviewsOptions,
): UseUserReviewsResult {
  const commands = options.commands ?? defaultUserReviewCommands;
  const selection = options.selection;
  const selectionIdentity = useMemo(
    () => SelectionIdentity.fromSelection(selection),
    [
      selection.fileKey,
      selection.specId,
      selection.targetScope,
      selection.workspacePath,
    ],
  );
  const target = useMemo(
    () => UserReviewTarget.fromSelection(selection),
    [
      selection.fileKey,
      selection.specId,
      selection.targetScope,
      selection.workspacePath,
    ],
  );
  const list = useUserReviewList({
    commands,
    target,
    workspacePath: selection.workspacePath,
    selectionIdentity,
    correlationId: options.correlationId,
  });

  const create: UseCreateUserReviewResult = useCreateUserReview({
    workspacePath: selection.workspacePath,
    target,
    selectionIdentity,
    commands,
    onUserReviewEvent: list.applyUserReviewEvent,
  });
  const archive: UseArchiveUserReviewResult = useArchiveUserReview({
    workspacePath: selection.workspacePath,
    target,
    selectionIdentity,
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
