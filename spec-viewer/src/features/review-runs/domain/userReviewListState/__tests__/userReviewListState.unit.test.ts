import { expect, test } from "vitest";

import { UserReviewCollection } from "@/features/review-runs/domain/userReviewCollection";
import { UserReviewListState } from "@/features/review-runs/domain/userReviewListState";
import type { UserReview } from "@/features/review-runs/types/userReviewIpc";

const target = {
  scope: "file",
  specId: "auth",
  fileKey: "tasks",
} as const;
const activeRun = createUserReview("run-active");

test("UserReviewListState.loadedはrunがなければemptyを返す", () => {
  const state = UserReviewListState.loaded(
    target,
    UserReviewCollection.empty(),
  );

  expect(state.status).toBe("empty");
  expect(state.active).toEqual([]);
});

test("UserReviewListState.loadedはrunがあればreadyを返す", () => {
  const collection = UserReviewCollection.fromListResponse(
    [activeRun],
    [],
    [],
  );
  const state = UserReviewListState.loaded(target, collection);

  expect(state.status).toBe("ready");
  expect(state.active).toEqual([activeRun]);
});

test("UserReviewListState.applyCollectionTransformはloading中の更新でrequestを無効化する", () => {
  const result = UserReviewListState.applyCollectionTransform(
    UserReviewListState.loading(target),
    (collection) => UserReviewCollection.addCreated(collection, activeRun),
  );

  expect(result.invalidatesRequest).toBe(true);
  expect(result.state.status).toBe("ready");
  expect(result.state.active).toEqual([activeRun]);
});

test("UserReviewListState.applyCollectionTransformはidleなら状態を変えない", () => {
  const state = UserReviewListState.idle();
  const result = UserReviewListState.applyCollectionTransform(
    state,
    (collection) => collection,
  );

  expect(result.invalidatesRequest).toBe(false);
  expect(result.state).toBe(state);
});

function createUserReview(id: string): UserReview {
  return {
    id,
    status: "active",
    target,
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
    archivedAt: null,
    summary: null,
    warnings: [],
  };
}
