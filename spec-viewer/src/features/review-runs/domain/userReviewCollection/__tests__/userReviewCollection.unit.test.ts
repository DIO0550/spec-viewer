import * as TestValues from "@/shared/testing/validatedValueObjects";
import { expect, test } from "vitest";

import {
  type StoredUserReview,
  type UserReview as UserReviewType,
} from "@/features/review-runs/domain/userReview";
import { UserReviewCollection } from "@/features/review-runs/domain/userReviewCollection";
import { ValidatedStoredUserReview } from "@/features/review-runs/domain/validatedStoredUserReview";

const firstRun = createUserReview(
  "urv_00000000000000000000000000000014",
  "active",
  null,
);
const secondRun = createUserReview(
  "urv_00000000000000000000000000000015",
  "completed",
  null,
);
const archivedFirstRun = createUserReview(
  "urv_00000000000000000000000000000014",
  "archived",
  "2026-05-06T12:30:00Z",
);

test("UserReviewCollection.addCreatedは作成runをactiveの先頭に追加して重複を除く", () => {
  const collection = UserReviewCollection.fromListResponse(
    [secondRun, firstRun],
    [archivedFirstRun],
    [],
  );
  const nextCollection = UserReviewCollection.addCreated(collection, firstRun);

  expect(nextCollection.active.map((run) => run.id)).toEqual([
    "urv_00000000000000000000000000000014",
    "urv_00000000000000000000000000000015",
  ]);
  expect(nextCollection.archived).toEqual([]);
});

test("UserReviewCollection.moveArchivedはactiveから除外してarchivedの先頭に移す", () => {
  const collection = UserReviewCollection.fromListResponse(
    [firstRun, secondRun],
    [],
    [],
  );
  const nextCollection = UserReviewCollection.moveArchived(
    collection,
    archivedFirstRun,
  );

  expect(nextCollection.active.map((run) => run.id)).toEqual([
    "urv_00000000000000000000000000000015",
  ]);
  expect(nextCollection.archived.map((run) => run.id)).toEqual([
    "urv_00000000000000000000000000000014",
  ]);
});

test("UserReviewCollection.fromListResponseはactive collection内のarchived reviewを拒否する", () => {
  expect(() =>
    UserReviewCollection.fromListResponse([archivedFirstRun], [], []),
  ).toThrow("Archived user review cannot be placed in active collection");
});

test("UserReviewCollection.fromListResponseはarchived collection内の非archived reviewを拒否する", () => {
  expect(() =>
    UserReviewCollection.fromListResponse([], [firstRun], []),
  ).toThrow("Non-archived user review cannot be placed in archived collection");
});

function createUserReview(
  id: string,
  status: StoredUserReview["status"],
  archivedAt: string | null,
): UserReviewType {
  const stored: StoredUserReview = {
    id: TestValues.userReviewId(id),
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
    folderPath: `/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/${id}`,
    sourceFiles: [
      {
        specId: TestValues.specId("auth"),
        fileKey: "tasks",
        relativePath: ".plugin-workspace/.specs/auth/tasks.md",
      },
    ],
    commentCount: 1,
    createdAt: TestValues.isoDateTime("2026-05-06T12:00:00Z"),
    archivedAt: archivedAt === null ? null : TestValues.isoDateTime(archivedAt),
    summary: null,
    warnings: [],
  };
  const result = ValidatedStoredUserReview.from(stored);
  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return ValidatedStoredUserReview.to(result.validatedStoredUserReview);
}
