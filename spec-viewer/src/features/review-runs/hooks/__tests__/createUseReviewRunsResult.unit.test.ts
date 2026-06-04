import { expect, test, vi } from "vitest";

import { ReviewSessionListState } from "@/features/review-runs/domain/reviewSessionListState";
import {
  ReviewSessionArchiveState,
  ReviewSessionCreateState,
} from "@/features/review-runs/domain/reviewSessionOperation";
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
    listState: ReviewSessionListState.loading(target),
    reloadReviewRuns,
    reviewRunOperations: {
      createState: ReviewSessionCreateState.idle(),
      archiveState: ReviewSessionArchiveState.idle(),
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
