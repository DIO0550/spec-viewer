import { expect, test } from "vitest";

import {
  UserReviewArchiveState,
  UserReviewCreateState,
} from "@/features/review-runs/domain/userReviewOperation";
import type { CreateUserReviewPayload } from "@/features/review-runs/domain/userReviewOperation";
import type { UserReview } from "@/features/review-runs/types/userReviewIpc";
import type { IpcCommandError } from "@/shared/types/ipc";

const userReview = createUserReview();
const createPayload: CreateUserReviewPayload = {
  commentIds: [],
  workspaceMode: "currentWorkspace",
};
const archivePayload = { userReviewId: "run-1" };
const error: IpcCommandError = {
  message: "failed",
  code: "unknown",
  raw: "failed",
};

test("UserReviewCreateStateはpayload付きcreate操作の状態を生成する", () => {
  expect(UserReviewCreateState.idle()).toEqual({ status: "idle" });
  expect(UserReviewCreateState.saving(createPayload)).toEqual({
    status: "saving",
    payload: createPayload,
  });
  expect(UserReviewCreateState.success(createPayload, userReview)).toEqual({
    status: "success",
    payload: createPayload,
    result: userReview,
  });
  expect(UserReviewCreateState.error(createPayload, error)).toEqual({
    status: "error",
    payload: createPayload,
    error,
  });
});

test("UserReviewArchiveStateはpayload付きarchive操作の状態を生成する", () => {
  expect(UserReviewArchiveState.idle()).toEqual({ status: "idle" });
  expect(UserReviewArchiveState.saving(archivePayload)).toEqual({
    status: "saving",
    payload: archivePayload,
  });
  expect(UserReviewArchiveState.success(archivePayload, userReview)).toEqual({
    status: "success",
    payload: archivePayload,
    result: userReview,
  });
  expect(UserReviewArchiveState.error(archivePayload, error)).toEqual({
    status: "error",
    payload: archivePayload,
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
