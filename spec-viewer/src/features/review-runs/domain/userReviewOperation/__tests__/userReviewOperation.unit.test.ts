import { expect, test } from "vitest";
import { CommentId } from "@/features/comments/types/comment";
import type {
  ActiveUserReview,
  ArchivedUserReview,
} from "@/features/review-runs/domain/userReview";
import type { CreateUserReviewPayload } from "@/features/review-runs/domain/userReviewOperation";
import {
  UserReviewArchiveState,
  UserReviewCreateState,
} from "@/features/review-runs/domain/userReviewOperation";
import type { IpcCommandError } from "@/shared/types/ipc";

const userReview = createUserReview();
const archivedUserReview: ArchivedUserReview = {
  ...userReview,
  status: "archived",
  updatedAt: "2026-05-06T12:30:00Z",
  archivedAt: "2026-05-06T12:30:00Z",
};

const createPayload: CreateUserReviewPayload = {
  commentIds: [CommentId.fromString("cmt_1")],
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
  expect(
    UserReviewArchiveState.success(archivePayload, archivedUserReview),
  ).toEqual({
    status: "success",
    payload: archivePayload,
    result: archivedUserReview,
  });
  expect(UserReviewArchiveState.error(archivePayload, error)).toEqual({
    status: "error",
    payload: archivePayload,
    error,
  });
});

function createUserReview(): ActiveUserReview {
  return {
    schemaVersion: "spec-reviewer.user-review.v1",
    id: "run-1",
    status: "active",
    target: {
      scope: "file",
      specId: "auth",
      fileKey: "tasks",
    },
    recordLocator: "run-1.json",
    commentCount: 1,
    createdAt: "2026-05-06T12:00:00Z",
    updatedAt: "2026-05-06T12:00:00Z",
    archivedAt: null,
  };
}
