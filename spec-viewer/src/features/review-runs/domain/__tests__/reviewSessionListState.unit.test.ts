import { expect, test } from "vitest";

import { ReviewSessionCollection } from "@/features/review-runs/domain/reviewSessionCollection";
import { ReviewSessionListState } from "@/features/review-runs/domain/reviewSessionListState";
import type { ReviewRun } from "@/features/review-runs/types/reviewRun";

const target = {
  scope: "file",
  specId: "auth",
  fileKey: "tasks",
} as const;
const activeRun = createReviewRun("run-active");

test("ReviewSessionListState.loadedはrunがなければemptyを返す", () => {
  const state = ReviewSessionListState.loaded(
    target,
    ReviewSessionCollection.empty(),
  );

  expect(state.status).toBe("empty");
  expect(state.active).toEqual([]);
});

test("ReviewSessionListState.loadedはrunがあればreadyを返す", () => {
  const collection = ReviewSessionCollection.fromListResponse(
    [activeRun],
    [],
    [],
  );
  const state = ReviewSessionListState.loaded(target, collection);

  expect(state.status).toBe("ready");
  expect(state.active).toEqual([activeRun]);
});

test("ReviewSessionListState.applyCollectionTransformはloading中の更新でrequestを無効化する", () => {
  const result = ReviewSessionListState.applyCollectionTransform(
    ReviewSessionListState.loading(target),
    (collection) => ReviewSessionCollection.addCreated(collection, activeRun),
  );

  expect(result.invalidatesRequest).toBe(true);
  expect(result.state.status).toBe("ready");
  expect(result.state.active).toEqual([activeRun]);
});

test("ReviewSessionListState.applyCollectionTransformはidleなら状態を変えない", () => {
  const state = ReviewSessionListState.idle();
  const result = ReviewSessionListState.applyCollectionTransform(
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
