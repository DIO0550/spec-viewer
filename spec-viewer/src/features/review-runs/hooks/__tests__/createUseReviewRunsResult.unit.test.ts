import { expect, test, vi } from "vitest";

import { ReviewRunListState } from "@/features/review-runs/domain/reviewRunListState";
import {
  ReviewRunArchiveState,
  ReviewRunCreateState,
} from "@/features/review-runs/domain/reviewRunOperation";
import { createUseReviewRunsResult } from "@/features/review-runs/hooks/createUseReviewRunsResult";

const target = {
  scope: "file",
  specId: "auth",
  fileKey: "tasks",
} as const;

test("createUseReviewRunsResultは公開resultを組み立てる", async () => {
  const reloadReviewRuns = vi.fn().mockResolvedValue(true);
  const createReviewRun = vi.fn().mockResolvedValue(null);
  const archiveReviewRun = vi.fn().mockResolvedValue(null);
  const result = createUseReviewRunsResult({
    target,
    listState: ReviewRunListState.loading(target),
    reloadReviewRuns,
    reviewRunOperations: {
      createState: ReviewRunCreateState.idle(),
      archiveState: ReviewRunArchiveState.idle(),
      createReviewRun,
      archiveReviewRun,
    },
  });

  await expect(result.reloadReviewRuns()).resolves.toBe(true);

  expect(result.target).toEqual(target);
  expect(result.listState.status).toBe("loading");
  expect(result.activeRuns).toEqual([]);
  expect(result.archivedRuns).toEqual([]);
  expect(result.createReviewRun).toBe(createReviewRun);
  expect(result.archiveReviewRun).toBe(archiveReviewRun);
});
