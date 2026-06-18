import type { UserReviewListEvent } from "@/features/review-runs/domain/userReviewListState";
import type { SpecViewIdentity } from "@/features/specs/domain/specViewIdentity";

export type UserReviewViewIdentity = SpecViewIdentity;

export type IdentifiedUserReviewListEvent = Readonly<{
  identity: UserReviewViewIdentity;
  event: UserReviewListEvent;
}>;
