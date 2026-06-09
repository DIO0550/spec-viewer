import { expect, test } from "vitest";

import type { UserReviewSnapshot } from "@/features/review-runs/domain/userReview";
import { UserReviewSnapshotDecoder } from "@/features/review-runs/infra/userReviewSnapshotDecoder";

test("UserReviewSnapshotDecoder.tryFromSnapshotはvalid active snapshotをsuccessとして返す", () => {
  const activeReview = createUserReviewSnapshot({
    id: "review-active",
    status: "active",
    archivedAt: null,
  });

  const result = UserReviewSnapshotDecoder.tryFromSnapshot(activeReview);

  expect(result).toEqual({
    ok: true,
    userReview: activeReview,
  });
});

test("UserReviewSnapshotDecoder.tryFromSnapshotはvalid archived snapshotをsuccessとして返す", () => {
  const archivedReview = createUserReviewSnapshot({
    id: "review-archived",
    status: "archived",
    archivedAt: "2026-05-06T12:30:00Z",
  });

  const result = UserReviewSnapshotDecoder.tryFromSnapshot(archivedReview);

  expect(result).toEqual({
    ok: true,
    userReview: archivedReview,
  });
});

test("UserReviewSnapshotDecoder.tryFromSnapshotはarchivedAtのないarchived snapshotをfailureとして返す", () => {
  const invalidReview = createUserReviewSnapshot({
    id: "review-invalid-archived",
    status: "archived",
    archivedAt: null,
  });

  const result = UserReviewSnapshotDecoder.tryFromSnapshot(invalidReview);

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

test("UserReviewSnapshotDecoder.tryFromSnapshotはarchivedAtのある非archived snapshotをfailureとして返す", () => {
  const invalidReview = createUserReviewSnapshot({
    id: "review-invalid-active",
    status: "completed",
    archivedAt: "2026-05-06T12:30:00Z",
  });

  const result = UserReviewSnapshotDecoder.tryFromSnapshot(invalidReview);

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

test("UserReviewSnapshotDecoder.fromSnapshotはinvalid snapshotを例外として拒否する", () => {
  const invalidReview = createUserReviewSnapshot({
    id: "review-invalid-from-snapshot",
    status: "archived",
    archivedAt: null,
  });

  expect(() => UserReviewSnapshotDecoder.fromSnapshot(invalidReview)).toThrow(
    "Archived user review must have archivedAt: review-invalid-from-snapshot",
  );
});

function createUserReviewSnapshot(
  input: Pick<UserReviewSnapshot, "archivedAt" | "id" | "status">,
): UserReviewSnapshot {
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
