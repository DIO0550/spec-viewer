export type CommentBody = Readonly<{
  value: string;
}>;

export type CommentBodyValidationError = "empty_body";

export const CommentBody = {
  /** @returns Empty comment body value. */
  create(value = ""): CommentBody {
    return { value };
  },

  /** @returns Comment body with updated text. */
  update(body: CommentBody, value: string): CommentBody {
    return { ...body, value };
  },

  /** @returns Body text normalized for submit validation. */
  getTrimmedValue(body: CommentBody): string {
    return body.value.trim();
  },

  /** @returns True when the body cannot be submitted as a comment. */
  isEmpty(body: CommentBody): boolean {
    return CommentBody.getTrimmedValue(body).length === 0;
  },

  /** @returns Validation error for the body value, or null when valid. */
  validate(body: CommentBody): CommentBodyValidationError | null {
    if (CommentBody.isEmpty(body)) {
      return "empty_body";
    }

    return null;
  },
} as const;
