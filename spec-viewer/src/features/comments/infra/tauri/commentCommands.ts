import type { CommentCommands } from "@/features/comments/application/ports/commentCommands";

import { addComment } from "./addComment";
import { deleteComment } from "./deleteComment";
import { listComments } from "./listComments";
import { reopenComment } from "./reopenComment";
import { resolveComment } from "./resolveComment";
import { toggleCommentResolved } from "./toggleCommentResolved";
import { updateComment } from "./updateComment";

export const commentCommands: CommentCommands = {
  listComments,
  addComment,
  updateComment,
  deleteComment,
  resolveComment,
  reopenComment,
  toggleCommentResolved,
};
