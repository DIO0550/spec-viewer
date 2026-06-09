import { expect, test } from "vitest";

import {
  UserReview,
  UserReviewStatus,
  ValidatedStoredUserReview,
  type StoredUserReview,
  type UserReview as UserReviewType,
} from "@/features/review-runs/domain/userReview";

const activeRun = createUserReview({
  id: "run-active",
  status: "active",
  archivedAt: null,
});

test("UserReviewStatus.isArchivedはarchived statusをtrueとして返す", () => {
  expect(UserReviewStatus.isArchived("archived")).toBe(true);
});

test("UserReviewStatus.isArchivedはcompleted statusをfalseとして返す", () => {
  expect(UserReviewStatus.isArchived("completed")).toBe(false);
});

test.each(["active", "inProgress", "completed"] as const)(
  "UserReviewStatus.isNonArchivedは%s statusをtrueとして返す",
  (status) => {
    expect(UserReviewStatus.isNonArchived(status)).toBe(true);
  },
);

test("UserReviewStatus.isNonArchivedはarchived statusをfalseとして返す", () => {
  expect(UserReviewStatus.isNonArchived("archived")).toBe(false);
});

test("UserReview.isArchivedはarchived runをarchived variantへnarrowする", () => {
  const entity = createUserReview({
    id: "run-archived",
    status: "archived",
    archivedAt: "2026-05-06T12:30:00Z",
  });

  expect(UserReview.isArchived(entity)).toBe(true);
  expect(UserReview.isNonArchived(entity)).toBe(false);
});

test("UserReview.isNonArchivedは非archived runをactive collection向けにnarrowする", () => {
  expect(UserReview.isNonArchived(activeRun)).toBe(true);
  expect(UserReview.isArchived(activeRun)).toBe(false);
});

test("ValidatedStoredUserReview.toは検証済み保存reviewをUserReviewとして返す", () => {
  expect(ValidatedStoredUserReview.to(activeRun)).toBe(activeRun);
});

function createUserReview(
  input: Pick<StoredUserReview, "archivedAt" | "id" | "status">,
): UserReviewType {
  return {
    id: input.id,
    status: input.status,
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
    folderPath: `/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/${input.id}`,
    sourceFiles: [
      {
        specId: "auth",
        fileKey: "tasks",
        relativePath: ".plugin-workspace/.specs/auth/tasks.md",
      },
    ],
    commentCount: 1,
    createdAt: "2026-05-06T12:00:00Z",
    archivedAt: input.archivedAt,
    summary: null,
    warnings: [],
  } as UserReviewType;
}
