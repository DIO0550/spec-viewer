import type { CommentBodyParseError } from "@/features/comments/domain/commentBody";
import { uiText } from "@/shared/lib/uiText";

const CommentBodyValidationMessages: Readonly<
  Record<CommentBodyParseError["reason"], string>
> = {
  empty_body: uiText.commentThread.emptyBody,
};

/**
 * @param error - Domain validation error to present.
 * @returns Localized validation message for the comment body form.
 */
export function toCommentBodyValidationMessage(
  error: CommentBodyParseError,
): string {
  return CommentBodyValidationMessages[error.reason];
}
