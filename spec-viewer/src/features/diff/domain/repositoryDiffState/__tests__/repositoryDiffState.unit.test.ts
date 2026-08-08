import { expect, test } from "vitest";

import {
  createInitialRepositoryDiffState,
  type RepositoryDiffState,
  reduceRepositoryDiffState,
} from "@/features/diff/domain/repositoryDiffState";

import {
  createInvalidOverrideOverview,
  createOverview,
  failure,
  identity,
  review,
  SNAPSHOT_1,
  WORKTREE_B,
} from "./fixtures";

/**
 * Reduces `overviewStarted` from the initial state.
 *
 * @returns The loading state for the shared identity.
 */
function startOverview(): RepositoryDiffState {
  return reduceRepositoryDiffState(createInitialRepositoryDiffState(), {
    type: "overviewStarted",
    ...identity,
  });
}

/**
 * Reduces a successful overview on top of the loading state.
 *
 * @returns The loaded state for the shared identity.
 */
function loadOverview(): RepositoryDiffState {
  return reduceRepositoryDiffState(startOverview(), {
    type: "overviewSucceeded",
    ...identity,
    overview: createOverview(),
  });
}

test("初期状態はidleである", () => {
  expect(createInitialRepositoryDiffState()).toEqual({ status: "idle" });
});

test("overviewStartedでidleからloadingへ遷移する", () => {
  expect(startOverview()).toMatchObject({
    status: "loading",
    worktreeId: identity.worktreeId,
    generation: 1,
    refresh: { state: "settled" },
  });
});

test("overviewSucceededでloadingからloadedへ遷移する", () => {
  expect(loadOverview().status).toBe("loaded");
});

test("overviewFailedでloadingからerrorへ遷移する", () => {
  const next = reduceRepositoryDiffState(startOverview(), {
    type: "overviewFailed",
    ...identity,
    failure,
  });

  expect(next).toMatchObject({ status: "error", failure });
});

test("loaded中のoverviewStartedでloadingへ戻る", () => {
  const next = reduceRepositoryDiffState(loadOverview(), {
    type: "overviewStarted",
    ...identity,
    generation: 2,
  });

  expect(next).toMatchObject({ status: "loading", generation: 2 });
});

test.each([
  ["idle", createInitialRepositoryDiffState()],
  ["loading", startOverview()],
  ["loaded", loadOverview()],
])("worktreeClearedは%s状態からidleへ戻す", (_name, state) => {
  expect(reduceRepositoryDiffState(state, { type: "worktreeCleared" })).toEqual(
    { status: "idle" },
  );
});

test("worktree切替は新しい要求として受理される", () => {
  const next = reduceRepositoryDiffState(loadOverview(), {
    type: "overviewStarted",
    ...identity,
    worktreeId: WORKTREE_B,
    generation: 2,
  });

  expect(next).toMatchObject({ status: "loading", worktreeId: WORKTREE_B });
});

test("baseOverride変更は新しい要求として受理される", () => {
  const next = reduceRepositoryDiffState(loadOverview(), {
    type: "overviewStarted",
    ...identity,
    baseOverride: "refs/heads/develop",
    generation: 2,
  });

  expect(next).toMatchObject({ baseOverride: "refs/heads/develop" });
});

test("base.state=invalidOverrideのoverviewもloadedとして保持する", () => {
  const next = reduceRepositoryDiffState(startOverview(), {
    type: "overviewSucceeded",
    ...identity,
    overview: createInvalidOverrideOverview(),
  });

  expect(next).toMatchObject({
    status: "loaded",
    overview: { base: { state: "invalidOverride" } },
  });
});

test("loaded直後のサブ状態は未選択・未展開・settledである", () => {
  const state = loadOverview();

  expect(state.status === "loaded" && state.fileReview).toEqual({
    state: "none",
  });
  expect(state.status === "loaded" && state.expansions.size).toBe(0);
  expect(state.status === "loaded" && state.refresh).toEqual({
    state: "settled",
  });
});

test("fileReviewはnoneからloadingを経てloadedへ遷移する", () => {
  const loading = reduceRepositoryDiffState(loadOverview(), {
    type: "fileReviewStarted",
    ...identity,
    snapshotId: SNAPSHOT_1,
    path: "src/main.ts",
  });
  const loaded = reduceRepositoryDiffState(loading, {
    type: "fileReviewSucceeded",
    ...identity,
    snapshotId: SNAPSHOT_1,
    path: "src/main.ts",
    review,
  });

  expect(loading.status === "loaded" && loading.fileReview.state).toBe(
    "loading",
  );
  expect(loaded.status === "loaded" && loaded.fileReview).toEqual({
    state: "loaded",
    path: "src/main.ts",
    review,
  });
});

test("fileReviewFailedはoverviewを保持したままfailedになる", () => {
  const loading = reduceRepositoryDiffState(loadOverview(), {
    type: "fileReviewStarted",
    ...identity,
    snapshotId: SNAPSHOT_1,
    path: "src/main.ts",
  });
  const failed = reduceRepositoryDiffState(loading, {
    type: "fileReviewFailed",
    ...identity,
    snapshotId: SNAPSHOT_1,
    path: "src/main.ts",
    failure,
  });

  expect(failed).toMatchObject({
    status: "loaded",
    overview: createOverview(),
  });
  expect(failed.status === "loaded" && failed.fileReview).toMatchObject({
    state: "failed",
    path: "src/main.ts",
  });
});

test("同じactionを2回適用しても状態が壊れない", () => {
  const once = loadOverview();
  const twice = reduceRepositoryDiffState(once, {
    type: "overviewSucceeded",
    ...identity,
    overview: createOverview(),
  });

  expect(twice).toMatchObject({ status: "loaded" });
  expect(twice.status === "loaded" && twice.expansions.size).toBe(0);
});
