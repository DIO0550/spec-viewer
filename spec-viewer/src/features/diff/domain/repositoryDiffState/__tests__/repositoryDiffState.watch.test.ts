import { expect, test } from "vitest";

import {
  createInitialRepositoryDiffState,
  REPOSITORY_DIFF_REFRESH_DEBOUNCE_MS,
  type RepositoryDiffState,
  reduceRepositoryDiffState,
  shouldStartOverview,
} from "@/features/diff/domain/repositoryDiffState";

import { createOverview, failure, identity } from "./fixtures";

const T0 = 1_000;
const DUE_AT = T0 + REPOSITORY_DIFF_REFRESH_DEBOUNCE_MS;

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
 * Reduces the overview lifecycle up to the loaded state.
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

/**
 * Applies a sequence of actions to a starting state.
 *
 * @param state - Starting state.
 * @param actions - Actions to apply in order.
 * @returns The state after every action was reduced.
 */
function reduceAll(
  state: RepositoryDiffState,
  actions: readonly Parameters<typeof reduceRepositoryDiffState>[1][],
): RepositoryDiffState {
  return actions.reduce(reduceRepositoryDiffState, state);
}

test("externalChangeDetectedでdebouncingになりdueAtが窓ぶん先になる", () => {
  const state = reduceRepositoryDiffState(loadOverview(), {
    type: "externalChangeDetected",
    at: T0,
  });

  expect(state.status !== "idle" && state.refresh).toEqual({
    state: "debouncing",
    dueAt: DUE_AT,
    coalescedCount: 1,
  });
});

test("loading以外でdebounceElapsedを受けるとdueになりshouldStartOverviewがtrueになる", () => {
  const state = reduceAll(loadOverview(), [
    { type: "externalChangeDetected", at: T0 },
    { type: "debounceElapsed", at: DUE_AT },
  ]);

  expect(state.status !== "idle" && state.refresh.state).toBe("due");
  expect(shouldStartOverview(state)).toBe(true);
});

test.each([
  ["settled", loadOverview()],
  [
    "debouncing",
    reduceRepositoryDiffState(loadOverview(), {
      type: "externalChangeDetected",
      at: T0,
    }),
  ],
  [
    "pending",
    reduceAll(startOverview(), [
      { type: "externalChangeDetected", at: T0 },
      { type: "debounceElapsed", at: DUE_AT },
    ]),
  ],
  ["idle", createInitialRepositoryDiffState()],
])("refresh=%sではshouldStartOverviewがfalseを返す", (_name, state) => {
  expect(shouldStartOverview(state)).toBe(false);
});

test("連続したexternalChangeDetectedは1回へ合流しcoalescedCountが増える", () => {
  const state = reduceAll(loadOverview(), [
    { type: "externalChangeDetected", at: T0 },
    { type: "externalChangeDetected", at: T0 + 50 },
    { type: "externalChangeDetected", at: T0 + 90 },
  ]);

  expect(state.status !== "idle" && state.refresh).toEqual({
    state: "debouncing",
    dueAt: T0 + 90 + REPOSITORY_DIFF_REFRESH_DEBOUNCE_MS,
    coalescedCount: 3,
  });
});

test("loading中のdebounceElapsedはpendingになる", () => {
  const state = reduceAll(startOverview(), [
    { type: "externalChangeDetected", at: T0 },
    { type: "debounceElapsed", at: DUE_AT },
  ]);

  expect(state.status !== "idle" && state.refresh).toEqual({
    state: "pending",
    coalescedCount: 1,
  });
});

test.each([
  [
    "overviewSucceeded",
    { type: "overviewSucceeded", ...identity, overview: createOverview() },
  ],
  ["overviewFailed", { type: "overviewFailed", ...identity, failure }],
] as const)("pending中の%sでdueへ落ちる", (_name, settleAction) => {
  const state = reduceAll(startOverview(), [
    { type: "externalChangeDetected", at: T0 },
    { type: "debounceElapsed", at: DUE_AT },
    settleAction,
  ]);

  expect(state.status !== "idle" && state.refresh.state).toBe("due");
  expect(shouldStartOverview(state)).toBe(true);
});

test.each([
  [
    "due",
    reduceAll(loadOverview(), [
      { type: "externalChangeDetected", at: T0 },
      { type: "debounceElapsed", at: DUE_AT },
    ]),
  ],
  [
    "pending",
    reduceAll(startOverview(), [
      { type: "externalChangeDetected", at: T0 },
      { type: "debounceElapsed", at: DUE_AT },
    ]),
  ],
  [
    "debouncing",
    reduceRepositoryDiffState(loadOverview(), {
      type: "externalChangeDetected",
      at: T0,
    }),
  ],
])("overviewStartedはrefresh=%sを消費してsettledにする", (_name, state) => {
  const started = reduceRepositoryDiffState(state, {
    type: "overviewStarted",
    ...identity,
    generation: 9,
  });

  expect(started.status !== "idle" && started.refresh).toEqual({
    state: "settled",
  });
});

test("error状態でもexternalChangeDetectedを受理する", () => {
  const errored = reduceRepositoryDiffState(startOverview(), {
    type: "overviewFailed",
    ...identity,
    failure,
  });
  const state = reduceRepositoryDiffState(errored, {
    type: "externalChangeDetected",
    at: T0,
  });

  expect(state.status !== "idle" && state.refresh.state).toBe("debouncing");
});

test("at === dueAtは満了として扱う", () => {
  const state = reduceAll(loadOverview(), [
    { type: "externalChangeDetected", at: T0 },
    { type: "debounceElapsed", at: DUE_AT },
  ]);

  expect(state.status !== "idle" && state.refresh.state).toBe("due");
});

test("at < dueAtのdebounceElapsedは同一参照で無視する", () => {
  const debouncing = reduceRepositoryDiffState(loadOverview(), {
    type: "externalChangeDetected",
    at: T0,
  });

  expect(
    reduceRepositoryDiffState(debouncing, {
      type: "debounceElapsed",
      at: DUE_AT - 1,
    }),
  ).toBe(debouncing);
});

test("idle状態のexternalChangeDetectedを破棄する", () => {
  const idle = createInitialRepositoryDiffState();

  expect(
    reduceRepositoryDiffState(idle, { type: "externalChangeDetected", at: T0 }),
  ).toBe(idle);
});

test("pending中の追加イベントが10回でも完了後の再取得は1回である", () => {
  const pending = reduceAll(startOverview(), [
    { type: "externalChangeDetected", at: T0 },
    { type: "debounceElapsed", at: DUE_AT },
  ]);
  const bursted = reduceAll(
    pending,
    Array.from({ length: 10 }, (_, index) => ({
      type: "externalChangeDetected" as const,
      at: DUE_AT + index,
    })),
  );
  const settled = reduceRepositoryDiffState(bursted, {
    type: "overviewSucceeded",
    ...identity,
    overview: createOverview(),
  });

  expect(settled.status !== "idle" && settled.refresh.state).toBe("debouncing");
  expect(shouldStartOverview(settled)).toBe(false);
});

test("同じdebounceElapsedを2回適用しても2回目は同一参照を返す", () => {
  const due = reduceAll(loadOverview(), [
    { type: "externalChangeDetected", at: T0 },
    { type: "debounceElapsed", at: DUE_AT },
  ]);

  expect(
    reduceRepositoryDiffState(due, { type: "debounceElapsed", at: DUE_AT }),
  ).toBe(due);
});
