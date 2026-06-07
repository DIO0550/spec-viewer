import { expect, test } from "vitest";

import {
  UserReview,
  type UserReviewRestoreInput,
} from "@/features/review-runs/domain/userReview";

const activeRun = createUserReview({
  id: "run-active",
  status: "active",
  archivedAt: null,
});

test("UserReview.restoreは非archived runをactive collection向けにnarrowする", () => {
  const entity = UserReview.restore(activeRun);

  expect(UserReview.isNonArchived(entity)).toBe(true);
  expect(UserReview.isArchived(entity)).toBe(false);
});

test("UserReview.tryRestoreはvalid active reviewをsuccessとして返す", () => {
  const result = UserReview.tryRestore(activeRun);

  expect(result).toEqual({
    ok: true,
    userReview: activeRun,
  });
});

test("UserReview.tryRestoreはvalid archived reviewをsuccessとして返す", () => {
  const archivedRun = createUserReview({
    id: "run-valid-archived",
    status: "archived",
    archivedAt: "2026-05-06T12:30:00Z",
  });

  const result = UserReview.tryRestore(archivedRun);

  expect(result).toEqual({
    ok: true,
    userReview: archivedRun,
  });
});

test("UserReview.tryRestoreはarchivedAtのないarchived runをfailureとして返す", () => {
  const invalidRun = createUserReview({
    id: "run-invalid-archived",
    status: "archived",
    archivedAt: null,
  });

  const result = UserReview.tryRestore(invalidRun);

  expect(result).toEqual({
    ok: false,
    error: {
      reason: "archivedMissingArchivedAt",
      id: "run-invalid-archived",
      message: "Archived user review must have archivedAt: run-invalid-archived",
    },
  });
});

test("UserReview.tryRestoreはarchivedAtのある非archived runをfailureとして返す", () => {
  const invalidRun = createUserReview({
    id: "run-invalid-active",
    status: "completed",
    archivedAt: "2026-05-06T12:30:00Z",
  });

  const result = UserReview.tryRestore(invalidRun);

  expect(result).toEqual({
    ok: false,
    error: {
      reason: "nonArchivedHasArchivedAt",
      id: "run-invalid-active",
      message:
        "Non-archived user review must not have archivedAt: run-invalid-active",
    },
  });
});

test("UserReview.restoreはarchived runをarchived variantへnarrowする", () => {
  const entity = UserReview.restore(
    createUserReview({
      id: "run-archived",
      status: "archived",
      archivedAt: "2026-05-06T12:30:00Z",
    }),
  );

  expect(UserReview.isArchived(entity)).toBe(true);
});

test("UserReview.restoreはarchivedAtのないarchived runを拒否する", () => {
  const invalidRun = createUserReview({
    id: "run-invalid-archived",
    status: "archived",
    archivedAt: null,
  });

  expect(() => UserReview.restore(invalidRun)).toThrow(
    "Archived user review must have archivedAt",
  );
});

test("UserReview.restoreはarchivedAtのある非archived runを拒否する", () => {
  const invalidRun = createUserReview({
    id: "run-invalid-active",
    status: "completed",
    archivedAt: "2026-05-06T12:30:00Z",
  });

  expect(() => UserReview.restore(invalidRun)).toThrow(
    "Non-archived user review must not have archivedAt",
  );
});

function createUserReview(
  input: Pick<UserReviewRestoreInput, "archivedAt" | "id" | "status">,
): UserReviewRestoreInput {
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
  };
}
