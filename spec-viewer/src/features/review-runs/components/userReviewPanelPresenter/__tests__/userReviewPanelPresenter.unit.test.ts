import * as TestValues from "@/shared/testing/validatedValueObjects";
import { expect, test } from "vitest";

import {
  canArchiveUserReview,
  canCreateUserReview,
  formatCreateSuccessMessage,
  formatProblemState,
  formatUserReviewSummary,
} from "@/features/review-runs/components/userReviewPanelPresenter";
import type {
  StoredUserReview,
  UserReview,
} from "@/features/review-runs/domain/userReview";
import { ValidatedStoredUserReview } from "@/features/review-runs/domain/validatedStoredUserReview";

const completedReview = createUserReview("completed");

test("canCreateUserReviewは未解決コメントがあり保存中でなければtrueを返す", () => {
  expect(canCreateUserReview({ openCommentCount: 1, isCreating: false })).toBe(
    true,
  );
});

test("canCreateUserReviewは未解決コメントがないとfalseを返す", () => {
  expect(canCreateUserReview({ openCommentCount: 0, isCreating: false })).toBe(
    false,
  );
});

test("canArchiveUserReviewはcompletedだけarchive可能にする", () => {
  expect(canArchiveUserReview(completedReview, false)).toBe(true);
  expect(canArchiveUserReview(createUserReview("active"), false)).toBe(false);
  expect(canArchiveUserReview(completedReview, true)).toBe(false);
});

test("presenterはstatus labelとfeedback messageを生成する", () => {
  expect(formatUserReviewSummary(completedReview)).toBe("完了 / コメント 1件");
  expect(formatCreateSuccessMessage(completedReview)).toContain(
    "レビューを作成しました。",
  );
});

test("formatProblemStateはproblem stateを日本語labelへ変換する", () => {
  expect(formatProblemState("missingFolder")).toBe("フォルダなし");
  expect(formatProblemState("malformed")).toBe("壊れたレビュー");
});

function createUserReview(status: UserReview["status"]): UserReview {
  const stored: StoredUserReview = {
    id: TestValues.userReviewId("urv_00000000000000000000000000000001"),
    status,
    target: {
      scope: "file",
      specId: TestValues.specId("auth"),
      fileKey: "tasks",
    },
    workspace: {
      mode: "currentWorkspace",
      workspacePath: "/workspace/spec-reviewer",
    },
    specFolderPath: "/workspace/spec-reviewer/.plugin-workspace/.specs/auth",
    folderPath:
      "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/review",
    sourceFiles: [],
    commentCount: 1,
    createdAt: TestValues.isoDateTime("2026-05-06T12:00:00Z"),
    archivedAt:
      status === "archived"
        ? TestValues.isoDateTime("2026-05-06T12:30:00Z")
        : null,
    summary: null,
    warnings: [],
  };
  const result = ValidatedStoredUserReview.from(stored);
  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return ValidatedStoredUserReview.to(result.validatedStoredUserReview);
}
