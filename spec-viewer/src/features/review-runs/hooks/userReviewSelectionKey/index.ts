import type { UserReviewListEvent } from "@/features/review-runs/domain/userReviewListState";
import type { SpecViewSelectionKey } from "@/features/specs/domain/specViewSelectionKey";

export type { SpecViewSelectionKey } from "@/features/specs/domain/specViewSelectionKey";

export type KeyedUserReviewListEvent = Readonly<{
  selectionKey: SpecViewSelectionKey;
  event: UserReviewListEvent;
}>;
