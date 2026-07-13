import { expect, test, vi } from "vitest";

import { UserReviewListState } from "@/features/review-runs/domain/userReviewListState";
import {
  UserReviewArchiveState,
  UserReviewCreateState,
} from "@/features/review-runs/domain/userReviewOperation";
import { buildUserReviewsResult } from "@/features/review-runs/hooks/buildUserReviewsResult";

const target = {
  scope: "file",
  specId: "auth",
  fileKey: "tasks",
} as const;

test("buildUserReviewsResultは公開resultへ組み立てる", async () => {
  const reloadUserReviews = vi.fn().mockResolvedValue(true);
  const createUserReview = vi.fn().mockResolvedValue(null);
  const archiveUserReview = vi.fn().mockResolvedValue(null);
  const canCreateUserReview = vi.fn().mockReturnValue(true);
  const result = buildUserReviewsResult({
    list: {
      target,
      listState: UserReviewListState.loading(target),
      reloadUserReviews,
    },
    operations: {
      createState: UserReviewCreateState.idle(),
      archiveState: UserReviewArchiveState.idle(),
      canCreateUserReview,
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
  expect(result.canCreateUserReview).toBe(canCreateUserReview);
  expect(result.archiveUserReview).toBe(archiveUserReview);
});
