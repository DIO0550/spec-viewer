import { expect, test } from "vitest";

import type { StoredUserReview } from "@/features/review-runs/domain/userReview";
import {
  tryValidateStoredUserReview,
  validateStoredUserReview,
} from "@/features/review-runs/infra/storedUserReviewValidation";

test("tryValidateStoredUserReviewはvalid active stored reviewをsuccessとして返す", () => {
  const activeReview = createStoredUserReview({
    id: "review-active",
    status: "active",
    archivedAt: null,
  });

  const result = tryValidateStoredUserReview(activeReview);

  expect(result).toEqual({
    ok: true,
    userReview: activeReview,
  });
});

test("tryValidateStoredUserReviewはvalid archived stored reviewをsuccessとして返す", () => {
  const archivedReview = createStoredUserReview({
    id: "review-archived",
    status: "archived",
    archivedAt: "2026-05-06T12:30:00Z",
  });

  const result = tryValidateStoredUserReview(archivedReview);

  expect(result).toEqual({
    ok: true,
    userReview: archivedReview,
  });
});

test("tryValidateStoredUserReviewはarchivedAtのないarchived stored reviewをfailureとして返す", () => {
  const invalidReview = createStoredUserReview({
    id: "review-invalid-archived",
    status: "archived",
    archivedAt: null,
  });

  const result = tryValidateStoredUserReview(invalidReview);

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

test("tryValidateStoredUserReviewはarchivedAtのある非archived stored reviewをfailureとして返す", () => {
  const invalidReview = createStoredUserReview({
    id: "review-invalid-active",
    status: "completed",
    archivedAt: "2026-05-06T12:30:00Z",
  });

  const result = tryValidateStoredUserReview(invalidReview);

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

test("validateStoredUserReviewはinvalid stored reviewを例外として拒否する", () => {
  const invalidReview = createStoredUserReview({
    id: "review-invalid-validate",
    status: "archived",
    archivedAt: null,
  });

  expect(() => validateStoredUserReview(invalidReview)).toThrow(
    "Archived user review must have archivedAt: review-invalid-validate",
  );
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
