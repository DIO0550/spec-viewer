import * as TestValues from "@/features/review-runs/testing/validatedValueObjects";
import { expect, test } from "vitest";

import { UserReviewCollection } from "@/features/review-runs/domain/userReviewCollection";
import { UserReviewListState } from "@/features/review-runs/domain/userReviewListState";
import type { UserReview } from "@/features/review-runs/types/userReviewIpc";

const target = {
  scope: "file",
  specId: TestValues.specId("auth"),
  fileKey: "tasks",
} as const;
const activeRun = createUserReview("urv_00000000000000000000000000000012");
const secondActiveRun = createUserReview(
  "urv_00000000000000000000000000000016",
);
const archivedRun: UserReview = {
  ...activeRun,
  id: TestValues.userReviewId("urv_00000000000000000000000000000013"),
  status: "archived",
  folderPath:
    "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/archive/run-archived",
  archivedAt: TestValues.isoDateTime("2026-05-06T12:30:00Z"),
};

test("UserReviewListState.loadedはrunがなければemptyを返す", () => {
  const state = UserReviewListState.loaded(
    target,
    UserReviewCollection.empty(),
  );

  expect(state.status).toBe("empty");
  expect(state.active).toEqual([]);
});

test("UserReviewListState.loadedはrunがあればreadyを返す", () => {
  const collection = UserReviewCollection.fromListResponse([activeRun], [], []);
  const state = UserReviewListState.loaded(target, collection);

  expect(state.status).toBe("ready");
  expect(state.active).toEqual([activeRun]);
});

test("UserReviewListState.reduceUserReviewEventはreadyでcreated reviewをactive list先頭へ追加する", () => {
  const collection = UserReviewCollection.fromListResponse([activeRun], [], []);
  const state = UserReviewListState.loaded(target, collection);

  const result = UserReviewListState.reduceUserReviewEvent(state, {
    type: "reviewCreated",
    review: secondActiveRun,
  });

  expect(result.invalidatesInFlightListRequest).toBe(false);
  expect(result.state.status).toBe("ready");
  expect(result.state.active).toEqual([secondActiveRun, activeRun]);
});

test.each([
  [
    "created",
    { type: "reviewCreated" as const, review: activeRun },
    [activeRun],
    [],
  ],
  [
    "archived",
    { type: "reviewArchived" as const, review: archivedRun },
    [],
    [archivedRun],
  ],
])("UserReviewListState.reduceUserReviewEventはloading中の%s reviewを反映してrequestを無効化する", (_, event, expectedActive, expectedArchived) => {
  const result = UserReviewListState.reduceUserReviewEvent(
    UserReviewListState.loading(target),
    event,
  );

  expect(result.invalidatesInFlightListRequest).toBe(true);
  expect(result.state.status).toBe("ready");
  expect(result.state.active).toEqual(expectedActive);
  expect(result.state.archived).toEqual(expectedArchived);
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
    id: TestValues.userReviewId(id),
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
        specId: TestValues.specId("auth"),
        fileKey: "tasks",
        relativePath: ".plugin-workspace/.specs/auth/tasks.md",
      },
    ],
    commentCount: 1,
    createdAt: TestValues.isoDateTime("2026-05-06T12:00:00Z"),
    archivedAt: null,
    summary: null,
    warnings: [],
  };
}
