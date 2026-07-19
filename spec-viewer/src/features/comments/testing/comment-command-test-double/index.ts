import type { Comment } from "@/features/comments/domain/comment";
import {
  type CommentId,
  CommentId as CommentIdValue,
} from "@/features/comments/domain/commentId";
import type {
  AddCommentRequest,
  CommentStatusRequest,
  DeleteCommentRequest,
  DeleteCommentResponse,
  ListCommentsRequest,
  ListCommentsResponse,
  UpdateCommentRequest,
} from "@/features/comments/types/comment";

import type { CommentCommands } from "@/lib/api/tauri";

const commentId: (value: string) => CommentId = CommentIdValue.fromString;

export type CommentCommandTestDoubleResponses = Readonly<{
  listComments?: ListCommentsResponse;
  addComment?: Comment;
  updateComment?: Comment;
  deleteComment?: DeleteCommentResponse;
  resolveComment?: Comment;
  reopenComment?: Comment;
}>;

export type CommentCommandTestDoubleCalls = Readonly<{
  listComments: readonly ListCommentsRequest[];
  addComment: readonly AddCommentRequest[];
  updateComment: readonly UpdateCommentRequest[];
  deleteComment: readonly DeleteCommentRequest[];
  resolveComment: readonly CommentStatusRequest[];
  reopenComment: readonly CommentStatusRequest[];
}>;

export type CommentCommandTestDouble = Readonly<{
  commands: CommentCommands;
  calls: CommentCommandTestDoubleCalls;
}>;

const defaultComment: Comment = {
  id: commentId("cmt_test"),
  anchor: {
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 0,
    textHash: "sha256:test",
    textSnippet: "Clarify this task",
    charRange: {
      start: 0,
      end: 18,
    },
  },
  body: "Clarify this task",
  status: "open",
  createdAt: "2026-05-05T10:00:00Z",
  updatedAt: "2026-05-05T10:00:00Z",
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

  return {
    calls: {
      listComments: listCommentsCalls,
      addComment: addCommentCalls,
      updateComment: updateCommentCalls,
      deleteComment: deleteCommentCalls,
      resolveComment: resolveCommentCalls,
      reopenComment: reopenCommentCalls,
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
          }
        );
      },
    },
  };
}
