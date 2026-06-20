import type { UserReviewListEvent } from "@/features/review-runs/domain/userReviewListState";
import type { SpecViewSelectionId } from "@/features/specs/domain/specViewSelectionId";

export type { SpecViewSelectionId } from "@/features/specs/domain/specViewSelectionId";

export type UserReviewListEventWithSelectionId = Readonly<{
  selectionId: SpecViewSelectionId;
  event: UserReviewListEvent;
}>;
