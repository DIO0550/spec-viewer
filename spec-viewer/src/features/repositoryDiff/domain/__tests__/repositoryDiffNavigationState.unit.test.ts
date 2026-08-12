import { expect, test } from "vitest";

import {
  createInitialRepositoryDiffNavigationEntry,
  createInitialRepositoryDiffNavigationState,
  type RepositoryDiffNavigationState,
  reduceRepositoryDiffNavigationState,
} from "@/features/repositoryDiff/domain/repositoryDiffNavigationState";
import { createRepositoryDiffNavigationKey } from "@/features/workspace/lib/createNavigationHistoryKey";

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

  const beforeKey = createRepositoryDiffNavigationKey(
    beforeRefresh.workspaceId,
    beforeRefresh.worktreeId,
  );
  const afterKey = createRepositoryDiffNavigationKey(
    afterRefresh.workspaceId,
    afterRefresh.worktreeId,
  );

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

  expect(state.entriesByKey["worktree-a"]?.openPaths).toEqual([
    "src/a.ts",
    "src/b.ts",
  ]);
  expect(state.entriesByKey["worktree-a"]?.activePath).toBe("src/a.ts");
});

test("activateはopen中のpathだけをactiveにする", () => {
  let state = openPaths(["a.ts", "b.ts"]);
  state = reduceRepositoryDiffNavigationState(state, {
    type: "tabActivated",
    key: "worktree-a",
    path: "a.ts",
  });
  const unchanged = reduceRepositoryDiffNavigationState(state, {
    type: "tabActivated",
    key: "worktree-a",
    path: "missing.ts",
  });

  expect(state.entriesByKey["worktree-a"]?.activePath).toBe("a.ts");
  expect(unchanged).toBe(state);
});

test("inactive tabを閉じてもactiveを維持する", () => {
  let state = openPaths(["a.ts", "b.ts", "c.ts"]);
  state = reduceRepositoryDiffNavigationState(state, {
    type: "tabActivated",
    key: "worktree-a",
    path: "b.ts",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "tabClosed",
    key: "worktree-a",
    path: "a.ts",
  });

  expect(state.entriesByKey["worktree-a"]?.activePath).toBe("b.ts");
  expect(state.entriesByKey["worktree-a"]?.openPaths).toEqual(["b.ts", "c.ts"]);
});

test.each([
  [["a.ts", "b.ts", "c.ts"], "b.ts", "c.ts"],
  [["a.ts", "b.ts", "c.ts"], "c.ts", "b.ts"],
  [["a.ts"], "a.ts", null],
] as const)("active closeは右、左、nullの順でfallbackする", (paths, closed, expected) => {
  const state = reduceRepositoryDiffNavigationState(openPaths(paths), {
    type: "tabClosed",
    key: "worktree-a",
    path: closed,
  });

  expect(state.entriesByKey["worktree-a"]?.activePath).toBe(expected);
});

test("[R199-VIEW-004] viewer modeとpath別jump targetをworktreeごとに復元する", () => {
  let state = openPaths(["a.ts"]);
  state = reduceRepositoryDiffNavigationState(state, {
    type: "viewerModeChanged",
    key: "worktree-a",
    mode: "editor",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "jumpTargetChanged",
    key: "worktree-a",
    path: "a.ts",
    changeId: "hunk-1",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "pathOpened",
    key: "worktree-b",
    path: "b.ts",
  });

  expect(state.entriesByKey["worktree-a"]?.viewerMode).toBe("editor");
  expect(state.entriesByKey["worktree-a"]?.jumpTargetsByPath).toEqual({
    "a.ts": "hunk-1",
  });
  expect(state.entriesByKey["worktree-b"]?.viewerMode).toBe("unified");
  expect(state.entriesByKey["worktree-b"]?.jumpTargetsByPath).toEqual({});
});

test("null jumpは保存値をclearしclosed pathのjumpもpruneする", () => {
  let state = openPaths(["a.ts"]);
  state = reduceRepositoryDiffNavigationState(state, {
    type: "jumpTargetChanged",
    key: "worktree-a",
    path: "a.ts",
    changeId: "hunk-1",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "jumpTargetChanged",
    key: "worktree-a",
    path: "a.ts",
    changeId: null,
  });

  expect(state.entriesByKey["worktree-a"]?.jumpTargetsByPath).toEqual({});
});

test("reconcileはrepository全体のvalid fileだけを残してfallbackする", () => {
  let state = openPaths(["a.ts", "b.ts", "c.ts"]);
  state = reduceRepositoryDiffNavigationState(state, {
    type: "jumpTargetChanged",
    key: "worktree-a",
    path: "b.ts",
    changeId: "hunk-b",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "directoryToggled",
    key: "worktree-a",
    path: "vendor",
  });
  state = reduceRepositoryDiffNavigationState(state, {
    type: "reconciled",
    key: "worktree-a",
    validFilePaths: ["a.ts", "c.ts"],
    directoryPaths: ["vendor"],
  });

  expect(state.entriesByKey["worktree-a"]?.openPaths).toEqual(["a.ts", "c.ts"]);
  expect(state.entriesByKey["worktree-a"]?.activePath).toBe("c.ts");
  expect(state.entriesByKey["worktree-a"]?.jumpTargetsByPath).toEqual({});
  expect(state.entriesByKey["worktree-a"]?.expandedPaths).toEqual(["vendor"]);
});

test("[R199-TREE-003] filter切替はopen tabsをpruneしない", () => {
  const opened = openPaths(["vendor/ignored.log"]);
  const state = reduceRepositoryDiffNavigationState(opened, {
    type: "filterChanged",
    key: "worktree-a",
    filter: "all",
  });

  expect(state.entriesByKey["worktree-a"]?.filter).toBe("all");
  expect(state.entriesByKey["worktree-a"]?.openPaths).toEqual([
    "vendor/ignored.log",
  ]);
});

test("不正pathと未open path操作は参照同一のno-opになる", () => {
  const initial = createInitialRepositoryDiffNavigationState();
  const invalid = reduceRepositoryDiffNavigationState(initial, {
    type: "pathOpened",
    key: "worktree-a",
    path: "../outside",
  });
  const opened = openPaths(["a.ts"]);
  const missing = reduceRepositoryDiffNavigationState(opened, {
    type: "tabClosed",
    key: "worktree-a",
    path: "missing.ts",
  });

  expect(invalid).toBe(initial);
  expect(missing).toBe(opened);
});

test("同値actionと同値reconcileはimmutable identityを維持する", () => {
  const opened = openPaths(["a.ts"]);
  const duplicate = reduceRepositoryDiffNavigationState(opened, {
    type: "pathOpened",
    key: "worktree-a",
    path: "a.ts",
  });
  const reconciled = reduceRepositoryDiffNavigationState(opened, {
    type: "reconciled",
    key: "worktree-a",
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
        key: "worktree-a",
        path,
      }),
    createInitialRepositoryDiffNavigationState(),
  );
}
