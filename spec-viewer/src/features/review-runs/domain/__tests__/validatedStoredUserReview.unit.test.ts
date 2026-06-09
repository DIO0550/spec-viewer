import { expect, test } from "vitest";

import type { StoredUserReview } from "@/features/review-runs/domain/userReview";
import { ValidatedStoredUserReview } from "@/features/review-runs/domain/validatedStoredUserReview";

test("ValidatedStoredUserReview.fromはvalid active stored reviewを検証済みとして返す", () => {
  const activeReview = createStoredUserReview({
    id: "review-active",
    status: "active",
    archivedAt: null,
  });

  const result = ValidatedStoredUserReview.from(activeReview);

  expect(result).toEqual({
    ok: true,
    validatedStoredUserReview: activeReview,
  });
});

test("ValidatedStoredUserReview.fromはvalid archived stored reviewを検証済みとして返す", () => {
  const archivedReview = createStoredUserReview({
    id: "review-archived",
    status: "archived",
    archivedAt: "2026-05-06T12:30:00Z",
  });

  const result = ValidatedStoredUserReview.from(archivedReview);

  expect(result).toEqual({
    ok: true,
    validatedStoredUserReview: archivedReview,
  });
});

test("ValidatedStoredUserReview.fromはarchivedAtのないarchived stored reviewを拒否する", () => {
  const invalidReview = createStoredUserReview({
    id: "review-invalid-archived",
    status: "archived",
    archivedAt: null,
  });

  const result = ValidatedStoredUserReview.from(invalidReview);

  expect(result).toEqual({
    ok: false,
    error: {
      reason: "archivedMissingArchivedAt",
      id: "review-invalid-archived",
      message:
        "Archived user review must have archivedAt: review-invalid-archived",
    },
  });
});

test("ValidatedStoredUserReview.fromはarchivedAtのある非archived stored reviewを拒否する", () => {
  const invalidReview = createStoredUserReview({
    id: "review-invalid-active",
    status: "completed",
    archivedAt: "2026-05-06T12:30:00Z",
  });

  const result = ValidatedStoredUserReview.from(invalidReview);

  expect(result).toEqual({
    ok: false,
    error: {
      reason: "nonArchivedHasArchivedAt",
      id: "review-invalid-active",
      message:
        "Non-archived user review must not have archivedAt: review-invalid-active",
    },
  });
});

function createStoredUserReview(
  input: Pick<StoredUserReview, "archivedAt" | "id" | "status">,
): StoredUserReview {
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
