import { useCallback, useMemo, useRef } from "react";

import { UserReviewAsyncToken } from "@/features/review-runs/hooks/userReviewAsyncToken";
import type { UserReviewAsyncToken as UserReviewAsyncTokenType } from "@/features/review-runs/hooks/userReviewAsyncToken";

export type UserReviewListRequestController = Readonly<{
  begin: (identity: string) => UserReviewAsyncTokenType;
  invalidate: () => void;
  isCurrent: (token: UserReviewAsyncTokenType) => boolean;
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
