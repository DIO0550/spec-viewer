import type {
  AddCommentRequest,
  Comment,
  CommentStatusRequest,
  DeleteCommentRequest,
  DeleteCommentResponse,
  ListCommentsRequest,
  ListCommentsResponse,
  UpdateCommentRequest,
} from "@/features/comments/types/comment";

export type CommentCommands = Readonly<{
  /**
   * Lists comments for a spec file.
   * @param request - List comments command request.
   */
  listComments: (request: ListCommentsRequest) => Promise<ListCommentsResponse>;
  /**
   * Adds a new comment.
   * @param request - Add comment command request.
   */
  addComment: (request: AddCommentRequest) => Promise<Comment>;
  /**
   * Updates an existing comment.
   * @param request - Update comment command request.
   */
  updateComment: (request: UpdateCommentRequest) => Promise<Comment>;
  /**
   * Deletes a comment.
   * @param request - Delete comment command request.
   */
  deleteComment: (
    request: DeleteCommentRequest,
  ) => Promise<DeleteCommentResponse>;
  /**
   * Marks a comment as resolved.
   * @param request - Resolve comment command request.
   */
  resolveComment: (request: CommentStatusRequest) => Promise<Comment>;
  /**
   * Reopens a resolved comment.
   * @param request - Reopen comment command request.
   */
  reopenComment: (request: CommentStatusRequest) => Promise<Comment>;
  /**
   * Toggles a comment's resolved state.
   * @param request - Toggle comment resolved command request.
   */
  toggleCommentResolved: (request: CommentStatusRequest) => Promise<Comment>;
}>;
