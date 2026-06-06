import { expect, test, vi } from "vitest";

import { UserReviewListState } from "@/features/review-runs/domain/userReviewListState";
import {
  UserReviewArchiveState,
  UserReviewCreateState,
} from "@/features/review-runs/domain/userReviewOperation";
import { createUseUserReviewsResult } from "@/features/review-runs/hooks/createUseUserReviewsResult";

const target = {
  scope: "file",
  specId: "auth",
  fileKey: "tasks",
} as const;

test("createUseUserReviewsResultは公開resultを組み立てる", async () => {
  const reloadUserReviews = vi.fn().mockResolvedValue(true);
  const createUserReview = vi.fn().mockResolvedValue(null);
  const archiveUserReview = vi.fn().mockResolvedValue(null);
  const result = createUseUserReviewsResult({
    target,
    listState: UserReviewListState.loading(target),
    reloadUserReviews,
    userReviewOperations: {
      createState: UserReviewCreateState.idle(),
      archiveState: UserReviewArchiveState.idle(),
      createUserReview,
      archiveUserReview,
    },
  });

  await expect(result.reloadUserReviews()).resolves.toBe(true);

  expect(result.target).toEqual(target);
  expect(result.listState.status).toBe("loading");
  expect(result.activeReviews).toEqual([]);
  expect(result.archivedReviews).toEqual([]);
  expect(result.createUserReview).toBe(createUserReview);
  expect(result.archiveUserReview).toBe(archiveUserReview);
});
