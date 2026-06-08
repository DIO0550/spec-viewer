import { expect, test } from "vitest";

import {
  type UserReview as UserReviewType,
  type UserReviewSnapshot,
} from "@/features/review-runs/domain/userReview";
import { UserReviewCollection } from "@/features/review-runs/domain/userReviewCollection";

const firstRun = createUserReview("run-first", "active", null);
const secondRun = createUserReview("run-second", "completed", null);
const archivedFirstRun = createUserReview(
  "run-first",
  "archived",
  "2026-05-06T12:30:00Z",
);

test("UserReviewCollection.addCreatedは作成runをactiveの先頭に追加して重複を除く", () => {
  const collection = UserReviewCollection.fromListResponse(
    [secondRun, firstRun],
    [archivedFirstRun],
    [],
  );
  const nextCollection = UserReviewCollection.addCreated(
    collection,
    firstRun,
  );

  expect(nextCollection.active.map((run) => run.id)).toEqual([
    "run-first",
    "run-second",
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

  expect(nextCollection.active.map((run) => run.id)).toEqual(["run-second"]);
  expect(nextCollection.archived.map((run) => run.id)).toEqual(["run-first"]);
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
  status: UserReviewSnapshot["status"],
  archivedAt: UserReviewSnapshot["archivedAt"],
): UserReviewType {
  return {
    id,
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
    folderPath: `/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/${id}`,
    sourceFiles: [
      {
        specId: "auth",
        fileKey: "tasks",
        relativePath: ".plugin-workspace/.specs/auth/tasks.md",
      },
    ],
    commentCount: 1,
    createdAt: "2026-05-06T12:00:00Z",
    archivedAt,
    summary: null,
    warnings: [],
  } as UserReviewType;
}
