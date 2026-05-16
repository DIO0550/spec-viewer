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
import type { CommentCommands } from "@/shared/api/tauri";

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
  id: "cmt_test",
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
      listComments: async (request) => {
        listCommentsCalls.push(request);
        return responses.listComments ?? { comments: [comment] };
      },
      addComment: async (request) => {
        addCommentCalls.push(request);
        return responses.addComment ?? defaultComment;
      },
      updateComment: async (request) => {
        updateCommentCalls.push(request);
        return responses.updateComment ?? comment;
      },
      deleteComment: async (request) => {
        deleteCommentCalls.push(request);
        return responses.deleteComment ?? { deleted: true };
      },
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
