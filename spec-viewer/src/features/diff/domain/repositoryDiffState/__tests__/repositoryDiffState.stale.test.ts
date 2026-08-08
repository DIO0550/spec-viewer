import { expect, test } from "vitest";

import {
  createInitialRepositoryDiffState,
  type RepositoryDiffState,
  reduceRepositoryDiffState,
} from "@/features/diff/domain/repositoryDiffState";

import {
  createOverview,
  createPage,
  failure,
  identity,
  NODE_A,
  review,
  SNAPSHOT_1,
  SNAPSHOT_2,
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

test("identity一致のoverviewSucceededを受理する", () => {
  expect(loadOverview().status).toBe("loaded");
});

test.each([
  ["worktreeId", { worktreeId: WORKTREE_B }],
  ["generation", { generation: 99 }],
  ["baseOverride", { baseOverride: "refs/heads/develop" }],
])("古い%sのoverviewSucceededを破棄して同一参照を返す", (_name, override) => {
  const state = startOverview();
  const next = reduceRepositoryDiffState(state, {
    type: "overviewSucceeded",
    ...identity,
    ...override,
    overview: createOverview(),
  });

  expect(next).toBe(state);
});

test("古いidentityのoverviewFailedを破棄する", () => {
  const state = startOverview();

  expect(
    reduceRepositoryDiffState(state, {
      type: "overviewFailed",
      ...identity,
      generation: 99,
      failure,
    }),
  ).toBe(state);
});

test.each([
  ["overviewSucceeded", "overviewSucceeded"],
  ["overviewFailed", "overviewFailed"],
] as const)("idle状態のidentity付きaction（%s）を破棄する", (_name, type) => {
  const state = createInitialRepositoryDiffState();
  const action =
    type === "overviewSucceeded"
      ? ({
          type,
          ...identity,
          overview: createOverview(),
        } as const)
      : ({ type, ...identity, failure } as const);

  expect(reduceRepositoryDiffState(state, action)).toBe(state);
});

test("古いsnapshotIdのdirectoryExpansionSucceededを破棄する", () => {
  const state = reduceRepositoryDiffState(loadOverview(), {
    type: "directoryExpansionStarted",
    ...identity,
    snapshotId: SNAPSHOT_1,
    nodeId: NODE_A,
    cursor: null,
  });

  expect(
    reduceRepositoryDiffState(state, {
      type: "directoryExpansionSucceeded",
      ...identity,
      snapshotId: SNAPSHOT_2,
      page: createPage(NODE_A, ["a.log"]),
    }),
  ).toBe(state);
});

test("古いsnapshotIdのfileReviewSucceededを破棄する", () => {
  const state = reduceRepositoryDiffState(loadOverview(), {
    type: "fileReviewStarted",
    ...identity,
    snapshotId: SNAPSHOT_1,
    path: "src/main.ts",
  });

  expect(
    reduceRepositoryDiffState(state, {
      type: "fileReviewSucceeded",
      ...identity,
      snapshotId: SNAPSHOT_2,
      path: "src/main.ts",
      review,
    }),
  ).toBe(state);
});

test("overviewStartedはidentity検証なしで常に受理される", () => {
  const next = reduceRepositoryDiffState(loadOverview(), {
    type: "overviewStarted",
    ...identity,
    worktreeId: WORKTREE_B,
    generation: 42,
  });

  expect(next).toMatchObject({
    status: "loading",
    worktreeId: WORKTREE_B,
    generation: 42,
  });
});

test("worktreeClearedはidentity検証なしで常に受理される", () => {
  expect(
    reduceRepositoryDiffState(loadOverview(), { type: "worktreeCleared" }),
  ).toEqual({ status: "idle" });
});

test("worktree A→B→Aと往復してもAの古い応答は破棄される", () => {
  const toB = reduceRepositoryDiffState(loadOverview(), {
    type: "overviewStarted",
    ...identity,
    worktreeId: WORKTREE_B,
    generation: 2,
  });
  const backToA = reduceRepositoryDiffState(toB, {
    type: "overviewStarted",
    ...identity,
    generation: 3,
  });

  expect(
    reduceRepositoryDiffState(backToA, {
      type: "overviewSucceeded",
      ...identity,
      generation: 1,
      overview: createOverview(),
    }),
  ).toBe(backToA);
});

test("大量のstale actionを適用しても常に同一参照を返す", () => {
  const state = startOverview();
  const results = Array.from({ length: 50 }, (_, index) =>
    reduceRepositoryDiffState(state, {
      type: "overviewSucceeded",
      ...identity,
      generation: index + 100,
      overview: createOverview(),
    }),
  );

  expect(results.every((result) => result === state)).toBe(true);
});
