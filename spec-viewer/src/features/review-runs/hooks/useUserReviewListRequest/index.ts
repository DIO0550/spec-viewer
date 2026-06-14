import { useMemo } from "react";

import type { UserReviewTargetIdentity } from "@/features/review-runs/domain/userReviewTarget";
import {
  useUserReviewAsyncGuard,
  type UserReviewAsyncGuard,
} from "@/features/review-runs/hooks/useUserReviewAsyncGuard";
import type { UserReviewAsyncRequest } from "@/features/review-runs/hooks/useUserReviewAsyncGuard";

export type UserReviewListRequestController = Readonly<{
  begin: (identity: UserReviewTargetIdentity) => UserReviewAsyncRequest;
  invalidate: () => void;
  isCurrent: (token: UserReviewAsyncRequest) => boolean;
  setCurrentIdentity: (identity: UserReviewTargetIdentity) => void;
}>;

/** @returns Controller for list request staleness and target identity changes. */
export function useUserReviewListRequest(
  initialIdentity: UserReviewTargetIdentity,
): UserReviewListRequestController {
  const guard: UserReviewAsyncGuard = useUserReviewAsyncGuard();
  guard.setCurrentIdentity(initialIdentity);

  return useMemo(
    () => ({
      begin: guard.begin,
      invalidate: guard.invalidate,
      isCurrent: guard.isCurrent,
      setCurrentIdentity: guard.setCurrentIdentity,
    }),
    [guard],
  );
}
