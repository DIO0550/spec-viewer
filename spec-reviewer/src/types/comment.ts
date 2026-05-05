import type { SpecFileKey } from "./spec";

export type CommentId = string;

export type IsoDateTimeString = string;

export type CommentBlockType =
  | "paragraph"
  | "heading"
  | "list_item"
  | "code_block"
  | "block_quote"
  | "table"
  | "thematic_break"
  | "html"
  | "other";

export type CommentStatus = "open" | "resolved";

export type CommentStatusFilter = "all" | CommentStatus;

export type CommentDisplayState = CommentStatus | "orphaned";

export type CommentCharRange = Readonly<{
  start: number;
  end: number;
}>;

export type CommentAnchor = Readonly<{
  fileKey: SpecFileKey;
  blockType: CommentBlockType;
  blockIndex: number;
  textHash: string;
  textSnippet: string;
  charRange: CommentCharRange;
}>;

export type Comment = Readonly<{
  id: CommentId;
  anchor: CommentAnchor;
  body: string;
  status: CommentStatus;
  resolved: boolean;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}>;

export type CommentViewModel = Readonly<{
  comment: Comment;
  displayState: CommentDisplayState;
  isResolved: boolean;
  isOrphaned: boolean;
  canJumpToAnchor: boolean;
}>;

export type ListCommentsRequest = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
  statusFilter?: CommentStatusFilter | null;
}>;

export type AddCommentRequest = Readonly<{
  workspacePath: string;
  specId: string;
  anchor: CommentAnchor;
  body: string;
}>;

export type UpdateCommentRequest = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
  commentId: CommentId;
  body: string;
}>;

export type DeleteCommentRequest = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
  commentId: CommentId;
}>;

export type CommentStatusRequest = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
  commentId: CommentId;
}>;

export type ListCommentsResponse = Readonly<{
  comments: readonly Comment[];
}>;

export type DeleteCommentResponse = Readonly<{
  deleted: boolean;
}>;

export type CommentCommandPayloads = Readonly<{
  list_comments: Readonly<{
    request: ListCommentsRequest;
    response: ListCommentsResponse;
  }>;
  add_comment: Readonly<{
    request: AddCommentRequest;
    response: Comment;
  }>;
  update_comment: Readonly<{
    request: UpdateCommentRequest;
    response: Comment;
  }>;
  delete_comment: Readonly<{
    request: DeleteCommentRequest;
    response: DeleteCommentResponse;
  }>;
  resolve_comment: Readonly<{
    request: CommentStatusRequest;
    response: Comment;
  }>;
  reopen_comment: Readonly<{
    request: CommentStatusRequest;
    response: Comment;
  }>;
  toggle_comment_resolved: Readonly<{
    request: CommentStatusRequest;
    response: Comment;
  }>;
}>;
