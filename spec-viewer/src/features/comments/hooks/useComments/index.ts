import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CommentFeatureError as CommentFeatureErrorType } from "@/features/comments/domain/commentError";
import { CommentFeatureError } from "@/features/comments/domain/commentError";
import {
  CommentListState,
  type CommentListState as CommentListStateType,
} from "@/features/comments/domain/commentListState";
import type { CommentOperationState } from "@/features/comments/domain/commentOperation";
import {
  CommentScope,
  type CommentScope as CommentScopeType,
} from "@/features/comments/domain/commentScope";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import { buildCommentsResult } from "@/features/comments/hooks/buildCommentsResult";
import {
  type AddCommentInput,
  type CommentListTransform,
  type UpdateCommentInput,
  useCommentOperations,
} from "@/features/comments/hooks/useCommentOperations";
import { listComments as listCommentsViaGateway } from "@/features/comments/infra/commentGateway";
import type { Comment, CommentId } from "@/features/comments/types/comment";
import {
  SelectionIdentity,
  type SelectionIdentity as SelectionIdentityType,
} from "@/features/specs/domain/specViewSelection";
import type { CommentCommands } from "@/shared/api/tauri";
import { commentCommands as defaultCommentCommands } from "@/shared/api/tauri";
import { ListCommentsCommandError } from "@/shared/api/tauri/listComments";
import {
  resolvePerformanceCorrelationId,
  startPerformanceSpan,
} from "@/shared/lib/performance";

export type { CommentListState } from "@/features/comments/domain/commentListState";
export type {
  CommentOperationKind,
  CommentOperationState,
} from "@/features/comments/domain/commentOperation";
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
  listState: CommentListStateType;
  operationState: CommentOperationState;
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
  const [listState, setListState] = useState<CommentListStateType>(
    CommentListState.idle(),
  );

  useLayoutEffect(() => {
    activeListSelectionIdentityRef.current = selectionIdentity;
    activeListStatusFilterRef.current = statusFilter;
  }, [selectionIdentity, statusFilter]);

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
      setListState((currentState) => {
        const result = CommentListState.applyTransform(currentState, transform);

        if (result.invalidatesRequest) {
          listRequestIdRef.current += 1;
        }

        return result.state;
      });
    },
    [],
  );

  const reloadComments = useCallback(async (): Promise<boolean> => {
    const activeScope = scope;

    if (activeScope === null) {
      listRequestIdRef.current += 1;
      setListState(CommentListState.idle());
      return true;
    }

    const requestId = listRequestIdRef.current + 1;
    const requestSelectionIdentity =
      CommentScope.selectionIdentity(activeScope);
    const requestStatusFilter = statusFilter;
    listRequestIdRef.current = requestId;
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
      endSpan({
        commentCount: response.comments.length,
      });

      if (
        !isLatestListRequest(requestId) ||
        !isSameListScopeResult(requestSelectionIdentity, requestStatusFilter)
      ) {
        return false;
      }

      setListState(CommentListState.loaded(response.comments));
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

      setListState(
        CommentListState.error(
          CommentFeatureError.fromCommandError(
            ListCommentsCommandError.fromUnknown(error),
          ),
        ),
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
