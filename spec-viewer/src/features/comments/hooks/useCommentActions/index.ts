import type { UseCommentsResult } from "@/features/comments/hooks/useComments";
import type {
  AddCommentSubmitInput,
  CommentId,
} from "@/features/comments/types/comment";

type CommentCommandSource = Pick<
  UseCommentsResult,
  | "addComment"
  | "updateComment"
  | "deleteComment"
  | "resolveComment"
  | "reopenComment"
>;

type UseCommentActionsOptions = Readonly<{
  comments: CommentCommandSource;
  /** @param commentId - Comment persisted by the latest add operation */
  onCommentAdded?: (commentId: CommentId) => void;
  /** @param commentId - Comment whose deletion is about to start */
  onDeleteRequested?: (commentId: CommentId) => void;
}>;

export type UseCommentActionsResult = Readonly<{
  /** @param commentId - Comment to resolve without awaiting the result */
  resolveComment: (commentId: CommentId) => void;
  /** @param commentId - Comment to reopen without awaiting the result */
  reopenComment: (commentId: CommentId) => void;
  /** @param commentId - Comment to delete without awaiting the result */
  deleteComment: (commentId: CommentId) => void;
  /**
   * @param commentId - Comment being edited
   * @param body - Replacement body text
   * @returns Whether the update was persisted.
   */
  updateComment: (commentId: CommentId, body: string) => Promise<boolean>;
  /**
   * @param input - Comment body and anchor submitted from the form
   * @returns Whether the comment was persisted.
   */
  addComment: (input: AddCommentSubmitInput) => Promise<boolean>;
  /** @param commentId - Comment to resolve, reporting success to the caller */
  resolveCommentAndReport: (commentId: CommentId) => Promise<boolean>;
  /** @param commentId - Comment to reopen, reporting success to the caller */
  reopenCommentAndReport: (commentId: CommentId) => Promise<boolean>;
  /** @param commentId - Comment to delete, reporting success to the caller */
  deleteCommentAndReport: (commentId: CommentId) => Promise<boolean>;
}>;

/**
 * Adapts comment commands to the callback shapes used by viewer and sidebar.
 *
 * @param options - Comment commands and selection synchronization callbacks
 * @returns Comment operations in fire-and-forget and result-reporting forms.
 */
export function useCommentActions({
  comments,
  onCommentAdded,
  onDeleteRequested,
}: UseCommentActionsOptions): UseCommentActionsResult {
  const resolveComment = (commentId: CommentId): void => {
    void comments.resolveComment(commentId);
  };

  const reopenComment = (commentId: CommentId): void => {
    void comments.reopenComment(commentId);
  };

  const deleteComment = (commentId: CommentId): void => {
    onDeleteRequested?.(commentId);
    void comments.deleteComment(commentId);
  };

  const updateComment = async (
    commentId: CommentId,
    body: string,
  ): Promise<boolean> => {
    const updatedComment = await comments.updateComment({ commentId, body });

    return updatedComment !== null;
  };

  const addComment = async ({
    anchor,
    body,
  }: AddCommentSubmitInput): Promise<boolean> => {
    const addedComment = await comments.addComment({ anchor, body });

    if (addedComment === null) {
      return false;
    }

    onCommentAdded?.(addedComment.id);
    return true;
  };

  const resolveCommentAndReport = async (
    commentId: CommentId,
  ): Promise<boolean> => {
    const resolvedComment = await comments.resolveComment(commentId);

    return resolvedComment !== null;
  };

  const reopenCommentAndReport = async (
    commentId: CommentId,
  ): Promise<boolean> => {
    const reopenedComment = await comments.reopenComment(commentId);

    return reopenedComment !== null;
  };

  const deleteCommentAndReport = async (
    commentId: CommentId,
  ): Promise<boolean> => {
    onDeleteRequested?.(commentId);

    return comments.deleteComment(commentId);
  };

  return {
    resolveComment,
    reopenComment,
    deleteComment,
    updateComment,
    addComment,
    resolveCommentAndReport,
    reopenCommentAndReport,
    deleteCommentAndReport,
  };
}
