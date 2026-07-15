import type { CommentCommands } from "@/features/comments/application/ports/commentCommands";
import type { CommentBody } from "@/features/comments/domain/commentBody";
import type { CommentScope } from "@/features/comments/domain/commentScope";
import {
  CommentStatusFilter,
  type CommentStatusFilter as CommentStatusFilterType,
} from "@/features/comments/domain/commentStatusFilter";
import type {
  Comment,
  CommentAnchor,
  CommentId,
  CommentStatusRequest,
  DeleteCommentResponse,
  ListCommentsRequest,
  ListCommentsResponse,
} from "@/features/comments/types/comment";

export type AddCommentParam = Readonly<{
  anchor: CommentAnchor;
  body: CommentBody;
}>;

export type UpdateCommentParam = Readonly<{
  commentId: CommentId;
  body: CommentBody;
}>;

/**
 * @param commands - Comment command boundary
 * @param scope - Active comment scope
 * @param statusFilter - Active status filter
 * @param correlationId - Optional performance correlation id
 * @returns Comment list response from the command boundary.
 */
export async function listComments(
  commands: CommentCommands,
  scope: CommentScope,
  statusFilter: CommentStatusFilterType,
  correlationId: string | null,
): Promise<ListCommentsResponse> {
  return commands.listComments(
    createListCommentsRequest(scope, statusFilter, correlationId),
  );
}

/**
 * @param commands - Comment command boundary
 * @param scope - Active comment scope
 * @param param - Comment creation input
 * @returns Persisted comment from the command boundary.
 */
export async function addComment(
  commands: CommentCommands,
  scope: CommentScope,
  param: AddCommentParam,
): Promise<Comment> {
  return commands.addComment({
    workspacePath: scope.workspacePath,
    specId: scope.specId,
    anchor: param.anchor,
    body: param.body,
  });
}

/**
 * @param commands - Comment command boundary
 * @param scope - Active comment scope
 * @param param - Comment update input
 * @returns Updated comment from the command boundary.
 */
export async function updateComment(
  commands: CommentCommands,
  scope: CommentScope,
  param: UpdateCommentParam,
): Promise<Comment> {
  return commands.updateComment({
    ...createStatusRequest(scope, param.commentId),
    body: param.body,
  });
}

/**
 * @param commands - Comment command boundary
 * @param scope - Active comment scope
 * @param commentId - Comment id to delete
 * @returns Delete confirmation from the command boundary.
 */
export async function deleteComment(
  commands: CommentCommands,
  scope: CommentScope,
  commentId: CommentId,
): Promise<DeleteCommentResponse> {
  return commands.deleteComment(createStatusRequest(scope, commentId));
}

/**
 * @param commands - Comment command boundary
 * @param scope - Active comment scope
 * @param commentId - Comment id to resolve
 * @returns Resolved comment from the command boundary.
 */
export async function resolveComment(
  commands: CommentCommands,
  scope: CommentScope,
  commentId: CommentId,
): Promise<Comment> {
  return commands.resolveComment(createStatusRequest(scope, commentId));
}

/**
 * @param commands - Comment command boundary
 * @param scope - Active comment scope
 * @param commentId - Comment id to reopen
 * @returns Reopened comment from the command boundary.
 */
export async function reopenComment(
  commands: CommentCommands,
  scope: CommentScope,
  commentId: CommentId,
): Promise<Comment> {
  return commands.reopenComment(createStatusRequest(scope, commentId));
}

/**
 * @param commands - Comment command boundary
 * @param scope - Active comment scope
 * @param commentId - Comment id to toggle
 * @returns Toggled comment from the command boundary.
 */
export async function toggleCommentResolved(
  commands: CommentCommands,
  scope: CommentScope,
  commentId: CommentId,
): Promise<Comment> {
  return commands.toggleCommentResolved(createStatusRequest(scope, commentId));
}

/**
 * @param scope - Active comment scope
 * @param statusFilter - Active status filter
 * @param correlationId - Optional performance correlation id
 * @returns IPC list request for the selected comment scope.
 */
export function createListCommentsRequest(
  scope: CommentScope,
  statusFilter: CommentStatusFilterType,
  correlationId: string | null,
): ListCommentsRequest {
  const request: ListCommentsRequest = {
    workspacePath: scope.workspacePath,
    specId: scope.specId,
    fileKey: scope.fileKey,
    statusFilter: CommentStatusFilter.toString(statusFilter),
  };

  if (correlationId === null) {
    return request;
  }

  return {
    ...request,
    correlationId,
  };
}

/**
 * @param scope - Active comment scope
 * @param commentId - Comment id targeted by the command
 * @returns IPC status request for commands targeting one comment.
 */
export function createStatusRequest(
  scope: CommentScope,
  commentId: CommentId,
): CommentStatusRequest {
  return {
    workspacePath: scope.workspacePath,
    specId: scope.specId,
    fileKey: scope.fileKey,
    commentId,
  };
}
