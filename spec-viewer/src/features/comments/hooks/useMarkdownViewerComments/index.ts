import { useCallback, useEffect, useMemo, useState } from "react";
import type { Comment } from "@/features/comments/domain/comment";
import type { CommentId } from "@/features/comments/domain/commentId";
import {
  areCommentAnchorDisplayStatesEqual,
  createMarkdownCommentProjections,
  type MarkdownCommentProjection,
} from "@/features/comments/lib/markdown-comment-projection";
import type {
  AddCommentSubmitInput,
  CommentAnchorDisplayState,
  CommentAnchorDraft,
  CommentSelectionBounds,
} from "@/features/comments/types/comment";
import type { SpecFileKey } from "@/features/specs";

export type MarkdownViewerCommentActions = Readonly<{
  add: (input: AddCommentSubmitInput) => Promise<boolean>;
  update: (commentId: CommentId, body: string) => Promise<boolean>;
  resolve: (commentId: CommentId) => Promise<boolean>;
  delete: (commentId: CommentId) => Promise<boolean>;
  select: (commentId: CommentId) => void;
  reportAnchorDisplayStates: (
    states: readonly CommentAnchorDisplayState[],
  ) => void;
}>;

export type MarkdownViewerCommentEditDraft = Readonly<{
  comment: Comment;
  selectionBounds: CommentSelectionBounds;
}>;

export type UseMarkdownViewerCommentsOptions = Readonly<{
  fileKey: SpecFileKey;
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  actions: MarkdownViewerCommentActions;
  readAnchorDisplayStates: () => readonly CommentAnchorDisplayState[];
  scrollActiveComment: (comment: Comment) => void;
}>;

export type UseMarkdownViewerCommentsResult = Readonly<{
  anchorDraft: CommentAnchorDraft | null;
  editDraft: MarkdownViewerCommentEditDraft | null;
  anchorDisplayStates: readonly CommentAnchorDisplayState[];
  projections: ReadonlyMap<string, MarkdownCommentProjection>;
  reconcileRenderedDocument: () => void;
  beginAnchorDraft: (draft: CommentAnchorDraft) => void;
  beginEditDraft: (draft: MarkdownViewerCommentEditDraft) => void;
  closeAnchorDraft: () => void;
  closeEditDraft: () => void;
  submitAdd: (input: AddCommentSubmitInput) => Promise<boolean>;
  submitUpdate: (commentId: CommentId, body: string) => Promise<boolean>;
  submitResolve: (commentId: CommentId) => Promise<boolean>;
  submitDelete: (commentId: CommentId) => Promise<boolean>;
}>;

/**
 * Owns Markdown comment workflow state without exposing DOM or JSX details.
 * @param options - Comment data, actions, and component-owned DOM adapters.
 * @returns Stable state transitions consumed by MarkdownCommentLayer.
 */
export function useMarkdownViewerComments({
  fileKey,
  comments,
  activeCommentId,
  actions,
  readAnchorDisplayStates,
  scrollActiveComment,
}: UseMarkdownViewerCommentsOptions): UseMarkdownViewerCommentsResult {
  const [anchorDraft, setAnchorDraft] = useState<CommentAnchorDraft | null>(
    null,
  );
  const [editDraft, setEditDraft] =
    useState<MarkdownViewerCommentEditDraft | null>(null);
  const [anchorDisplayStates, setAnchorDisplayStates] = useState<
    readonly CommentAnchorDisplayState[]
  >([]);
  const visibleComments = useMemo(
    () => comments.filter((comment) => comment.status !== "resolved"),
    [comments],
  );
  const visibleEditDraft = useMemo(() => {
    if (editDraft === null) {
      return null;
    }

    const latestComment = visibleComments.find(
      (comment) => comment.id === editDraft.comment.id,
    );

    if (latestComment === undefined) {
      return null;
    }

    return { ...editDraft, comment: latestComment };
  }, [editDraft, visibleComments]);

  useEffect(() => {
    setAnchorDraft(null);
    setEditDraft(null);
    setAnchorDisplayStates([]);
  }, [fileKey]);

  const reconcileRenderedDocument = useCallback((): void => {
    const nextStates = readAnchorDisplayStates();

    setAnchorDisplayStates((currentStates) =>
      areCommentAnchorDisplayStatesEqual(currentStates, nextStates)
        ? currentStates
        : nextStates,
    );
    actions.reportAnchorDisplayStates(nextStates);
  }, [actions.reportAnchorDisplayStates, readAnchorDisplayStates]);

  useEffect(() => {
    const activeComment = visibleComments.find(
      (comment) => comment.id === activeCommentId,
    );

    if (activeComment === undefined) {
      return;
    }

    scrollActiveComment(activeComment);
  }, [
    activeCommentId,
    anchorDisplayStates,
    scrollActiveComment,
    visibleComments,
  ]);

  const projections = useMemo(
    () =>
      createMarkdownCommentProjections({
        comments: visibleComments,
        activeCommentId,
        anchorDisplayStates,
      }),
    [activeCommentId, anchorDisplayStates, visibleComments],
  );

  const beginAnchorDraft = useCallback((draft: CommentAnchorDraft): void => {
    setEditDraft(null);
    setAnchorDraft(draft);
  }, []);

  const beginEditDraft = useCallback(
    (draft: MarkdownViewerCommentEditDraft): void => {
      setAnchorDraft(null);
      setEditDraft(draft);
    },
    [],
  );

  const closeAnchorDraft = useCallback((): void => {
    setAnchorDraft(null);
  }, []);

  const closeEditDraft = useCallback((): void => {
    setEditDraft(null);
  }, []);

  const submitAdd = useCallback(
    async (input: AddCommentSubmitInput): Promise<boolean> => {
      const wasSaved = await actions.add(input);

      if (wasSaved) {
        closeAnchorDraft();
      }

      return wasSaved;
    },
    [actions.add, closeAnchorDraft],
  );

  const submitUpdate = useCallback(
    async (commentId: CommentId, body: string): Promise<boolean> => {
      const wasSaved = await actions.update(commentId, body);

      if (wasSaved) {
        closeEditDraft();
      }

      return wasSaved;
    },
    [actions.update, closeEditDraft],
  );

  const submitResolve = useCallback(
    async (commentId: CommentId): Promise<boolean> => {
      const wasResolved = await actions.resolve(commentId);

      if (wasResolved) {
        closeEditDraft();
      }

      return wasResolved;
    },
    [actions.resolve, closeEditDraft],
  );

  const submitDelete = useCallback(
    async (commentId: CommentId): Promise<boolean> => {
      const wasDeleted = await actions.delete(commentId);

      if (wasDeleted) {
        closeEditDraft();
      }

      return wasDeleted;
    },
    [actions.delete, closeEditDraft],
  );

  return {
    anchorDraft,
    editDraft: visibleEditDraft,
    anchorDisplayStates,
    projections,
    reconcileRenderedDocument,
    beginAnchorDraft,
    beginEditDraft,
    closeAnchorDraft,
    closeEditDraft,
    submitAdd,
    submitUpdate,
    submitResolve,
    submitDelete,
  };
}
