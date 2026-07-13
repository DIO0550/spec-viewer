import { expect, test } from "vitest";

import type {
  ActiveUserReview,
  ArchivedUserReview,
} from "@/features/review-runs/domain/userReview";
import { UserReviewCollection } from "@/features/review-runs/domain/userReviewCollection";

const firstRun = createActiveUserReview("run-first");
const secondRun = createActiveUserReview("run-second");
const archivedFirstRun = createArchivedUserReview("run-first");

test("UserReviewCollection.addCreatedは作成runをactiveの先頭に追加して重複を除く", () => {
  const collection = UserReviewCollection.fromListResponse(
    [secondRun, firstRun],
    [archivedFirstRun],
    [],
  );
  const nextCollection = UserReviewCollection.addCreated(collection, firstRun);

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
    UserReviewCollection.fromListResponse(
      [archivedFirstRun as unknown as ActiveUserReview],
      [],
      [],
    ),
  ).toThrow("Archived user review cannot be placed in active collection");
});

test("UserReviewCollection.fromListResponseはarchived collection内の非archived reviewを拒否する", () => {
  expect(() =>
    UserReviewCollection.fromListResponse(
      [],
      [firstRun as unknown as ArchivedUserReview],
      [],
    ),
  ).toThrow("Non-archived user review cannot be placed in archived collection");
});

function createActiveUserReview(id: string): ActiveUserReview {
  return {
    schemaVersion: "spec-reviewer.user-review.v1",
    id,
    status: "active",
    target: {
      scope: "file",
      specId: "auth",
      fileKey: "tasks",
    },
    recordLocator: `${id}.json`,
    commentCount: 1,
    createdAt: "2026-05-06T12:00:00Z",
    updatedAt: "2026-05-06T12:00:00Z",
    archivedAt: null,
  };
}

function createArchivedUserReview(id: string): ArchivedUserReview {
  const activeReview = createActiveUserReview(id);

  return {
    ...activeReview,
    status: "archived",
    updatedAt: "2026-05-06T12:30:00Z",
    archivedAt: "2026-05-06T12:30:00Z",
  };
}
