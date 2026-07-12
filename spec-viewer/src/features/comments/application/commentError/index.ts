import type { CommentError } from "@/features/comments/domain/commentError";
import type { CommentListState } from "@/features/comments/domain/commentListState";
import type { CommentOperationState } from "@/features/comments/domain/commentOperation";

export type CommentFeatureErrorCode =
  | "invalidComment"
  | "commentRepository"
  | "invalidRequest"
  | "unknown";

export type CommentFeatureError = Readonly<{
  feature: "comments";
  code: CommentFeatureErrorCode;
  message: string;
  domainError: CommentError;
  cause: unknown;
}>;

export type CommentListFeatureState = CommentListState<CommentFeatureError>;
export type CommentOperationFeatureState =
  CommentOperationState<CommentFeatureError>;
