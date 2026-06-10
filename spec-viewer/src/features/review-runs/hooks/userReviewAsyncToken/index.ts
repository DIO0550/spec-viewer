export type UserReviewAsyncToken = Readonly<{
  requestId: number;
  identity: string;
}>;

export const UserReviewAsyncToken = {
  /**
   * @param requestId - Monotonic async request id.
   * @param identity - Target or operation identity captured at start.
   * @returns Token used to reject stale async results.
   */
  create(requestId: number, identity: string): UserReviewAsyncToken {
    return { requestId, identity };
  },

  /**
   * @param token - Captured async token.
   * @param currentIdentity - Current target or operation identity.
   * @param latestRequestId - Latest request id for the async lane.
   * @returns True when the token still belongs to current state.
   */
  isCurrent(
    token: UserReviewAsyncToken,
    currentIdentity: string,
    latestRequestId: number,
  ): boolean {
    return (
      token.requestId === latestRequestId && token.identity === currentIdentity
    );
  },
} as const;
