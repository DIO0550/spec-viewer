import { expect, test } from "vitest";

import {
  canArchiveUserReview,
  canCreateUserReview,
  formatCreateSuccessMessage,
  formatProblemState,
  formatUserReviewSummary,
} from "@/features/review-runs/components/userReviewPanelPresenter";
import type { UserReview } from "@/features/review-runs/domain/userReview";

const completedReview = createUserReview("completed");

test("canCreateUserReviewは未解決コメントがあり保存中でなければtrueを返す", () => {
  expect(
    canCreateUserReview({ openCommentCount: 1, isCreating: false }),
  ).toBe(true);
});

test("canCreateUserReviewは未解決コメントがないとfalseを返す", () => {
  expect(
    canCreateUserReview({ openCommentCount: 0, isCreating: false }),
  ).toBe(false);
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
  return {
    id: `review-${status}`,
    status,
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
      "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/review",
    sourceFiles: [],
    commentCount: 1,
    createdAt: "2026-05-06T12:00:00Z",
    archivedAt: status === "archived" ? "2026-05-06T12:30:00Z" : null,
    summary: null,
    warnings: [],
  } as UserReview;
}
