import * as TestValues from "@/shared/testing/validatedValueObjects";
import { expect, test } from "vitest";

import type { StoredUserReview } from "@/features/review-runs/domain/userReview";
import { ValidatedStoredUserReview } from "@/features/review-runs/domain/validatedStoredUserReview";

test("ValidatedStoredUserReview.fromはvalid active stored reviewを検証済みとして返す", () => {
  const activeReview = createStoredUserReview({
    id: TestValues.userReviewId("urv_00000000000000000000000000000001"),
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
    id: TestValues.userReviewId("urv_00000000000000000000000000000002"),
    status: "archived",
    archivedAt: TestValues.isoDateTime("2026-05-06T12:30:00Z"),
  });

  const result = ValidatedStoredUserReview.from(archivedReview);

  expect(result).toEqual({
    ok: true,
    validatedStoredUserReview: archivedReview,
  });
});

test("ValidatedStoredUserReview.fromはarchivedAtのないarchived stored reviewを拒否する", () => {
  const invalidReview = createStoredUserReview({
    id: TestValues.userReviewId("urv_00000000000000000000000000000004"),
    status: "archived",
    archivedAt: null,
  });

  const result = ValidatedStoredUserReview.from(invalidReview);

  expect(result).toEqual({
    ok: false,
    error: {
      reason: "archivedMissingArchivedAt",
      id: TestValues.userReviewId("urv_00000000000000000000000000000004"),
      message:
        "Archived user review must have archivedAt: urv_00000000000000000000000000000004",
    },
  });
});

test("ValidatedStoredUserReview.fromはarchivedAtのある非archived stored reviewを拒否する", () => {
  const invalidReview = createStoredUserReview({
    id: TestValues.userReviewId("urv_00000000000000000000000000000003"),
    status: "completed",
    archivedAt: TestValues.isoDateTime("2026-05-06T12:30:00Z"),
  });

  const result = ValidatedStoredUserReview.from(invalidReview);

  expect(result).toEqual({
    ok: false,
    error: {
      reason: "nonArchivedHasArchivedAt",
      id: TestValues.userReviewId("urv_00000000000000000000000000000003"),
      message:
        "Non-archived user review must not have archivedAt: urv_00000000000000000000000000000003",
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
      specId: TestValues.specId("auth"),
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
        specId: TestValues.specId("auth"),
        fileKey: "tasks",
        relativePath: ".plugin-workspace/.specs/auth/tasks.md",
      },
    ],
    commentCount: 1,
    createdAt: TestValues.isoDateTime("2026-05-06T12:00:00Z"),
    archivedAt: input.archivedAt,
    summary: null,
    warnings: [],
  };
}
