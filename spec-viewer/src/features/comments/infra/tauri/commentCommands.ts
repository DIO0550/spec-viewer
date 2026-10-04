import type { CommentCommands } from "@/features/comments/application/commentCommands";
import { addComment } from "./addComment";
import { deleteComment } from "./deleteComment";
import { listComments } from "./listComments";
import { reopenComment } from "./reopenComment";
import { resolveComment } from "./resolveComment";
import { updateComment } from "./updateComment";

export const commentCommands: CommentCommands = {
  listComments,
  addComment,
  updateComment,
  deleteComment,
  resolveComment,
  reopenComment,
};
