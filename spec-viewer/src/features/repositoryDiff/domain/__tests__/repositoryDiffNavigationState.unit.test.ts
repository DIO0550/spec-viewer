import { expect, test } from "vitest";

import {
  createInitialRepositoryDiffNavigationEntry,
  createInitialRepositoryDiffNavigationState,
  type RepositoryDiffNavigationState,
  reduceRepositoryDiffNavigationState,
} from "@/features/repositoryDiff/domain/repositoryDiffNavigationState";
import {
  NavigationHistory,
  NavigationHistoryKey,
} from "@/features/workspace/domain/navigationHistory";

const worktreeAKey = NavigationHistoryKey.create({
  workspaceId: "/workspace",
  worktreeId: "worktree-a",
  mode: "diff",
});
const worktreeBKey = NavigationHistoryKey.create({
  workspaceId: "/workspace",
  worktreeId: "worktree-b",
  mode: "diff",
});

test("repository navigation keyはbaseとsnapshotに依存しない", () => {
  const beforeRefresh = {
    workspaceId: "/workspace",
    worktreeId: "worktree-a",
    baseIdentifier: "main@before",
    snapshotId: "snapshot-before",
  };
  const afterRefresh = {
    ...beforeRefresh,
    baseIdentifier: "main@after",
    snapshotId: "snapshot-after",
  };

  const beforeKey = NavigationHistoryKey.create({
    workspaceId: beforeRefresh.workspaceId,
    worktreeId: beforeRefresh.worktreeId,
    mode: "diff",
  });
  const afterKey = NavigationHistoryKey.create({
    workspaceId: afterRefresh.workspaceId,
    worktreeId: afterRefresh.worktreeId,
    mode: "diff",
  });

  expect(afterKey).toBe(beforeKey);
  expect(afterKey).toBe('["/workspace","worktree-a","diff"]');
});

test("未訪問repositoryはChanged・tabなし・Unifiedで始まる", () => {
  expect(createInitialRepositoryDiffNavigationEntry()).toEqual({
    filter: "changed",
    openPaths: [],
    activePath: null,
    expandedPaths: [],
    viewerMode: "unified",
    jumpTargetsByPath: {},
  });
});

test("openは順序を保って重複せず既存tabをactiveにする", () => {
  const state = openPaths(["src/a.ts", "src/b.ts", "src/a.ts"]);

  expect(
    NavigationHistory.get(state.entriesByKey, worktreeAKey)?.openPaths,
  ).toEqual(["src/a.ts", "src/b.ts"]);
  expect(
    NavigationHistory.get(state.entriesByKey, worktreeAKey)?.activePath,
  ).toBe("src/a.ts");
});

test("activateはopen中のpathだけをactiveにする", () => {
  let state = openPaths(["a.ts", "b.ts"]);
  state = reduceRepositoryDiffNavigationState(state, {
    type: "tabActivated",
    key: worktreeAKey,
    path: "a.ts",
  });
  const unchanged = reduceRepositoryDiffNavigationState(state, {
    type: "tabActivated",
    key: worktreeAKey,
    path: "missing.ts",
  });

  expect(
    NavigationHistory.get(state.entriesByKey, worktreeAKey)?.activePath,
  ).toBe("a.ts");
  expect(unchanged).toBe(state);
});

test("inactive tabを閉じてもactiveを維持する", () => {
  let state = openPaths(["a.ts", "b.ts", "c.ts"]);
  state = reduceRepositoryDiffNavigationState(state, {
    type: "tabActivated",
    key: worktreeAKey,
    path: "b.ts",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "tabClosed",
    key: worktreeAKey,
    path: "a.ts",
  });

  expect(
    NavigationHistory.get(state.entriesByKey, worktreeAKey)?.activePath,
  ).toBe("b.ts");
  expect(
    NavigationHistory.get(state.entriesByKey, worktreeAKey)?.openPaths,
  ).toEqual(["b.ts", "c.ts"]);
});

test.each([
  [["a.ts", "b.ts", "c.ts"], "b.ts", "c.ts"],
  [["a.ts", "b.ts", "c.ts"], "c.ts", "b.ts"],
  [["a.ts"], "a.ts", null],
] as const)("active closeは右、左、nullの順でfallbackする", (paths, closed, expected) => {
  const state = reduceRepositoryDiffNavigationState(openPaths(paths), {
    type: "tabClosed",
    key: worktreeAKey,
    path: closed,
  });

  expect(
    NavigationHistory.get(state.entriesByKey, worktreeAKey)?.activePath,
  ).toBe(expected);
});

test("[R199-VIEW-004] viewer modeとpath別jump targetをworktreeごとに復元する", () => {
  let state = openPaths(["a.ts"]);
  state = reduceRepositoryDiffNavigationState(state, {
    type: "viewerModeChanged",
    key: worktreeAKey,
    mode: "editor",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "jumpTargetChanged",
    key: worktreeAKey,
    path: "a.ts",
    changeId: "hunk-1",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "pathOpened",
    key: worktreeBKey,
    path: "b.ts",
  });

  expect(
    NavigationHistory.get(state.entriesByKey, worktreeAKey)?.viewerMode,
  ).toBe("editor");
  expect(
    NavigationHistory.get(state.entriesByKey, worktreeAKey)?.jumpTargetsByPath,
  ).toEqual({
    "a.ts": "hunk-1",
  });
  expect(
    NavigationHistory.get(state.entriesByKey, worktreeBKey)?.viewerMode,
  ).toBe("unified");
  expect(
    NavigationHistory.get(state.entriesByKey, worktreeBKey)?.jumpTargetsByPath,
  ).toEqual({});
});

test("null jumpは保存値をclearしclosed pathのjumpもpruneする", () => {
  let state = openPaths(["a.ts"]);
  state = reduceRepositoryDiffNavigationState(state, {
    type: "jumpTargetChanged",
    key: worktreeAKey,
    path: "a.ts",
    changeId: "hunk-1",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "jumpTargetChanged",
    key: worktreeAKey,
    path: "a.ts",
    changeId: null,
  });

  expect(
    NavigationHistory.get(state.entriesByKey, worktreeAKey)?.jumpTargetsByPath,
  ).toEqual({});
});

test("reconcileはrepository全体のvalid fileだけを残してfallbackする", () => {
  let state = openPaths(["a.ts", "b.ts", "c.ts"]);
  state = reduceRepositoryDiffNavigationState(state, {
    type: "jumpTargetChanged",
    key: worktreeAKey,
    path: "b.ts",
    changeId: "hunk-b",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "directoryToggled",
    key: worktreeAKey,
    path: "vendor",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "reconciled",
    key: worktreeAKey,
    validFilePaths: ["a.ts", "c.ts"],
    directoryPaths: ["vendor"],
  });

  expect(
    NavigationHistory.get(state.entriesByKey, worktreeAKey)?.openPaths,
  ).toEqual(["a.ts", "c.ts"]);
  expect(
    NavigationHistory.get(state.entriesByKey, worktreeAKey)?.activePath,
  ).toBe("c.ts");
  expect(
    NavigationHistory.get(state.entriesByKey, worktreeAKey)?.jumpTargetsByPath,
  ).toEqual({});
  expect(
    NavigationHistory.get(state.entriesByKey, worktreeAKey)?.expandedPaths,
  ).toEqual(["vendor"]);
});

test("[R199-TREE-003] filter切替はopen tabsをpruneしない", () => {
  const opened = openPaths(["vendor/ignored.log"]);
  const state = reduceRepositoryDiffNavigationState(opened, {
    type: "filterChanged",
    key: worktreeAKey,
    filter: "all",
  });

  expect(NavigationHistory.get(state.entriesByKey, worktreeAKey)?.filter).toBe(
    "all",
  );
  expect(
    NavigationHistory.get(state.entriesByKey, worktreeAKey)?.openPaths,
  ).toEqual(["vendor/ignored.log"]);
});

test("不正pathと未open path操作は参照同一のno-opになる", () => {
  const initial = createInitialRepositoryDiffNavigationState();
  const invalid = reduceRepositoryDiffNavigationState(initial, {
    type: "pathOpened",
    key: worktreeAKey,
    path: "../outside",
  });
  const opened = openPaths(["a.ts"]);
  const missing = reduceRepositoryDiffNavigationState(opened, {
    type: "tabClosed",
    key: worktreeAKey,
    path: "missing.ts",
  });

  expect(invalid).toBe(initial);
  expect(missing).toBe(opened);
});

test("同値actionと同値reconcileはimmutable identityを維持する", () => {
  const opened = openPaths(["a.ts"]);
  const duplicate = reduceRepositoryDiffNavigationState(opened, {
    type: "pathOpened",
    key: worktreeAKey,
    path: "a.ts",
  });
  const reconciled = reduceRepositoryDiffNavigationState(opened, {
    type: "reconciled",
    key: worktreeAKey,
    validFilePaths: ["a.ts"],
    directoryPaths: [],
  });

  expect(duplicate).toBe(opened);
  expect(reconciled).toBe(opened);
});

function openPaths(paths: readonly string[]): RepositoryDiffNavigationState {
  return paths.reduce(
    (state, path) =>
      reduceRepositoryDiffNavigationState(state, {
        type: "pathOpened",
        key: worktreeAKey,
        path,
      }),
    createInitialRepositoryDiffNavigationState(),
  );
}

test("directoryは同じpathの再操作で展開を解除する", () => {
  const initial = createInitialRepositoryDiffNavigationState();
  const expanded = reduceRepositoryDiffNavigationState(initial, {
    type: "directoryToggled",
    key: worktreeAKey,
    path: "src",
  });
  const collapsed = reduceRepositoryDiffNavigationState(expanded, {
    type: "directoryToggled",
    key: worktreeAKey,
    path: "src",
  });
  expect(
    NavigationHistory.get(expanded.entriesByKey, worktreeAKey)?.expandedPaths,
  ).toEqual(["src"]);
  expect(
    NavigationHistory.get(collapsed.entriesByKey, worktreeAKey)?.expandedPaths,
  ).toEqual([]);
});
