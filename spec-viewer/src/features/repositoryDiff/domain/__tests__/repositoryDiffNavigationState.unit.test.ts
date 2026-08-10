import { expect, test } from "vitest";

import {
  createInitialRepositoryDiffNavigationEntry,
  createInitialRepositoryDiffNavigationState,
  type RepositoryDiffNavigationState,
  reduceRepositoryDiffNavigationState,
} from "@/features/repositoryDiff/domain/repositoryDiffNavigationState";

test("未訪問のrepository diff navigationはChanged・未選択・未展開で始まる", () => {
  const entry = createInitialRepositoryDiffNavigationEntry();

  expect(entry).toEqual({
    filter: "changed",
    selectedPath: null,
    expandedPaths: [],
  });
});

test("navigation stateは未訪問keyをentriesへ追加せずに扱える", () => {
  const state: RepositoryDiffNavigationState = {
    entriesByKey: {},
  };

  expect(state.entriesByKey).toEqual({});
});

test("worktreeごとにfilter・selection・expansionを独立して復元する", () => {
  let state = createInitialRepositoryDiffNavigationState();
  state = reduceRepositoryDiffNavigationState(state, {
    type: "filterChanged",
    key: "worktree-a",
    filter: "all",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "pathSelected",
    key: "worktree-a",
    path: "src/a.ts",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "directoryToggled",
    key: "worktree-a",
    path: "src",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "filterChanged",
    key: "worktree-b",
    filter: "all",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "pathSelected",
    key: "worktree-b",
    path: "src/b.ts",
  });

  expect(state.entriesByKey["worktree-a"]).toEqual({
    filter: "all",
    selectedPath: "src/a.ts",
    expandedPaths: ["src"],
  });
  expect(state.entriesByKey["worktree-b"]).toEqual({
    filter: "all",
    selectedPath: "src/b.ts",
    expandedPaths: [],
  });
});

test("navigation actionはfilter切替時にoverviewを再取得せずentryだけを更新する", () => {
  const initial = createInitialRepositoryDiffNavigationState();
  const next = reduceRepositoryDiffNavigationState(initial, {
    type: "filterChanged",
    key: "worktree-a",
    filter: "all",
  });

  expect(initial.entriesByKey).toEqual({});
  expect(next.entriesByKey["worktree-a"]?.filter).toBe("all");
});

test("empty treeのreconcileは選択と展開を安全にpruneする", () => {
  let state = createInitialRepositoryDiffNavigationState();
  state = reduceRepositoryDiffNavigationState(state, {
    type: "pathSelected",
    key: "worktree-a",
    path: "src/a.ts",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "directoryToggled",
    key: "worktree-a",
    path: "src",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "reconciled",
    key: "worktree-a",
    visiblePaths: [],
    directoryPaths: [],
  });

  expect(state.entriesByKey["worktree-a"]).toEqual({
    filter: "changed",
    selectedPath: null,
    expandedPaths: [],
  });
});

test("reconcileはdeferred・loading・failed directoryの展開を保持する", () => {
  let state = createInitialRepositoryDiffNavigationState();
  for (const path of ["vendor", "generated", "broken"]) {
    state = reduceRepositoryDiffNavigationState(state, {
      type: "directoryToggled",
      key: "worktree-a",
      path,
    });
  }
  state = reduceRepositoryDiffNavigationState(state, {
    type: "reconciled",
    key: "worktree-a",
    visiblePaths: ["src/a.ts"],
    directoryPaths: ["vendor", "generated", "broken"],
  });

  expect(state.entriesByKey["worktree-a"]?.expandedPaths).toEqual([
    "vendor",
    "generated",
    "broken",
  ]);
});

test("unknown key・duplicate toggle・不正pathは安全なno-opまたはdefault entryになる", () => {
  const initial = createInitialRepositoryDiffNavigationState();
  const unknown = reduceRepositoryDiffNavigationState(initial, {
    type: "pathSelected",
    key: "unknown",
    path: null,
  });
  const expanded = reduceRepositoryDiffNavigationState(unknown, {
    type: "directoryToggled",
    key: "unknown",
    path: "src",
  });
  const collapsed = reduceRepositoryDiffNavigationState(expanded, {
    type: "directoryToggled",
    key: "unknown",
    path: "src",
  });
  const invalid = reduceRepositoryDiffNavigationState(collapsed, {
    type: "pathSelected",
    key: "unknown",
    path: "../outside",
  });

  expect(collapsed.entriesByKey.unknown).toEqual({
    filter: "changed",
    selectedPath: null,
    expandedPaths: [],
  });
  expect(invalid).toBe(collapsed);
});

test("AllからChangedへのreconcileはselectionをpruneしdeferred/error directoryの展開を保持する", () => {
  let state = createInitialRepositoryDiffNavigationState();
  state = reduceRepositoryDiffNavigationState(state, {
    type: "filterChanged",
    key: "worktree-a",
    filter: "all",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "pathSelected",
    key: "worktree-a",
    path: "vendor/ignored.log",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "directoryToggled",
    key: "worktree-a",
    path: "vendor",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "reconciled",
    key: "worktree-a",
    visiblePaths: ["vendor"],
    directoryPaths: ["vendor"],
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "filterChanged",
    key: "worktree-a",
    filter: "changed",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "reconciled",
    key: "worktree-a",
    visiblePaths: [],
    directoryPaths: ["vendor"],
  });

  expect(state.entriesByKey["worktree-a"]).toEqual({
    filter: "changed",
    selectedPath: null,
    expandedPaths: ["vendor"],
  });
});
