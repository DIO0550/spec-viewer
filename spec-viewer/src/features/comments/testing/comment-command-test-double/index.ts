import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
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
import { commentId, isoDateTime } from "@/shared/testing/validatedValueObjects";

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

const defaultComment: Comment = {
  id: commentId("cmt_test"),
  anchor: createCommentAnchorTestFixture({
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 0,
    textHash: "sha256:7e570001",
    textSnippet: "Clarify this task",
    charRange: {
      start: 0,
      end: 18,
    },
  }),
  body: "Clarify this task",
  status: "open",
  resolved: false,
  createdAt: isoDateTime("2026-05-05T10:00:00Z"),
  updatedAt: isoDateTime("2026-05-05T10:00:00Z"),
};

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
          responses.resolveComment ?? {
            ...comment,
            status: "resolved",
            resolved: true,
          }
        );
      },
      /**
       * Records the reopen request and returns the stubbed reopened comment.
       * @param request - Comment status request to record.
       */
      reopenComment: async (request) => {
        reopenCommentCalls.push(request);
        return (
          responses.reopenComment ?? {
            ...comment,
            status: "open",
            resolved: false,
          }
        );
      },
      /**
       * Records the toggle request and returns the stubbed toggled comment.
       * @param request - Comment status request to record.
       */
      toggleCommentResolved: async (request) => {
        toggleCommentResolvedCalls.push(request);
        return (
          responses.toggleCommentResolved ?? {
            ...comment,
            status: "resolved",
            resolved: true,
          }
        );
      },
    },
  };
}
