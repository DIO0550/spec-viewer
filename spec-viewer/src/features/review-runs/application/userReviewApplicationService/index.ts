import type {
  ActiveUserReview,
  ArchivedUserReview,
} from "@/features/review-runs/domain/userReview";
import type { CreateUserReviewCommandInput } from "@/features/review-runs/domain/createUserReviewCommand";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import type { WorkspacePath } from "@/shared/domain/workspacePath";
import {
  createPerformanceCorrelationId,
  startPerformanceSpan,
} from "@/shared/lib/performance";
import {
  OperationToken,
  type OperationToken as OperationTokenType,
  SelectionIdentity,
  type SelectionIdentity as SelectionIdentityType,
  type UserReviewApplicationEvent,
} from "@/features/review-runs/application/userReviewApplication";
import type {
  ArchiveUserReviewPreparationInput,
  UserReviewUseCases,
} from "@/features/review-runs/application/userReviewUseCases";

export type UserReviewApplicationDispatch = (
  event: UserReviewApplicationEvent,
) => void;

export type ListUserReviewsApplicationInput = Readonly<{
  selectionIdentity: SelectionIdentityType;
  workspacePath: WorkspacePath | null;
  target: UserReviewTarget | null;
  correlationId?: string | null;
}>;

export type CreateUserReviewApplicationInput = CreateUserReviewCommandInput &
  Readonly<{ selectionIdentity: SelectionIdentityType }>;

export type ArchiveUserReviewApplicationInput =
  ArchiveUserReviewPreparationInput &
    Readonly<{ selectionIdentity: SelectionIdentityType }>;

export type UserReviewApplicationService = Readonly<{
  /** Synchronizes the committed selection and invalidates older operations. */
  select: (
    selectionIdentity: SelectionIdentityType,
    dispatch: UserReviewApplicationDispatch,
  ) => void;
  /** @returns Whether the input can create a review. */
  canCreate: (input: CreateUserReviewCommandInput) => boolean;
  /** @returns True when the current selection accepted a list outcome. */
  list: (
    input: ListUserReviewsApplicationInput,
    dispatch: UserReviewApplicationDispatch,
  ) => Promise<boolean>;
  /** @returns Created review, or null for rejected/stale/failed operations. */
  create: (
    input: CreateUserReviewApplicationInput,
    dispatch: UserReviewApplicationDispatch,
  ) => Promise<ActiveUserReview | null>;
  /** @returns Archived review, or null for rejected/stale/failed operations. */
  archive: (
    input: ArchiveUserReviewApplicationInput,
    dispatch: UserReviewApplicationDispatch,
  ) => Promise<ArchivedUserReview | null>;
}>;

/**
 * @param useCases - React- and transport-independent user review use cases.
 * @param initialSelectionIdentity - Selection committed when the service is created.
 * @returns Application orchestrator for tokens, stale guards and emitted state events.
 */
export function createUserReviewApplicationService(
  useCases: UserReviewUseCases,
  initialSelectionIdentity: SelectionIdentityType,
): UserReviewApplicationService {
  let currentSelectionIdentity = initialSelectionIdentity;
  let sequence = 0;
  let listToken: OperationTokenType<"list"> | null = null;
  let createToken: OperationTokenType<"create"> | null = null;
  let archiveToken: OperationTokenType<"archive"> | null = null;

  /** @returns Next token for an operation and selection. */
  function nextToken<TOperation extends "list" | "create" | "archive">(
    operation: TOperation,
    selectionIdentity: SelectionIdentityType,
  ): OperationTokenType<TOperation> {
    sequence += 1;
    return OperationToken.create(operation, selectionIdentity, sequence);
  }

  /** @returns True when a completion still owns the latest operation slot. */
  function isCurrent<TOperation extends "list" | "create" | "archive">(
    token: OperationTokenType<TOperation>,
    latest: OperationTokenType<TOperation> | null,
  ): boolean {
    return (
      latest !== null &&
      SelectionIdentity.equals(
        currentSelectionIdentity,
        token.selectionIdentity,
      ) &&
      OperationToken.equals(latest, token)
    );
  }

  /** @returns True when an operation input belongs to the current selection. */
  function isInputForCurrentSelection(
    selectionIdentity: SelectionIdentityType,
    workspacePath: WorkspacePath | null,
    target: UserReviewTarget | null,
  ): boolean {
    if (
      !SelectionIdentity.equals(currentSelectionIdentity, selectionIdentity)
    ) {
      return false;
    }

    const inputIdentity = SelectionIdentity.create({
      key: selectionIdentity.key,
      workspacePath,
      target,
    });
    return SelectionIdentity.equals(selectionIdentity, inputIdentity);
  }

  return {
    select: (selectionIdentity, dispatch): void => {
      if (
        !SelectionIdentity.equals(currentSelectionIdentity, selectionIdentity)
      ) {
        listToken = null;
        createToken = null;
        archiveToken = null;
      }

      currentSelectionIdentity = selectionIdentity;
      dispatch({ type: "selectionChanged", selectionIdentity });
    },
    canCreate: useCases.canCreate,
    list: async (input, dispatch): Promise<boolean> => {
      if (
        !isInputForCurrentSelection(
          input.selectionIdentity,
          input.workspacePath,
          input.target,
        )
      ) {
        return false;
      }

      if (input.workspacePath === null || input.target === null) {
        listToken = null;
        dispatch({
          type: "listReset",
          selectionIdentity: input.selectionIdentity,
        });
        return true;
      }

      const token = nextToken("list", input.selectionIdentity);
      listToken = token;
      dispatch({ type: "listStarted", token, target: input.target });
      const spanCorrelationId =
        input.correlationId ??
        createPerformanceCorrelationId("review-runs-list");
      const commandCorrelationId =
        input.correlationId === undefined || input.correlationId === null
          ? null
          : spanCorrelationId;
      const endSpan = startPerformanceSpan(
        spanCorrelationId,
        "userReviews.list",
        {
          targetScope: input.target.scope,
          specId: input.target.specId,
          fileKey: input.target.scope === "file" ? input.target.fileKey : null,
        },
      );
      const outcome = await useCases.list({
        workspacePath: input.workspacePath,
        target: input.target,
        correlationId: commandCorrelationId,
      });

      if (outcome.status === "failed") {
        endSpan({ error: true });
        if (!isCurrent(token, listToken)) {
          return false;
        }

        listToken = null;
        dispatch({
          type: "listFailed",
          token,
          target: input.target,
          error: outcome.error,
        });
        return false;
      }

      endSpan({
        activeCount: outcome.collection.active.length,
        archivedCount: outcome.collection.archived.length,
        problemCount: outcome.collection.problems.length,
      });
      if (!isCurrent(token, listToken)) {
        return false;
      }

      listToken = null;
      dispatch({
        type: "listSucceeded",
        token,
        target: input.target,
        collection: outcome.collection,
      });
      return true;
    },
    create: async (input, dispatch): Promise<ActiveUserReview | null> => {
      if (
        !isInputForCurrentSelection(
          input.selectionIdentity,
          input.workspacePath,
          input.target,
        ) ||
        createToken !== null
      ) {
        return null;
      }

      const preparation = useCases.prepareCreate(input);
      if (!preparation.ok) {
        return null;
      }

      const payload = { commentIds: preparation.command.commentIds };
      const token = nextToken("create", input.selectionIdentity);
      createToken = token;
      dispatch({ type: "createStarted", token, payload });
      const outcome = await useCases.create(preparation.command);

      if (!isCurrent(token, createToken)) {
        return null;
      }

      createToken = null;
      if (outcome.status === "failed") {
        dispatch({
          type: "createFailed",
          token,
          payload,
          error: outcome.error,
        });
        return null;
      }

      listToken = null;
      dispatch({
        type: "createSucceeded",
        token,
        payload,
        userReview: outcome.userReview,
      });
      return outcome.userReview;
    },
    archive: async (input, dispatch): Promise<ArchivedUserReview | null> => {
      if (
        !isInputForCurrentSelection(
          input.selectionIdentity,
          input.workspacePath,
          input.target,
        )
      ) {
        return null;
      }

      const preparation = useCases.prepareArchive(input);
      if (!preparation.ok || archiveToken !== null) {
        return null;
      }

      const payload = { userReviewId: input.userReview.id };
      const token = nextToken("archive", input.selectionIdentity);
      archiveToken = token;
      dispatch({ type: "archiveStarted", token, payload });
      const outcome = await useCases.archive(preparation.command);

      if (!isCurrent(token, archiveToken)) {
        return null;
      }

      archiveToken = null;
      if (outcome.status === "failed") {
        dispatch({
          type: "archiveFailed",
          token,
          payload,
          error: outcome.error,
        });
        return null;
      }

      listToken = null;
      dispatch({
        type: "archiveSucceeded",
        token,
        payload,
        userReview: outcome.userReview,
      });
      return outcome.userReview;
    },
  };
}
