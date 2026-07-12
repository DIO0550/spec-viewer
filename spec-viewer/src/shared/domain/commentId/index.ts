declare const commentIdBrand: unique symbol;

export type CommentId = string & {
  readonly [commentIdBrand]: "CommentId";
};

export const CommentId = {
  /**
   * @param value - Raw comment identifier at an input boundary.
   * @returns Branded comment identifier for domain use.
   */
  fromString(value: string): CommentId {
    return value as CommentId;
  },
} as const;
