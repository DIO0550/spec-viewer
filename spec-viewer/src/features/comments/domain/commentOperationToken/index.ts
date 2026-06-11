export type CommentOperationToken = Readonly<{
  requestId: number;
  scopeKey: string;
}>;

export const CommentOperationToken = {
  /**
   * @param requestId - Operation request id.
   * @param scopeKey - Scope key captured when the request started.
   * @returns Token used to reject stale operation results.
   */
  create(requestId: number, scopeKey: string): CommentOperationToken {
    return { requestId, scopeKey };
  },
  /**
   * @param token - Captured operation token.
   * @param latest - Most recent operation request id and active scope key.
   * @returns True when the async operation still belongs to the current scope.
   */
  matches(
    token: CommentOperationToken,
    latest: Readonly<{ requestId: number; scopeKey: string }>,
  ): boolean {
    return (
      token.requestId === latest.requestId && token.scopeKey === latest.scopeKey
    );
  },
} as const;
