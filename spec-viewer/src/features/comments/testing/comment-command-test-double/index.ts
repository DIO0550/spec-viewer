import { Comment as CommentAggregate } from "@/features/comments/domain/comment";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";
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
import type { CommentCommands } from "@/features/comments/application/ports/commentCommands";

export type CommentCommandTestDoubleResponses = Readonly<{
  listComments?: ListCommentsResponse;
  addComment?: Comment;
  updateComment?: Comment;
  deleteComment?: DeleteCommentResponse;
  resolveComment?: Comment;
  reopenComment?: Comment;
  toggleCommentResolved?: Comment;
}>;

export type CommentCommandTestDoubleCalls = Readonly<{
  listComments: readonly ListCommentsRequest[];
  addComment: readonly AddCommentRequest[];
  updateComment: readonly UpdateCommentRequest[];
  deleteComment: readonly DeleteCommentRequest[];
  resolveComment: readonly CommentStatusRequest[];
  reopenComment: readonly CommentStatusRequest[];
  toggleCommentResolved: readonly CommentStatusRequest[];
}>;

export type CommentCommandTestDouble = Readonly<{
  commands: CommentCommands;
  calls: CommentCommandTestDoubleCalls;
}>;

const defaultComment = createCommentTestFixture({ id: "cmt_test" });

/**
 * @param comment - Valid aggregate whose status should change.
 * @param status - Target status for the test response.
 * @returns Aggregate changed through the production status API.
 * @throws Error when the unchanged test timestamp violates aggregate ordering.
 */
function changeCommentStatus(
  comment: Comment,
  status: Comment["status"],
): Comment {
  const result =
    status === "resolved"
      ? CommentAggregate.resolve(comment, { updatedAt: comment.updatedAt })
      : CommentAggregate.reopen(comment, { updatedAt: comment.updatedAt });

  if (!result.ok) {
    throw new Error(result.error.reason);
  }

  return result.value;
}

/**
 * @param comment - Valid aggregate whose status should be inverted.
 * @returns Aggregate toggled through the production status API.
 */
function toggleCommentStatus(comment: Comment): Comment {
  return changeCommentStatus(
    comment,
    CommentAggregate.isResolved(comment) ? "open" : "resolved",
  );
}

/** @returns A typed comment command double for component and hook tests. */
export function createCommentCommandTestDouble(
  responses: CommentCommandTestDoubleResponses = {},
): CommentCommandTestDouble {
  const comment = responses.addComment ?? defaultComment;
  const listCommentsCalls: ListCommentsRequest[] = [];
  const addCommentCalls: AddCommentRequest[] = [];
  const updateCommentCalls: UpdateCommentRequest[] = [];
  const deleteCommentCalls: DeleteCommentRequest[] = [];
  const resolveCommentCalls: CommentStatusRequest[] = [];
  const reopenCommentCalls: CommentStatusRequest[] = [];
  const toggleCommentResolvedCalls: CommentStatusRequest[] = [];

  return {
    calls: {
      listComments: listCommentsCalls,
      addComment: addCommentCalls,
      updateComment: updateCommentCalls,
      deleteComment: deleteCommentCalls,
      resolveComment: resolveCommentCalls,
      reopenComment: reopenCommentCalls,
      toggleCommentResolved: toggleCommentResolvedCalls,
    },
    commands: {
      /**
       * Records the list request and returns the stubbed list response.
       * @param request - List comments request to record.
       */
      listComments: async (request) => {
        listCommentsCalls.push(request);
        return responses.listComments ?? { comments: [comment] };
      },
      /**
       * Records the add request and returns the stubbed comment.
       * @param request - Add comment request to record.
       */
      addComment: async (request) => {
        addCommentCalls.push(request);
        return responses.addComment ?? defaultComment;
      },
      /**
       * Records the update request and returns the stubbed comment.
       * @param request - Update comment request to record.
       */
      updateComment: async (request) => {
        updateCommentCalls.push(request);
        return responses.updateComment ?? comment;
      },
      /**
       * Records the delete request and returns the stubbed delete response.
       * @param request - Delete comment request to record.
       */
      deleteComment: async (request) => {
        deleteCommentCalls.push(request);
        return responses.deleteComment ?? { deleted: true };
      },
      /**
       * Records the resolve request and returns the stubbed resolved comment.
       * @param request - Comment status request to record.
       */
      resolveComment: async (request) => {
        resolveCommentCalls.push(request);
        return (
          responses.resolveComment ?? changeCommentStatus(comment, "resolved")
        );
      },
      /**
       * Records the reopen request and returns the stubbed reopened comment.
       * @param request - Comment status request to record.
       */
      reopenComment: async (request) => {
        reopenCommentCalls.push(request);
        return responses.reopenComment ?? changeCommentStatus(comment, "open");
      },
      /**
       * Records the toggle request and returns the stubbed toggled comment.
       * @param request - Comment status request to record.
       */
      toggleCommentResolved: async (request) => {
        toggleCommentResolvedCalls.push(request);
        return responses.toggleCommentResolved ?? toggleCommentStatus(comment);
      },
    },
  };
}
