import type {
  AddCommentRequest,
  Comment,
  CommentId,
  CommentStatusRequest,
  DeleteCommentRequest,
  DeleteCommentResponse,
  ListCommentsRequest,
  ListCommentsResponse,
  UpdateCommentRequest,
} from "@/features/comments/types/comment";
import { CommentId as CommentIdValue } from "@/features/comments/types/comment";
import type { CommentCommands } from "@/shared/api/tauri";

const commentId: (value: string) => CommentId = CommentIdValue.fromString;

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
  resolved: false,
  createdAt: "2026-05-05T10:00:00Z",
  updatedAt: "2026-05-05T10:00:00Z",
};

/**
 * @param responses - Optional canned responses overriding the defaults
 * @returns A typed comment command double for component and hook tests.
 */
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
       * @param request - The list comments request
       * @returns The configured list response, or a single default comment.
       */
      listComments: async (request) => {
        listCommentsCalls.push(request);
        return responses.listComments ?? { comments: [comment] };
      },
      /**
       * @param request - The add comment request
       * @returns The configured added comment, or the default comment.
       */
      addComment: async (request) => {
        addCommentCalls.push(request);
        return responses.addComment ?? defaultComment;
      },
      /**
       * @param request - The update comment request
       * @returns The configured updated comment, or the resolved base comment.
       */
      updateComment: async (request) => {
        updateCommentCalls.push(request);
        return responses.updateComment ?? comment;
      },
      /**
       * @param request - The delete comment request
       * @returns The configured delete response, or a deleted result.
       */
      deleteComment: async (request) => {
        deleteCommentCalls.push(request);
        return responses.deleteComment ?? { deleted: true };
      },
      /**
       * @param request - The resolve comment status request
       * @returns The configured comment, or the base comment marked resolved.
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
       * @param request - The reopen comment status request
       * @returns The configured comment, or the base comment marked open.
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
       * @param request - The toggle comment status request
       * @returns The configured comment, or the base comment marked resolved.
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
