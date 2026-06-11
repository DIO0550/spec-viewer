import { useEffect, useMemo, useState } from "react";

import { CommentAnchorDraft } from "@/features/comments/domain/commentAnchorDraft";
import type {
  AddCommentSubmitInput,
  Comment,
  CommentAnchorDraft as CommentAnchorDraftModel,
  CommentId,
} from "@/features/comments/types/comment";
import type { CommentEditDraft } from "@/features/specs/components/MarkdownDocument";
import type { SpecFileKey } from "@/features/specs/types/spec";

type UseCommentDraftsOptions = Readonly<{
  /** File key of the commentable document, or null when comments are unavailable. */
  fileKey: SpecFileKey | null;
  resetKey: string;
  visibleComments: readonly Comment[];
  /** Clears the current text-selection draft owned by the selection hook. */
  clearSelectionDraft: () => void;
  /**
   * @param input - Comment body and anchor submitted from the form
   * @returns Whether the comment was persisted.
   */
  onAddComment?: (input: AddCommentSubmitInput) => Promise<boolean>;
  /**
   * @param commentId - Comment being edited
   * @param body - Replacement body text
   * @returns Whether the update was persisted.
   */
  onUpdateComment?: (commentId: CommentId, body: string) => Promise<boolean>;
  /** @param commentId - Comment to resolve */
  onResolveComment?: (commentId: CommentId) => Promise<boolean>;
  /** @param commentId - Comment to reopen */
  onReopenComment?: (commentId: CommentId) => Promise<boolean>;
  /** @param commentId - Comment to delete */
  onDeleteComment?: (commentId: CommentId) => Promise<boolean>;
}>;

type UseCommentDraftsResult = Readonly<{
  activeAnchorDraft: CommentAnchorDraftModel | null;
  visibleEditDraft: CommentEditDraft | null;
  /** @param draft - Selection-based anchor draft to open in the comment form */
  openSelectionDraft: (draft: CommentAnchorDraftModel) => void;
  /** Closes the add-comment form and clears the browser selection. */
  closeAnchorDraft: () => void;
  /** Closes the edit dialog without saving. */
  closeEditDraft: () => void;
  /** @param draft - Comment edit request with the anchoring bounds */
  requestCommentEdit: (draft: CommentEditDraft) => void;
  /** @param block - Rendered Markdown block targeted by the new draft */
  createBlockDraft: (block: HTMLElement) => void;
  /**
   * @param input - Comment body and anchor submitted from the form
   * @returns Whether the comment was persisted.
   */
  addComment: (input: AddCommentSubmitInput) => Promise<boolean>;
  /**
   * @param commentId - Comment being edited
   * @param body - Replacement body text
   * @returns Whether the update was persisted.
   */
  updateComment: (commentId: CommentId, body: string) => Promise<boolean>;
  /** @param commentId - Comment to resolve */
  resolveComment: (commentId: CommentId) => Promise<boolean>;
  /** @param commentId - Comment to reopen */
  reopenComment: (commentId: CommentId) => Promise<boolean>;
  /** @param commentId - Comment to delete */
  deleteComment: (commentId: CommentId) => Promise<boolean>;
}>;

/** Clears the browser selection once a draft has been handled. */
function clearBrowserSelection(): void {
  document.getSelection()?.removeAllRanges();
}

/**
 * @param draft - Currently requested edit draft
 * @param comments - Comments still visible in the viewer
 * @returns The latest editable draft for a still-visible comment.
 */
function createVisibleCommentEditDraft(
  draft: CommentEditDraft | null,
  comments: readonly Comment[],
): CommentEditDraft | null {
  if (draft === null) {
    return null;
  }

  const currentComment = comments.find(
    (comment) => comment.id === draft.comment.id,
  );

  if (currentComment === undefined) {
    return null;
  }

  return {
    ...draft,
    comment: currentComment,
  };
}

/**
 * Manages add and edit comment drafts plus their save operations.
 *
 * @param options - Document context, visible comments, and persistence callbacks
 * @returns Draft state and operations for the Markdown viewer overlays.
 */
export function useCommentDrafts({
  fileKey,
  resetKey,
  visibleComments,
  clearSelectionDraft,
  onAddComment,
  onUpdateComment,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
}: UseCommentDraftsOptions): UseCommentDraftsResult {
  const [activeAnchorDraft, setActiveAnchorDraft] =
    useState<CommentAnchorDraftModel | null>(null);
  const [activeEditDraft, setActiveEditDraft] =
    useState<CommentEditDraft | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies(resetKey): 表示ドキュメントの切り替え（resetKey変更）を契機に下書きを破棄するための意図的な依存
  useEffect(() => {
    setActiveAnchorDraft(null);
    setActiveEditDraft(null);
  }, [resetKey]);
  useEffect(() => {
    if (activeEditDraft === null) {
      return;
    }

    const isCommentStillVisible = visibleComments.some(
      (comment) => comment.id === activeEditDraft.comment.id,
    );

    if (!isCommentStillVisible) {
      setActiveEditDraft(null);
    }
  }, [activeEditDraft, visibleComments]);

  const visibleEditDraft = useMemo(
    () => createVisibleCommentEditDraft(activeEditDraft, visibleComments),
    [activeEditDraft, visibleComments],
  );

  const openSelectionDraft = (draft: CommentAnchorDraftModel): void => {
    setActiveAnchorDraft(draft);
    clearSelectionDraft();
  };

  const closeAnchorDraft = (): void => {
    setActiveAnchorDraft(null);
    clearBrowserSelection();
  };

  const closeEditDraft = (): void => {
    setActiveEditDraft(null);
  };

  const requestCommentEdit = (draft: CommentEditDraft): void => {
    setActiveAnchorDraft(null);
    clearSelectionDraft();
    clearBrowserSelection();
    setActiveEditDraft(draft);
  };

  const createBlockDraft = (block: HTMLElement): void => {
    if (fileKey === null) {
      return;
    }

    const draft = CommentAnchorDraft.fromBlock({
      block,
      fileKey,
    });

    if (draft === null) {
      return;
    }

    setActiveAnchorDraft(draft);
    clearSelectionDraft();
    clearBrowserSelection();
  };

  const addComment = async (input: AddCommentSubmitInput): Promise<boolean> => {
    if (onAddComment === undefined) {
      return false;
    }

    const wasSaved = await onAddComment(input);

    if (wasSaved) {
      closeAnchorDraft();
    }

    return wasSaved;
  };

  const updateComment = async (
    commentId: CommentId,
    body: string,
  ): Promise<boolean> => {
    if (onUpdateComment === undefined) {
      return false;
    }

    const wasSaved = await onUpdateComment(commentId, body);

    if (wasSaved) {
      closeEditDraft();
    }

    return wasSaved;
  };

  const resolveComment = async (commentId: CommentId): Promise<boolean> => {
    if (onResolveComment === undefined) {
      return false;
    }

    return onResolveComment(commentId);
  };

  const reopenComment = async (commentId: CommentId): Promise<boolean> => {
    if (onReopenComment === undefined) {
      return false;
    }

    return onReopenComment(commentId);
  };

  const deleteComment = async (commentId: CommentId): Promise<boolean> => {
    if (onDeleteComment === undefined) {
      return false;
    }

    const wasDeleted = await onDeleteComment(commentId);

    if (wasDeleted) {
      closeEditDraft();
    }

    return wasDeleted;
  };

  return {
    activeAnchorDraft,
    visibleEditDraft,
    openSelectionDraft,
    closeAnchorDraft,
    closeEditDraft,
    requestCommentEdit,
    createBlockDraft,
    addComment,
    updateComment,
    resolveComment,
    reopenComment,
    deleteComment,
  };
}
