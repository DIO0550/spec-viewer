declare const commentBodyBrand: unique symbol;

export type CommentBody = string & {
  readonly [commentBodyBrand]: "CommentBody";
};

export type CommentBodyDraft = string;

export type CommentBodyParseError = Readonly<{
  reason: "empty_body";
}>;

export type CommentBodyParseResult =
  | Readonly<{
      ok: true;
      commentBody: CommentBody;
    }>
  | Readonly<{
      ok: false;
      error: CommentBodyParseError;
    }>;

const emptyCommentBodyError: CommentBodyParseError = {
  reason: "empty_body",
};

export const CommentBody = {
  /**
   * @param draft - Editable comment body text from a form boundary.
   * @returns Validated normalized body, or the shared validation error.
   */
  parse(draft: CommentBodyDraft): CommentBodyParseResult {
    const normalizedBody = draft.trim();

    if (normalizedBody.length === 0) {
      return {
        ok: false,
        error: emptyCommentBodyError,
      };
    }

    return {
      ok: true,
      commentBody: normalizedBody as CommentBody,
    };
  },

  /**
   * @param commentBody - Validated comment body.
   * @returns Raw string for the IPC transport boundary.
   */
  toString(commentBody: CommentBody): string {
    return commentBody;
  },
} as const;
