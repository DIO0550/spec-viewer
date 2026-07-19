import type {
  AddCommentCommandRequest,
  AddCommentCommandResponse,
} from "./addComment";
import { addComment } from "./addComment";
import type {
  DeleteCommentCommandRequest,
  DeleteCommentCommandResponse,
} from "./deleteComment";
import { deleteComment } from "./deleteComment";
import type {
  ListCommentsCommandRequest,
  ListCommentsCommandResponse,
} from "./listComments";
import { listComments } from "./listComments";
import type {
  ReopenCommentCommandRequest,
  ReopenCommentCommandResponse,
} from "./reopenComment";
import { reopenComment } from "./reopenComment";
import type {
  ResolveCommentCommandRequest,
  ResolveCommentCommandResponse,
} from "./resolveComment";
import { resolveComment } from "./resolveComment";
import type {
  UpdateCommentCommandRequest,
  UpdateCommentCommandResponse,
} from "./updateComment";
import { updateComment } from "./updateComment";

export type CommentCommands = Readonly<{
  /**
   * Lists comments for a spec file.
   * @param request - List comments command request.
   */
  listComments: (
    request: ListCommentsCommandRequest,
  ) => Promise<ListCommentsCommandResponse>;
  /**
   * Adds a new comment.
   * @param request - Add comment command request.
   */
  addComment: (
    request: AddCommentCommandRequest,
  ) => Promise<AddCommentCommandResponse>;
  /**
   * Updates an existing comment.
   * @param request - Update comment command request.
   */
  updateComment: (
    request: UpdateCommentCommandRequest,
  ) => Promise<UpdateCommentCommandResponse>;
  /**
   * Deletes a comment.
   * @param request - Delete comment command request.
   */
  deleteComment: (
    request: DeleteCommentCommandRequest,
  ) => Promise<DeleteCommentCommandResponse>;
  /**
   * Marks a comment as resolved.
   * @param request - Resolve comment command request.
   */
  resolveComment: (
    request: ResolveCommentCommandRequest,
  ) => Promise<ResolveCommentCommandResponse>;
  /**
   * Reopens a resolved comment.
   * @param request - Reopen comment command request.
   */
  reopenComment: (
    request: ReopenCommentCommandRequest,
  ) => Promise<ReopenCommentCommandResponse>;
}>;

export const commentCommands: CommentCommands = {
  listComments,
  addComment,
  updateComment,
  deleteComment,
  resolveComment,
  reopenComment,
};
