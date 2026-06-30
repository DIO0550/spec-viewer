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

import { addComment } from "./addComment";
import { deleteComment } from "./deleteComment";
import { listComments } from "./listComments";
import { reopenComment } from "./reopenComment";
import { resolveComment } from "./resolveComment";
import { toggleCommentResolved } from "./toggleCommentResolved";
import { updateComment } from "./updateComment";

export type CommentCommands = Readonly<{
  listComments: (request: ListCommentsRequest) => Promise<ListCommentsResponse>;
  addComment: (request: AddCommentRequest) => Promise<Comment>;
  updateComment: (request: UpdateCommentRequest) => Promise<Comment>;
  deleteComment: (
    request: DeleteCommentRequest,
  ) => Promise<DeleteCommentResponse>;
  resolveComment: (request: CommentStatusRequest) => Promise<Comment>;
  reopenComment: (request: CommentStatusRequest) => Promise<Comment>;
  toggleCommentResolved: (request: CommentStatusRequest) => Promise<Comment>;
}>;

export const commentCommands: CommentCommands = {
  listComments,
  addComment,
  updateComment,
  deleteComment,
  resolveComment,
  reopenComment,
  toggleCommentResolved,
};
