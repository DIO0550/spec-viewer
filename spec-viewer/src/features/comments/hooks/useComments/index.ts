import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CommentOperationFeatureState } from "@/features/comments/application/commentError";
import {
  type CommentFeatureError as CommentFeatureErrorType,
  type CommentListFeatureState,
  toCommentListRestorationFeatureError,
} from "@/features/comments/application/commentError";
import type { CommentCommands } from "@/features/comments/application/ports/commentCommands";
import { CommentListState } from "@/features/comments/domain/commentListState";
import {
  CommentScope,
  type CommentScope as CommentScopeType,
} from "@/features/comments/domain/commentScope";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import { Comments } from "@/features/comments/domain/comments";
import { buildCommentsResult } from "@/features/comments/hooks/buildCommentsResult";
import {
  type AddCommentInput,
  type CommentCollectionSnapshot,
  type CommentListTransform,
  type UpdateCommentInput,
  useCommentOperations,
} from "@/features/comments/hooks/useCommentOperations";
import { listComments as listCommentsViaGateway } from "@/features/comments/infra/commentGateway";
import { commentCommands as defaultCommentCommands } from "@/features/comments/infra/tauri";
import { toCommentFeatureError } from "@/features/comments/infra/tauri/commentErrorMapper";
import type { Comment, CommentId } from "@/features/comments/types/comment";
import {
  SelectionIdentity,
  type SelectionIdentity as SelectionIdentityType,
} from "@/shared/domain/specViewSelection";
import {
  resolvePerformanceCorrelationId,
  startPerformanceSpan,
} from "@/shared/lib/performance";

export type {
  CommentListFeatureState as CommentListState,
  CommentOperationFeatureState as CommentOperationState,
} from "@/features/comments/application/commentError";
export type { CommentOperationKind } from "@/features/comments/domain/commentOperation";
export type {
  AddCommentInput,
  UpdateCommentInput,
} from "@/features/comments/hooks/useCommentOperations";

export type UseCommentsOptions = Readonly<{
  scope: CommentScopeType | null;
  statusFilter?: CommentStatusFilter;
  correlationId?: string | null;
  commands?: CommentCommands;
}>;

export type UseCommentsResult = Readonly<{
  listState: CommentListFeatureState;
  operationState: CommentOperationFeatureState;
  comments: readonly Comment[];
  isLoading: boolean;
  isSaving: boolean;
  isEmpty: boolean;
  error: CommentFeatureErrorType | null;
  operationError: CommentFeatureErrorType | null;
  /** Reloads comments for the active scope. */
  reloadComments: () => Promise<boolean>;
  /** @param input - Anchor and body for the new comment. */
  addComment: (input: AddCommentInput) => Promise<Comment | null>;
  /** @param input - Comment id and new body for the update. */
  updateComment: (input: UpdateCommentInput) => Promise<Comment | null>;
  /** @param commentId - Id of the comment to delete. */
  deleteComment: (commentId: CommentId) => Promise<boolean>;
  /** @param commentId - Id of the comment to resolve. */
  resolveComment: (commentId: CommentId) => Promise<Comment | null>;
  /** @param commentId - Id of the comment to reopen. */
  reopenComment: (commentId: CommentId) => Promise<Comment | null>;
  /** @param commentId - Id of the comment to toggle. */
  toggleCommentResolved: (commentId: CommentId) => Promise<Comment | null>;
}>;

const defaultStatusFilter: CommentStatusFilter = CommentStatusFilter.All;

/** @returns Comment loading and operation state for the selected spec file. */
export function useComments({
  commands = defaultCommentCommands,
  correlationId = null,
  scope,
  statusFilter = defaultStatusFilter,
}: UseCommentsOptions): UseCommentsResult {
  const selectionIdentity =
    scope === null ? null : CommentScope.selectionIdentity(scope);
  const listRequestIdRef = useRef(0);
  const activeListSelectionIdentityRef = useRef(selectionIdentity);
  const activeListStatusFilterRef = useRef(statusFilter);
  const currentScopeSnapshotRef = useRef<CommentCollectionSnapshot>({
    comments: [],
    revision: 0,
    isLoading: false,
    selectionIdentity,
    statusFilter,
  });
  const [listState, setListState] = useState<CommentListFeatureState>(
    CommentListState.idle(),
  );

  useLayoutEffect(() => {
    const selectionChanged = !isSameSelectionIdentity(
      activeListSelectionIdentityRef.current,
      selectionIdentity,
    );
    const statusFilterChanged =
      activeListStatusFilterRef.current !== statusFilter;
    activeListSelectionIdentityRef.current = selectionIdentity;
    activeListStatusFilterRef.current = statusFilter;

    if (!selectionChanged && !statusFilterChanged) {
      return;
    }

    currentScopeSnapshotRef.current = {
      ...currentScopeSnapshotRef.current,
      comments: [],
      isLoading: false,
      selectionIdentity,
      statusFilter,
    };
  }, [selectionIdentity, statusFilter]);

  const getCurrentScopeSnapshot = useCallback(
    (): CommentCollectionSnapshot => currentScopeSnapshotRef.current,
    [],
  );

  const isLatestListRequest = useCallback(
    (requestId: number): boolean => listRequestIdRef.current === requestId,
    [],
  );
  const isSameListScopeResult = useCallback(
    (
      expectedIdentity: SelectionIdentityType,
      expectedStatusFilter: CommentStatusFilter,
    ): boolean =>
      activeListStatusFilterRef.current === expectedStatusFilter &&
      activeListSelectionIdentityRef.current !== null &&
      SelectionIdentity.equals(
        activeListSelectionIdentityRef.current,
        expectedIdentity,
      ),
    [],
  );
  const updateCurrentScopeComments = useCallback(
    (transform: CommentListTransform): void => {
      const currentSnapshot = currentScopeSnapshotRef.current;
      const nextComments = transform(currentSnapshot.comments);
      if (nextComments === currentSnapshot.comments) {
        return;
      }

      if (currentSnapshot.isLoading) {
        listRequestIdRef.current += 1;
      }
      currentScopeSnapshotRef.current = {
        ...currentSnapshot,
        comments: nextComments,
        isLoading: false,
      };

      setListState((currentState) => {
        const result = CommentListState.applyTransform(
          currentState,
          () => nextComments,
        );
        return result.state;
      });
    },
    [],
  );

  const reloadComments = useCallback(async (): Promise<boolean> => {
    const activeScope = scope;

    if (activeScope === null) {
      listRequestIdRef.current += 1;
      currentScopeSnapshotRef.current = {
        ...currentScopeSnapshotRef.current,
        comments: [],
        isLoading: false,
        selectionIdentity: null,
        statusFilter,
      };
      setListState(CommentListState.idle());
      return true;
    }

    const requestId = listRequestIdRef.current + 1;
    const requestSelectionIdentity =
      CommentScope.selectionIdentity(activeScope);
    const requestStatusFilter = statusFilter;
    listRequestIdRef.current = requestId;
    const currentSnapshot = currentScopeSnapshotRef.current;
    const snapshotOwnsRequestView =
      currentSnapshot.statusFilter === requestStatusFilter &&
      isSameSelectionIdentity(
        currentSnapshot.selectionIdentity,
        requestSelectionIdentity,
      );
    currentScopeSnapshotRef.current = {
      ...currentSnapshot,
      comments: snapshotOwnsRequestView ? currentSnapshot.comments : [],
      isLoading: true,
      selectionIdentity: requestSelectionIdentity,
      statusFilter: requestStatusFilter,
    };
    setListState(CommentListState.loading());

    const endSpan = startPerformanceSpan(
      resolvePerformanceCorrelationId(correlationId, "comments-list"),
      "comments.list",
      {
        specId: activeScope.specId,
        fileKey: activeScope.fileKey,
        statusFilter,
      },
    );

    try {
      const response = await listCommentsViaGateway(
        commands,
        activeScope,
        statusFilter,
        correlationId,
      );

      if (
        !isLatestListRequest(requestId) ||
        !isSameListScopeResult(requestSelectionIdentity, requestStatusFilter)
      ) {
        endSpan({ commentCount: response.comments.length });
        return false;
      }

      const restoredComments = Comments.restoreList(
        response.comments,
        requestStatusFilter,
      );
      if (!restoredComments.ok) {
        endSpan({ error: true });
        currentScopeSnapshotRef.current = {
          comments: [],
          revision: currentScopeSnapshotRef.current.revision + 1,
          isLoading: false,
          selectionIdentity: requestSelectionIdentity,
          statusFilter: requestStatusFilter,
        };
        setListState(
          CommentListState.error(
            toCommentListRestorationFeatureError(restoredComments.error),
          ),
        );
        return false;
      }

      endSpan({ commentCount: restoredComments.value.length });
      currentScopeSnapshotRef.current = {
        comments: restoredComments.value,
        revision: currentScopeSnapshotRef.current.revision + 1,
        isLoading: false,
        selectionIdentity: requestSelectionIdentity,
        statusFilter: requestStatusFilter,
      };
      setListState(CommentListState.loaded(restoredComments.value));
      return true;
    } catch (error) {
      endSpan({
        error: true,
      });

      if (
        !isLatestListRequest(requestId) ||
        !isSameListScopeResult(requestSelectionIdentity, requestStatusFilter)
      ) {
        return false;
      }

      currentScopeSnapshotRef.current = {
        comments: [],
        revision: currentScopeSnapshotRef.current.revision + 1,
        isLoading: false,
        selectionIdentity: requestSelectionIdentity,
        statusFilter: requestStatusFilter,
      };
      setListState(
        CommentListState.error(toCommentFeatureError("list", error)),
      );
      return false;
    }
  }, [
    commands,
    correlationId,
    isLatestListRequest,
    isSameListScopeResult,
    scope,
    statusFilter,
  ]);

  useEffect(() => {
    void reloadComments();
  }, [reloadComments]);

  const commentOperations = useCommentOperations({
    scope,
    selectionIdentity,
    statusFilter,
    commands,
    currentComments: listState.comments,
    getCurrentScopeSnapshot,
    isListLoading: CommentListState.isLoading(listState),
    listCollectionRevision: currentScopeSnapshotRef.current.revision,
    updateCurrentScopeComments,
    reloadComments,
  });

  return buildCommentsResult({
    list: {
      listState,
      reloadComments,
    },
    operations: commentOperations,
  });
}

/**
 * @param left - First nullable selection identity.
 * @param right - Second nullable selection identity.
 * @returns True when both identities refer to the same selection.
 */
function isSameSelectionIdentity(
  left: SelectionIdentityType | null,
  right: SelectionIdentityType | null,
): boolean {
  if (left === null) {
    return right === null;
  }

  if (right === null) {
    return false;
  }

  return SelectionIdentity.equals(left, right);
}
