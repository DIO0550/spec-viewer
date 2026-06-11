import type {
  Comment,
  CommentSelectionBounds,
} from "@/features/comments/types/comment";

export type CommentEditDraft = Readonly<{
  comment: Comment;
  selectionBounds: CommentSelectionBounds;
}>;

export type CreateBlockCommentDraft = (block: HTMLElement) => void;

export type RequestCommentEdit = (input: CommentEditDraft) => void;
