import { expect, test } from "vitest";

import {
  ReviewSessionArchiveState,
  ReviewSessionCreateState,
} from "@/features/review-runs/domain/reviewSessionOperation";
import type { ReviewRun } from "@/features/review-runs/types/reviewRun";
import type { NormalizedCommandError } from "@/shared/types/ipc";

const reviewRun = createReviewRun();
const error: NormalizedCommandError = {
  message: "failed",
  code: "unknown",
  raw: "failed",
};

test("ReviewSessionCreateStateはcreate操作の状態を生成する", () => {
  expect(ReviewSessionCreateState.idle().status).toBe("idle");
  expect(ReviewSessionCreateState.saving().status).toBe("saving");
  expect(ReviewSessionCreateState.success(reviewRun)).toEqual({
    status: "success",
    reviewRun,
    error: null,
  });
  expect(ReviewSessionCreateState.error(error)).toEqual({
    status: "error",
    reviewRun: null,
    error,
  });
});

test("ReviewSessionArchiveStateはarchive操作の状態を生成する", () => {
  expect(ReviewSessionArchiveState.idle().status).toBe("idle");
  expect(ReviewSessionArchiveState.saving("run-1")).toEqual({
    status: "saving",
    reviewRunId: "run-1",
    reviewRun: null,
    error: null,
  });
  expect(ReviewSessionArchiveState.success("run-1", reviewRun)).toEqual({
    status: "success",
    reviewRunId: "run-1",
    reviewRun,
    error: null,
  });
  expect(ReviewSessionArchiveState.error("run-1", error)).toEqual({
    status: "error",
    reviewRunId: "run-1",
    reviewRun: null,
    error,
  });
});

function createReviewRun(): ReviewRun {
  return {
    id: "run-1",
    status: "active",
    target: {
      scope: "file",
      specId: "auth",
      fileKey: "tasks",
    },
    executionTarget: {
      mode: "currentWorkspace",
      workspacePath: "/workspace/spec-reviewer",
    },
    specFolderPath: "/workspace/spec-reviewer/.plugin-workspace/.specs/auth",
    folderPath:
      "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/run-1",
    sourceFiles: [],
    commentCount: 1,
    createdAt: "2026-05-06T12:00:00Z",
    archivedAt: null,
    summary: null,
    warnings: [],
  };
}
