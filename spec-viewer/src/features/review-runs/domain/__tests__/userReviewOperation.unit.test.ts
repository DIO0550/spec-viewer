import { expect, test } from "vitest";

import {
  UserReviewArchiveState,
  UserReviewCreateState,
} from "@/features/review-runs/domain/userReviewOperation";
import type { UserReview } from "@/features/review-runs/types/userReviewIpc";
import type { NormalizedCommandError } from "@/shared/types/ipc";

const userReview = createUserReview();
const error: NormalizedCommandError = {
  message: "failed",
  code: "unknown",
  raw: "failed",
};

test("UserReviewCreateStateはcreate操作の状態を生成する", () => {
  expect(UserReviewCreateState.idle().status).toBe("idle");
  expect(UserReviewCreateState.saving().status).toBe("saving");
  expect(UserReviewCreateState.success(userReview)).toEqual({
    status: "success",
    userReview,
    error: null,
  });
  expect(UserReviewCreateState.error(error)).toEqual({
    status: "error",
    userReview: null,
    error,
  });
});

test("UserReviewArchiveStateはarchive操作の状態を生成する", () => {
  expect(UserReviewArchiveState.idle().status).toBe("idle");
  expect(UserReviewArchiveState.saving("run-1")).toEqual({
    status: "saving",
    userReviewId: "run-1",
    userReview: null,
    error: null,
  });
  expect(UserReviewArchiveState.success("run-1", userReview)).toEqual({
    status: "success",
    userReviewId: "run-1",
    userReview,
    error: null,
  });
  expect(UserReviewArchiveState.error("run-1", error)).toEqual({
    status: "error",
    userReviewId: "run-1",
    userReview: null,
    error,
  });
});

function createUserReview(): UserReview {
  return {
    id: "run-1",
    status: "active",
    target: {
      scope: "file",
      specId: "auth",
      fileKey: "tasks",
    },
    workspace: {
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
