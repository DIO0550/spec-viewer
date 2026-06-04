import { expect, test } from "vitest";

import { ReviewRunCollection } from "@/features/review-runs/domain/reviewRunCollection";
import { ReviewRunListState } from "@/features/review-runs/domain/reviewRunListState";
import type { ReviewRun } from "@/features/review-runs/types/reviewRun";

const target = {
  scope: "file",
  specId: "auth",
  fileKey: "tasks",
} as const;
const activeRun = createReviewRun("run-active");

test("ReviewRunListState.loadedはrunがなければemptyを返す", () => {
  const state = ReviewRunListState.loaded(target, ReviewRunCollection.empty());

  expect(state.status).toBe("empty");
  expect(state.active).toEqual([]);
});

test("ReviewRunListState.loadedはrunがあればreadyを返す", () => {
  const collection = ReviewRunCollection.fromListResponse([activeRun], [], []);
  const state = ReviewRunListState.loaded(target, collection);

  expect(state.status).toBe("ready");
  expect(state.active).toEqual([activeRun]);
});

test("ReviewRunListState.applyCollectionTransformはloading中の更新でrequestを無効化する", () => {
  const result = ReviewRunListState.applyCollectionTransform(
    ReviewRunListState.loading(target),
    (collection) => ReviewRunCollection.addCreated(collection, activeRun),
  );

  expect(result.invalidatesRequest).toBe(true);
  expect(result.state.status).toBe("ready");
  expect(result.state.active).toEqual([activeRun]);
});

test("ReviewRunListState.applyCollectionTransformはidleなら状態を変えない", () => {
  const state = ReviewRunListState.idle();
  const result = ReviewRunListState.applyCollectionTransform(
    state,
    (collection) => collection,
  );

  expect(result.invalidatesRequest).toBe(false);
  expect(result.state).toBe(state);
});

function createReviewRun(id: string): ReviewRun {
  return {
    id,
    status: "active",
    target,
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
    archivedAt: null,
    summary: null,
    warnings: [],
  };
}
