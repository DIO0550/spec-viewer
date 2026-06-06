import { expect, test } from "vitest";

import { ReviewSessionCollection } from "@/features/review-runs/domain/reviewSessionCollection";
import type { ReviewRun } from "@/features/review-runs/types/reviewRun";

const firstRun = createReviewRun("run-first", "active", null);
const secondRun = createReviewRun("run-second", "completed", null);
const archivedFirstRun = createReviewRun(
  "run-first",
  "archived",
  "2026-05-06T12:30:00Z",
);

test("ReviewSessionCollection.addCreatedは作成runをactiveの先頭に追加して重複を除く", () => {
  const collection = ReviewSessionCollection.fromListResponse(
    [secondRun, firstRun],
    [archivedFirstRun],
    [],
  );
  const nextCollection = ReviewSessionCollection.addCreated(
    collection,
    firstRun,
  );

  expect(nextCollection.active.map((run) => run.id)).toEqual([
    "run-first",
    "run-second",
  ]);
  expect(nextCollection.archived).toEqual([]);
});

test("ReviewSessionCollection.moveArchivedはactiveから除外してarchivedの先頭に移す", () => {
  const collection = ReviewSessionCollection.fromListResponse(
    [firstRun, secondRun],
    [],
    [],
  );
  const nextCollection = ReviewSessionCollection.moveArchived(
    collection,
    archivedFirstRun,
  );

  expect(nextCollection.active.map((run) => run.id)).toEqual(["run-second"]);
  expect(nextCollection.archived.map((run) => run.id)).toEqual(["run-first"]);
});

function createReviewRun(
  id: string,
  status: ReviewRun["status"],
  archivedAt: ReviewRun["archivedAt"],
): ReviewRun {
  return {
    id,
    status,
    target: {
      scope: "file",
      specId: "auth",
      fileKey: "tasks",
    },
    executionTarget: {
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
  };
}
