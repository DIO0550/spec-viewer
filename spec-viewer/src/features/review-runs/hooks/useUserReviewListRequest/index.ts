import { useCallback, useMemo, useRef } from "react";
import type { UserReviewAsyncToken as UserReviewAsyncTokenType } from "@/features/review-runs/hooks/userReviewAsyncToken";
import { UserReviewAsyncToken } from "@/features/review-runs/hooks/userReviewAsyncToken";

export type UserReviewListRequestController = Readonly<{
  /**
   * Starts a new list request.
   * @param identity - Target identity the request belongs to.
   * @returns Token identifying the started request.
   */
  begin: (identity: string) => UserReviewAsyncTokenType;
  /** Invalidates any in-flight list request. */
  invalidate: () => void;
  /**
   * Tests whether a request token is still current.
   * @param token - Token returned by begin.
   * @returns true when the token matches the latest request and identity.
   */
  isCurrent: (token: UserReviewAsyncTokenType) => boolean;
  /**
   * Updates the current target identity.
   * @param identity - New target identity.
   */
  setCurrentIdentity: (identity: string) => void;
}>;

/** @returns Controller for list request staleness and target identity changes. */
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
