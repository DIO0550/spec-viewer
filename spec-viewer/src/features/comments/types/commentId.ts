const commentIdBrand: unique symbol = Symbol("CommentId");

export type CommentId = string & {
  readonly [commentIdBrand]: "CommentId";
};

export const CommentId = {
  /** @returns A branded comment id while preserving the runtime string value. */
  fromString(value: string): CommentId {
    return value as CommentId;
  },
} as const;
