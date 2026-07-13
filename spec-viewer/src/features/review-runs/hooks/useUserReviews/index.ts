import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

import type { UserReviewRepository } from "@/features/review-runs/application/ports/userReviewRepository";
import {
  SelectionIdentity,
  UserReviewApplicationState,
} from "@/features/review-runs/application/userReviewApplication";
import { createUserReviewApplicationService } from "@/features/review-runs/application/userReviewApplicationService";
import { createUserReviewUseCases } from "@/features/review-runs/application/userReviewUseCases";
import type { CreateUserReviewCommandInput } from "@/features/review-runs/domain/createUserReviewCommand";
import type {
  ActiveUserReview,
  ArchivedUserReview,
} from "@/features/review-runs/domain/userReview";
import type { UserReviewListState as UserReviewListStateType } from "@/features/review-runs/domain/userReviewListState";
import type {
  UserReviewArchiveState,
  UserReviewCreateState,
} from "@/features/review-runs/domain/userReviewOperation";
import {
  UserReviewTarget,
  type UserReviewTargetScope,
} from "@/features/review-runs/domain/userReviewTarget";
import type { SpecFileKey } from "@/features/specs/types/spec";
import type { WorkspacePath } from "@/shared/domain/workspacePath";

export type { UserReviewListState } from "@/features/review-runs/domain/userReviewListState";
export type {
  UserReviewArchiveState,
  UserReviewCreateState,
} from "@/features/review-runs/domain/userReviewOperation";
export type { UserReviewTargetScope } from "@/features/review-runs/domain/userReviewTarget";

export type CreateUserReviewInput = Pick<
  CreateUserReviewCommandInput,
  "commentIds"
>;

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
  repository: UserReviewRepository;
  correlationId?: string | null;
}>;

export type UseUserReviewsResult = Readonly<{
  target: UserReviewTarget | null;
  listState: UserReviewListStateType;
  createState: UserReviewCreateState;
  archiveState: UserReviewArchiveState;
  activeReviews: readonly ActiveUserReview[];
  archivedReviews: readonly ArchivedUserReview[];
  /** Reloads the user review list. */
  reloadUserReviews: () => Promise<boolean>;
  /** @returns True when the current selection can create a review. */
  canCreateUserReview: (input: CreateUserReviewInput) => boolean;
  /** Creates a user review. @param input - The create-review input. */
  createUserReview: (
    input: CreateUserReviewInput,
  ) => Promise<ActiveUserReview | null>;
  /** Archives a user review. @param userReview - Aggregate to archive. */
  archiveUserReview: (
    userReview: ActiveUserReview,
  ) => Promise<ArchivedUserReview | null>;
}>;

/** @returns User review application state adapted to the selected React view. */
export function useUserReviews(
  options: UseUserReviewsOptions,
): UseUserReviewsResult {
  const { correlationId, repository } = options;
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
  const selectionIdentity = useMemo(
    () =>
      SelectionIdentity.create({
        key: selectionId,
        workspacePath: selection.workspacePath,
        target,
      }),
    [selection.workspacePath, selectionId, target],
  );
  const initialSelectionIdentity = useRef(selectionIdentity);
  const useCases = useMemo(
    () => createUserReviewUseCases(repository),
    [repository],
  );
  const service = useMemo(
    () =>
      createUserReviewApplicationService(
        useCases,
        initialSelectionIdentity.current,
      ),
    [useCases],
  );
  const [applicationState, dispatch] = useReducer(
    UserReviewApplicationState.reduce,
    selectionIdentity,
    UserReviewApplicationState.initial,
  );

  useLayoutEffect(() => {
    service.select(selectionIdentity, dispatch);
  }, [selectionIdentity, service]);

  const reloadUserReviews = useCallback(
    (): Promise<boolean> =>
      service.list(
        {
          selectionIdentity,
          workspacePath: selection.workspacePath,
          target,
          correlationId,
        },
        dispatch,
      ),
    [
      correlationId,
      selection.workspacePath,
      selectionIdentity,
      service,
      target,
    ],
  );

  useEffect(() => {
    void reloadUserReviews();
  }, [reloadUserReviews]);

  const canCreateUserReview = useCallback(
    (input: CreateUserReviewInput): boolean =>
      service.canCreate({
        workspacePath: selection.workspacePath,
        target,
        commentIds: input.commentIds,
      }),
    [selection.workspacePath, service, target],
  );
  const createUserReview = useCallback(
    (input: CreateUserReviewInput): Promise<ActiveUserReview | null> =>
      service.create(
        {
          selectionIdentity,
          workspacePath: selection.workspacePath,
          target,
          commentIds: input.commentIds,
        },
        dispatch,
      ),
    [selection.workspacePath, selectionIdentity, service, target],
  );
  const archiveUserReview = useCallback(
    (userReview: ActiveUserReview): Promise<ArchivedUserReview | null> =>
      service.archive(
        {
          selectionIdentity,
          workspacePath: selection.workspacePath,
          target,
          userReview,
        },
        dispatch,
      ),
    [selection.workspacePath, selectionIdentity, service, target],
  );
  const state = SelectionIdentity.equals(
    applicationState.selectionIdentity,
    selectionIdentity,
  )
    ? applicationState
    : UserReviewApplicationState.initial(selectionIdentity);

  return {
    target,
    listState: state.listState,
    createState: state.createState,
    archiveState: state.archiveState,
    activeReviews: state.listState.active,
    archivedReviews: state.listState.archived,
    reloadUserReviews,
    canCreateUserReview,
    createUserReview,
    archiveUserReview,
  };
}
