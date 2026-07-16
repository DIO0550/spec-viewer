import type { CommentError } from "@/features/comments/domain/commentError";
import type { CommentListState } from "@/features/comments/domain/commentListState";
import type { CommentOperationState } from "@/features/comments/domain/commentOperation";
import type { CommentListRestorationError } from "@/features/comments/domain/comments";

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

/**
 * @param error - Collection invariant rejected while restoring a list response.
 * @returns Feature error for displaying an invalid comment response.
 */
export function toCommentListRestorationFeatureError(
  error: CommentListRestorationError,
): CommentFeatureError {
  return {
    feature: "comments",
    code: "invalidComment",
    message: `Rejected comment list response: ${error.reason}`,
    domainError: { reason: "commentRejected" },
    cause: error,
  };
}
