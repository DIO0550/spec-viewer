import { useCallback, useMemo, useRef } from "react";

import type { UserReviewTargetIdentity } from "@/features/review-runs/domain/userReviewTarget";
import { UserReviewAsyncToken } from "@/features/review-runs/hooks/userReviewAsyncToken";
import type { UserReviewAsyncToken as UserReviewAsyncRequest } from "@/features/review-runs/hooks/userReviewAsyncToken";

export type { UserReviewAsyncRequest };

export type UserReviewAsyncGuard = Readonly<{
  begin: (targetIdentity: UserReviewTargetIdentity) => UserReviewAsyncRequest;
  invalidate: () => void;
  isCurrent: (request: UserReviewAsyncRequest) => boolean;
  setCurrentIdentity: (targetIdentity: UserReviewTargetIdentity) => void;
}>;

/** @returns Guard that rejects stale async results by request id and target identity. */
export function useUserReviewAsyncGuard(): UserReviewAsyncGuard {
  const requestIdRef = useRef(0);
  const currentIdentityRef = useRef<UserReviewTargetIdentity>("none");

  const begin = useCallback(
    (targetIdentity: UserReviewTargetIdentity): UserReviewAsyncRequest => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      currentIdentityRef.current = targetIdentity;

      return UserReviewAsyncToken.create(requestId, targetIdentity);
    },
    [],
  );

  const invalidate = useCallback((): void => {
    requestIdRef.current += 1;
  }, []);

  const isCurrent = useCallback(
    (request: UserReviewAsyncRequest): boolean =>
      UserReviewAsyncToken.isCurrent(
        request,
        currentIdentityRef.current,
        requestIdRef.current,
      ),
    [],
  );

  const setCurrentIdentity = useCallback(
    (targetIdentity: UserReviewTargetIdentity): void => {
      currentIdentityRef.current = targetIdentity;
    },
    [],
  );

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
