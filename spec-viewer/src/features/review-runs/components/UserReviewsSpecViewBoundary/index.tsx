import type { ReactElement, ReactNode } from "react";

import { useSpecViewIdentity } from "@/app/context/specViewIdentity";
import {
  useUserReviews,
  type UseUserReviewsResult,
  type UserReviewsSelectionInput,
} from "@/features/review-runs/hooks/useUserReviews";

export type UserReviewsSpecViewBoundaryProps = Readonly<{
  selection: UserReviewsSelectionInput;
  correlationId?: string | null;
  children: (userReviews: UseUserReviewsResult) => ReactNode;
}>;

/**
 * @param props - Boundary props for injecting the app spec view identity into user reviews.
 * @returns Rendered children with user review state for the active spec view.
 */
export function UserReviewsSpecViewBoundary(
  props: UserReviewsSpecViewBoundaryProps,
): ReactElement {
  const { children, correlationId, selection } = props;
  const { viewIdentity } = useSpecViewIdentity();
  const userReviews = useUserReviews({
    selection,
    viewIdentity,
    correlationId,
  });

  return <>{children(userReviews)}</>;
}
