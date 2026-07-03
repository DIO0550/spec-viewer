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
  ToggleCommentResolvedCommandRequest,
  ToggleCommentResolvedCommandResponse,
} from "./toggleCommentResolved";
import { toggleCommentResolved } from "./toggleCommentResolved";
import type {
  UpdateCommentCommandRequest,
  UpdateCommentCommandResponse,
} from "./updateComment";
import { updateComment } from "./updateComment";

export type CommentCommands = Readonly<{
  listComments: (
    request: ListCommentsCommandRequest,
  ) => Promise<ListCommentsCommandResponse>;
  addComment: (
    request: AddCommentCommandRequest,
  ) => Promise<AddCommentCommandResponse>;
  updateComment: (
    request: UpdateCommentCommandRequest,
  ) => Promise<UpdateCommentCommandResponse>;
  deleteComment: (
    request: DeleteCommentCommandRequest,
  ) => Promise<DeleteCommentCommandResponse>;
  resolveComment: (
    request: ResolveCommentCommandRequest,
  ) => Promise<ResolveCommentCommandResponse>;
  reopenComment: (
    request: ReopenCommentCommandRequest,
  ) => Promise<ReopenCommentCommandResponse>;
  toggleCommentResolved: (
    request: ToggleCommentResolvedCommandRequest,
  ) => Promise<ToggleCommentResolvedCommandResponse>;
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
