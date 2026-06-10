import { useCallback, useMemo, useRef } from "react";
import type { UserReviewAsyncToken as UserReviewAsyncTokenType } from "@/features/review-runs/hooks/userReviewAsyncToken";
import { UserReviewAsyncToken } from "@/features/review-runs/hooks/userReviewAsyncToken";

export type UserReviewListRequestController = Readonly<{
  /**
   * @param identity - Target identity for the new request.
   * @returns A token identifying the started request.
   */
  begin: (identity: string) => UserReviewAsyncTokenType;
  /** Invalidates any in-flight request. */
  invalidate: () => void;
  /**
   * @param token - The token to check against the latest request.
   * @returns True when the token is still the current request.
   */
  isCurrent: (token: UserReviewAsyncTokenType) => boolean;
  /** @param identity - The target identity to mark as current. */
  setCurrentIdentity: (identity: string) => void;
}>;

/**
 * @param initialIdentity - The initial target identity to track.
 * @returns Controller for list request staleness and target identity changes.
 */
export function useUserReviewListRequest(
  initialIdentity: string,
): UserReviewListRequestController {
  const requestIdRef = useRef(0);
  const currentIdentityRef = useRef(initialIdentity);

  const begin = useCallback((identity: string): UserReviewAsyncTokenType => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    return UserReviewAsyncToken.create(requestId, identity);
  }, []);

  const invalidate = useCallback((): void => {
    requestIdRef.current += 1;
  }, []);

  const isCurrent = useCallback(
    (token: UserReviewAsyncTokenType): boolean =>
      UserReviewAsyncToken.isCurrent(
        token,
        currentIdentityRef.current,
        requestIdRef.current,
      ),
    [],
  );

  const setCurrentIdentity = useCallback((identity: string): void => {
    currentIdentityRef.current = identity;
  }, []);

  return useMemo(
    () => ({
      begin,
      invalidate,
      isCurrent,
      setCurrentIdentity,
    }),
    [begin, invalidate, isCurrent, setCurrentIdentity],
  );
}
