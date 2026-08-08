import { expect, test } from "vitest";

import { RepositoryIgnoredCursor } from "@/features/diff/domain/repositoryDiff";
import {
  createInitialRepositoryDiffState,
  type RepositoryDiffState,
  type RepositoryDirectoryExpansion,
  reduceRepositoryDiffState,
} from "@/features/diff/domain/repositoryDiffState";

import {
  createEntry,
  createOverview,
  createPage,
  failure,
  identity,
  NODE_A,
  NODE_B,
  SNAPSHOT_1,
} from "./fixtures";

const PAGE_2_CURSOR = RepositoryIgnoredCursor.fromString("ic1_offset_200");
const scope = { ...identity, snapshotId: SNAPSHOT_1 } as const;

/**
 * Reduces the overview lifecycle up to the loaded state.
 *
 * @returns The loaded state for the shared identity.
 */
function loadOverview(): RepositoryDiffState {
  return reduceRepositoryDiffState(
    reduceRepositoryDiffState(createInitialRepositoryDiffState(), {
      type: "overviewStarted",
      ...identity,
    }),
    { type: "overviewSucceeded", ...identity, overview: createOverview() },
  );
}

/**
 * Reads one node's expansion out of a state.
 *
 * @param state - State to inspect.
 * @param nodeId - Node whose expansion to read.
 * @returns The expansion, or undefined when the node was never touched.
 */
function expansionOf(
  state: RepositoryDiffState,
  nodeId: typeof NODE_A,
): RepositoryDirectoryExpansion | undefined {
  return state.status === "loaded" ? state.expansions.get(nodeId) : undefined;
}

test("directoryExpansionStarted（cursor=null）はloadedが空のexpandingになる", () => {
  const state = reduceRepositoryDiffState(loadOverview(), {
    type: "directoryExpansionStarted",
    ...scope,
    nodeId: NODE_A,
    cursor: null,
  });

  expect(expansionOf(state, NODE_A)).toEqual({
    state: "expanding",
    loaded: [],
    cursor: null,
  });
});

test("directoryExpansionSucceededでexpandedになりentriesとnextCursorを保持する", () => {
  const started = reduceRepositoryDiffState(loadOverview(), {
    type: "directoryExpansionStarted",
    ...scope,
    nodeId: NODE_A,
    cursor: null,
  });
  const state = reduceRepositoryDiffState(started, {
    type: "directoryExpansionSucceeded",
    ...scope,
    page: createPage(NODE_A, ["a.log"], PAGE_2_CURSOR),
  });

  expect(expansionOf(state, NODE_A)).toEqual({
    state: "expanded",
    entries: [createEntry("a.log")],
    nextCursor: PAGE_2_CURSOR,
  });
});

test("2ページ目の取得中でも1ページ目のentriesがloadedに保持される", () => {
  const page1 = reduceRepositoryDiffState(
    reduceRepositoryDiffState(loadOverview(), {
      type: "directoryExpansionStarted",
      ...scope,
      nodeId: NODE_A,
      cursor: null,
    }),
    {
      type: "directoryExpansionSucceeded",
      ...scope,
      page: createPage(NODE_A, ["a.log"], PAGE_2_CURSOR),
    },
  );
  const page2Loading = reduceRepositoryDiffState(page1, {
    type: "directoryExpansionStarted",
    ...scope,
    nodeId: NODE_A,
    cursor: PAGE_2_CURSOR,
  });

  expect(expansionOf(page2Loading, NODE_A)).toEqual({
    state: "expanding",
    loaded: [createEntry("a.log")],
    cursor: PAGE_2_CURSOR,
  });
});

test("2ページ目成功でentriesが累積される", () => {
  const page2Loading = reduceRepositoryDiffState(
    reduceRepositoryDiffState(
      reduceRepositoryDiffState(loadOverview(), {
        type: "directoryExpansionStarted",
        ...scope,
        nodeId: NODE_A,
        cursor: null,
      }),
      {
        type: "directoryExpansionSucceeded",
        ...scope,
        page: createPage(NODE_A, ["a.log"], PAGE_2_CURSOR),
      },
    ),
    {
      type: "directoryExpansionStarted",
      ...scope,
      nodeId: NODE_A,
      cursor: PAGE_2_CURSOR,
    },
  );
  const state = reduceRepositoryDiffState(page2Loading, {
    type: "directoryExpansionSucceeded",
    ...scope,
    page: createPage(NODE_A, ["b.log"]),
  });

  expect(expansionOf(state, NODE_A)).toEqual({
    state: "expanded",
    entries: [createEntry("a.log"), createEntry("b.log")],
    nextCursor: null,
  });
});

test("複数ノードの展開は独立に保持される", () => {
  const both = reduceRepositoryDiffState(
    reduceRepositoryDiffState(loadOverview(), {
      type: "directoryExpansionStarted",
      ...scope,
      nodeId: NODE_A,
      cursor: null,
    }),
    {
      type: "directoryExpansionStarted",
      ...scope,
      nodeId: NODE_B,
      cursor: null,
    },
  );
  const state = reduceRepositoryDiffState(both, {
    type: "directoryExpansionSucceeded",
    ...scope,
    page: createPage(NODE_A, ["a.log"]),
  });

  expect(expansionOf(state, NODE_A)?.state).toBe("expanded");
  expect(expansionOf(state, NODE_B)?.state).toBe("expanding");
});

test("directoryExpansionFailedはloadedの取得済みページを保持する", () => {
  const page2Loading = reduceRepositoryDiffState(
    reduceRepositoryDiffState(
      reduceRepositoryDiffState(loadOverview(), {
        type: "directoryExpansionStarted",
        ...scope,
        nodeId: NODE_A,
        cursor: null,
      }),
      {
        type: "directoryExpansionSucceeded",
        ...scope,
        page: createPage(NODE_A, ["a.log"], PAGE_2_CURSOR),
      },
    ),
    {
      type: "directoryExpansionStarted",
      ...scope,
      nodeId: NODE_A,
      cursor: PAGE_2_CURSOR,
    },
  );
  const state = reduceRepositoryDiffState(page2Loading, {
    type: "directoryExpansionFailed",
    ...scope,
    nodeId: NODE_A,
    failure,
  });

  expect(expansionOf(state, NODE_A)).toEqual({
    state: "failed",
    loaded: [createEntry("a.log")],
    failure,
  });
});

test("failedから再度startedでloadedを引き継いでexpandingへ復帰する", () => {
  const failed = reduceRepositoryDiffState(
    reduceRepositoryDiffState(
      reduceRepositoryDiffState(
        reduceRepositoryDiffState(loadOverview(), {
          type: "directoryExpansionStarted",
          ...scope,
          nodeId: NODE_A,
          cursor: null,
        }),
        {
          type: "directoryExpansionSucceeded",
          ...scope,
          page: createPage(NODE_A, ["a.log"], PAGE_2_CURSOR),
        },
      ),
      {
        type: "directoryExpansionStarted",
        ...scope,
        nodeId: NODE_A,
        cursor: PAGE_2_CURSOR,
      },
    ),
    { type: "directoryExpansionFailed", ...scope, nodeId: NODE_A, failure },
  );
  const retried = reduceRepositoryDiffState(failed, {
    type: "directoryExpansionStarted",
    ...scope,
    nodeId: NODE_A,
    cursor: PAGE_2_CURSOR,
  });

  expect(expansionOf(retried, NODE_A)).toEqual({
    state: "expanding",
    loaded: [createEntry("a.log")],
    cursor: PAGE_2_CURSOR,
  });
});

test("空ページの展開はentriesが空になる", () => {
  const state = reduceRepositoryDiffState(
    reduceRepositoryDiffState(loadOverview(), {
      type: "directoryExpansionStarted",
      ...scope,
      nodeId: NODE_A,
      cursor: null,
    }),
    {
      type: "directoryExpansionSucceeded",
      ...scope,
      page: createPage(NODE_A, []),
    },
  );

  expect(expansionOf(state, NODE_A)).toEqual({
    state: "expanded",
    entries: [],
    nextCursor: null,
  });
});

test("展開中に同じノードへ再度startedを送っても同一参照を返す", () => {
  const started = reduceRepositoryDiffState(loadOverview(), {
    type: "directoryExpansionStarted",
    ...scope,
    nodeId: NODE_A,
    cursor: null,
  });

  expect(
    reduceRepositoryDiffState(started, {
      type: "directoryExpansionStarted",
      ...scope,
      nodeId: NODE_A,
      cursor: null,
    }),
  ).toBe(started);
});

test("loaded以外の状態では展開actionを破棄する", () => {
  const loading = reduceRepositoryDiffState(
    createInitialRepositoryDiffState(),
    { type: "overviewStarted", ...identity },
  );

  expect(
    reduceRepositoryDiffState(loading, {
      type: "directoryExpansionStarted",
      ...scope,
      nodeId: NODE_A,
      cursor: null,
    }),
  ).toBe(loading);
});

test("overviewSucceededでexpansionsが破棄される", () => {
  const expanded = reduceRepositoryDiffState(loadOverview(), {
    type: "directoryExpansionStarted",
    ...scope,
    nodeId: NODE_A,
    cursor: null,
  });
  const reloaded = reduceRepositoryDiffState(
    reduceRepositoryDiffState(expanded, {
      type: "overviewStarted",
      ...identity,
      generation: 2,
    }),
    {
      type: "overviewSucceeded",
      ...identity,
      generation: 2,
      overview: createOverview(),
    },
  );

  expect(reloaded.status === "loaded" && reloaded.expansions.size).toBe(0);
});
