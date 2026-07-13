import { CommentBody } from "@/features/comments/domain/commentBody";

/**
 * @param value - Valid body text used by a test fixture.
 * @returns Validated CommentBody for application boundary tests.
 * @throws When a test fixture accidentally supplies an invalid body.
 */
export function commentBody(value: string): CommentBody {
  const result = CommentBody.parse(value);

  if (!result.ok) {
    throw new Error(
      `Invalid comment body test fixture: ${result.error.reason}`,
    );
  }

  return result.commentBody;
}
