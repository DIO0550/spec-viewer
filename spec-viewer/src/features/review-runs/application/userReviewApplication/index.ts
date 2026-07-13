import type {
  ActiveUserReview,
  ArchivedUserReview,
} from "@/features/review-runs/domain/userReview";
import type { UserReviewCollection } from "@/features/review-runs/domain/userReviewCollection";
import type { UserReviewFeatureError } from "@/features/review-runs/domain/userReviewError";
import {
  UserReviewListState,
  type UserReviewListState as UserReviewListStateType,
} from "@/features/review-runs/domain/userReviewListState";
import {
  type ArchiveUserReviewPayload,
  type CreateUserReviewPayload,
  UserReviewArchiveState,
  type UserReviewArchiveState as UserReviewArchiveStateType,
  UserReviewCreateState,
  type UserReviewCreateState as UserReviewCreateStateType,
} from "@/features/review-runs/domain/userReviewOperation";
import {
  UserReviewTarget,
  type UserReviewTarget as UserReviewTargetType,
} from "@/features/review-runs/domain/userReviewTarget";
import {
  WorkspacePath,
  type WorkspacePath as WorkspacePathType,
} from "@/shared/domain/workspacePath";

declare const selectionIdentityBrand: unique symbol;

export type SelectionIdentity = Readonly<{
  key: string;
  workspacePath: WorkspacePathType | null;
  target: UserReviewTargetType | null;
  readonly [selectionIdentityBrand]: true;
}>;

export type SelectionIdentityInput = Readonly<{
  key: string;
  workspacePath: WorkspacePathType | null;
  target: UserReviewTargetType | null;
}>;

export const SelectionIdentity = {
  /**
   * @param input - Opaque upstream key plus structured workspace and target identity.
   * @returns Structured identity used by application stale guards.
   */
  create(input: SelectionIdentityInput): SelectionIdentity {
    return input as SelectionIdentity;
  },

  /**
   * @param current - First selection identity.
   * @param other - Second selection identity.
   * @returns True when both identities describe the same committed selection.
   */
  equals(current: SelectionIdentity, other: SelectionIdentity): boolean {
    if (current.key !== other.key) {
      return false;
    }

    if (current.workspacePath === null && other.workspacePath !== null) {
      return false;
    }

    if (current.workspacePath !== null && other.workspacePath === null) {
      return false;
    }

    if (current.workspacePath !== null && other.workspacePath !== null) {
      if (
        WorkspacePath.toString(current.workspacePath) !==
        WorkspacePath.toString(other.workspacePath)
      ) {
        return false;
      }
    }

    if (current.target === null || other.target === null) {
      return current.target === other.target;
    }

    return UserReviewTarget.equals(current.target, other.target);
  },
} as const;

export type UserReviewOperation = "list" | "create" | "archive";

export type OperationToken<
  TOperation extends UserReviewOperation = UserReviewOperation,
> = Readonly<{
  operation: TOperation;
  selectionIdentity: SelectionIdentity;
  sequence: number;
}>;

export const OperationToken = {
  /**
   * @param operation - Operation represented by the token.
   * @param selectionIdentity - Selection captured when the operation started.
   * @param sequence - Monotonic application operation sequence.
   * @returns Immutable operation token.
   */
  create<TOperation extends UserReviewOperation>(
    operation: TOperation,
    selectionIdentity: SelectionIdentity,
    sequence: number,
  ): OperationToken<TOperation> {
    return { operation, selectionIdentity, sequence };
  },

  /**
   * @param current - Current operation token.
   * @param other - Completed operation token.
   * @returns True when both references identify the same operation instance.
   */
  equals<TOperation extends UserReviewOperation>(
    current: OperationToken<TOperation>,
    other: OperationToken<TOperation>,
  ): boolean {
    return current === other;
  },
} as const;

export type UserReviewApplicationState = Readonly<{
  selectionIdentity: SelectionIdentity;
  listToken: OperationToken<"list"> | null;
  createToken: OperationToken<"create"> | null;
  archiveToken: OperationToken<"archive"> | null;
  listState: UserReviewListStateType;
  createState: UserReviewCreateStateType;
  archiveState: UserReviewArchiveStateType;
}>;

export type UserReviewApplicationEvent =
  | Readonly<{
      type: "selectionChanged";
      selectionIdentity: SelectionIdentity;
    }>
  | Readonly<{
      type: "listReset";
      selectionIdentity: SelectionIdentity;
    }>
  | Readonly<{
      type: "listStarted";
      token: OperationToken<"list">;
      target: UserReviewTargetType;
    }>
  | Readonly<{
      type: "listSucceeded";
      token: OperationToken<"list">;
      target: UserReviewTargetType;
      collection: UserReviewCollection;
    }>
  | Readonly<{
      type: "listFailed";
      token: OperationToken<"list">;
      target: UserReviewTargetType;
      error: UserReviewFeatureError;
    }>
  | Readonly<{
      type: "createStarted";
      token: OperationToken<"create">;
      payload: CreateUserReviewPayload;
    }>
  | Readonly<{
      type: "createSucceeded";
      token: OperationToken<"create">;
      payload: CreateUserReviewPayload;
      userReview: ActiveUserReview;
    }>
  | Readonly<{
      type: "createFailed";
      token: OperationToken<"create">;
      payload: CreateUserReviewPayload;
      error: UserReviewFeatureError;
    }>
  | Readonly<{
      type: "archiveStarted";
      token: OperationToken<"archive">;
      payload: ArchiveUserReviewPayload;
    }>
  | Readonly<{
      type: "archiveSucceeded";
      token: OperationToken<"archive">;
      payload: ArchiveUserReviewPayload;
      userReview: ArchivedUserReview;
    }>
  | Readonly<{
      type: "archiveFailed";
      token: OperationToken<"archive">;
      payload: ArchiveUserReviewPayload;
      error: UserReviewFeatureError;
    }>;

export const UserReviewApplicationState = {
  /**
   * @param selectionIdentity - Initial committed selection.
   * @returns Idle application state for list/create/archive.
   */
  initial(selectionIdentity: SelectionIdentity): UserReviewApplicationState {
    return {
      selectionIdentity,
      listToken: null,
      createToken: null,
      archiveToken: null,
      listState: UserReviewListState.idle(),
      createState: UserReviewCreateState.idle(),
      archiveState: UserReviewArchiveState.idle(),
    };
  },

  /**
   * @param state - Current application state.
   * @param event - Application operation event.
   * @returns Next state after stale-token and collection reconciliation.
   */
  reduce(
    state: UserReviewApplicationState,
    event: UserReviewApplicationEvent,
  ): UserReviewApplicationState {
    switch (event.type) {
      case "selectionChanged":
        if (
          SelectionIdentity.equals(
            state.selectionIdentity,
            event.selectionIdentity,
          )
        ) {
          return state;
        }

        return UserReviewApplicationState.initial(event.selectionIdentity);
      case "listReset":
        if (
          !SelectionIdentity.equals(
            state.selectionIdentity,
            event.selectionIdentity,
          )
        ) {
          return state;
        }

        return {
          ...state,
          listToken: null,
          listState: UserReviewListState.idle(),
        };
      case "listStarted":
        if (!belongsToSelection(state, event.token)) {
          return state;
        }

        return {
          ...state,
          listToken: event.token,
          listState: UserReviewListState.loading(event.target),
        };
      case "listSucceeded":
        if (!matchesActiveToken(state.listToken, event.token)) {
          return state;
        }

        return {
          ...state,
          listToken: null,
          listState: UserReviewListState.loaded(event.target, event.collection),
        };
      case "listFailed":
        if (!matchesActiveToken(state.listToken, event.token)) {
          return state;
        }

        return {
          ...state,
          listToken: null,
          listState: UserReviewListState.error(event.target, event.error),
        };
      case "createStarted":
        if (!belongsToSelection(state, event.token)) {
          return state;
        }

        return {
          ...state,
          createToken: event.token,
          createState: UserReviewCreateState.saving(event.payload),
        };
      case "createSucceeded":
        if (!matchesActiveToken(state.createToken, event.token)) {
          return state;
        }

        return applyCreatedReview(state, event);
      case "createFailed":
        if (!matchesActiveToken(state.createToken, event.token)) {
          return state;
        }

        return {
          ...state,
          createToken: null,
          createState: UserReviewCreateState.error(event.payload, event.error),
        };
      case "archiveStarted":
        if (!belongsToSelection(state, event.token)) {
          return state;
        }

        return {
          ...state,
          archiveToken: event.token,
          archiveState: UserReviewArchiveState.saving(event.payload),
        };
      case "archiveSucceeded":
        if (!matchesActiveToken(state.archiveToken, event.token)) {
          return state;
        }

        return applyArchivedReview(state, event);
      case "archiveFailed":
        if (!matchesActiveToken(state.archiveToken, event.token)) {
          return state;
        }

        return {
          ...state,
          archiveToken: null,
          archiveState: UserReviewArchiveState.error(
            event.payload,
            event.error,
          ),
        };
    }
  },
} as const;

/** @returns True when a token belongs to the current selection. */
function belongsToSelection(
  state: UserReviewApplicationState,
  token: OperationToken,
): boolean {
  return SelectionIdentity.equals(
    state.selectionIdentity,
    token.selectionIdentity,
  );
}

/** @returns True when the completion matches the active token. */
function matchesActiveToken<TOperation extends UserReviewOperation>(
  active: OperationToken<TOperation> | null,
  completed: OperationToken<TOperation>,
): boolean {
  return active !== null && OperationToken.equals(active, completed);
}

/** @returns State after applying a successful create and invalidating list. */
function applyCreatedReview(
  state: UserReviewApplicationState,
  event: Extract<UserReviewApplicationEvent, { type: "createSucceeded" }>,
): UserReviewApplicationState {
  const listResult = UserReviewListState.reduceUserReviewEvent(
    state.listState,
    { type: "reviewCreated", review: event.userReview },
  );

  return {
    ...state,
    listToken: null,
    createToken: null,
    listState: listResult.state,
    createState: UserReviewCreateState.success(event.payload, event.userReview),
  };
}

/** @returns State after applying a successful archive and invalidating list. */
function applyArchivedReview(
  state: UserReviewApplicationState,
  event: Extract<UserReviewApplicationEvent, { type: "archiveSucceeded" }>,
): UserReviewApplicationState {
  const listResult = UserReviewListState.reduceUserReviewEvent(
    state.listState,
    { type: "reviewArchived", review: event.userReview },
  );

  return {
    ...state,
    listToken: null,
    archiveToken: null,
    listState: listResult.state,
    archiveState: UserReviewArchiveState.success(
      event.payload,
      event.userReview,
    ),
  };
}
