import { expect, test } from "vitest";

import {
  NavigationHistory,
  NavigationHistoryKey,
  type NavigationHistoryKeyInput,
} from "@/features/workspace/domain/navigationHistory";
import type { NavigationAction } from "../navigationReducer";
import { WorkspaceNavigation } from "@/features/workspace/domain/workspaceNavigation";
import type { WorkspaceWorktrees } from "@/features/workspace/domain/worktree";
import { navigationReducer } from "../navigationReducer";

const initialWorkspaceNavigationState = WorkspaceNavigation.create();

const workspaceA = {
  workspaceId: "workspace-a",
  worktrees: [
    {
      id: "worktree-a",
      name: "A",
      categoryPath: [],
      specs: [
        { id: "spec-a", title: "A", isArchived: false },
        { id: "spec-fallback", title: "Fallback", isArchived: false },
      ],
      changedFiles: [{ id: "diff-a", path: "src/a.ts" }],
    },
    {
      id: "worktree-b",
      name: "B",
      categoryPath: [],
      specs: [{ id: "spec-b", title: "B", isArchived: false }],
      changedFiles: [{ id: "diff-b", path: "src/b.ts" }],
    },
  ],
} satisfies WorkspaceWorktrees;

test("modeはworkspaceとworktreeを往復してもsession-globalに維持される", () => {
  let state = navigationReducer(initialWorkspaceNavigationState, {
    type: "worktreesUpdated",
    source: { status: "ready", data: workspaceA },
  });
  state = navigationReducer(state, {
    type: "modeChanged",
    mode: "diff",
  });
  state = navigationReducer(state, {
    type: "worktreeSelected",
    worktreeId: "worktree-b",
  });
  state = navigationReducer(state, {
    type: "worktreeSelected",
    worktreeId: "worktree-a",
  });

  expect(state.mode).toBe("diff");
});

test("unavailableから同じworkspaceへ戻ると3-tupleの選択履歴を復元する", () => {
  let state = navigationReducer(initialWorkspaceNavigationState, {
    type: "worktreesUpdated",
    source: { status: "ready", data: workspaceA },
  });
  state = navigationReducer(state, {
    type: "itemSelected",
    itemId: "spec-fallback",
  });
  state = navigationReducer(state, {
    type: "worktreesUpdated",
    source: {
      status: "unavailable",
      reason: "data-source-not-connected",
    },
  });
  state = navigationReducer(state, {
    type: "worktreesUpdated",
    source: { status: "ready", data: workspaceA },
  });

  expect(state.selectedItemId).toBe("spec-fallback");
});

test("workspace identityが違う場合は別workspaceの選択履歴を復元しない", () => {
  let state = navigationReducer(initialWorkspaceNavigationState, {
    type: "worktreesUpdated",
    source: { status: "ready", data: workspaceA },
  });
  state = navigationReducer(state, {
    type: "itemSelected",
    itemId: "spec-fallback",
  });
  state = navigationReducer(state, {
    type: "worktreesUpdated",
    source: {
      status: "ready",
      data: {
        workspaceId: "workspace-b",
        worktrees: workspaceA.worktrees,
      },
    },
  });

  expect(state.selectedItemId).toBe("spec-a");
  const returned = navigationReducer(state, {
    type: "worktreesUpdated",
    source: { status: "ready", data: workspaceA },
  });
  expect(returned.selectedItemId).toBe("spec-fallback");
});

test("snapshot更新で選択対象が消えた場合だけ表示順の先頭へfallbackする", () => {
  let state = navigationReducer(initialWorkspaceNavigationState, {
    type: "worktreesUpdated",
    source: { status: "ready", data: workspaceA },
  });
  state = navigationReducer(state, {
    type: "itemSelected",
    itemId: "spec-fallback",
  });
  state = navigationReducer(state, {
    type: "worktreesUpdated",
    source: {
      status: "ready",
      data: {
        workspaceId: workspaceA.workspaceId,
        worktrees: [
          {
            ...workspaceA.worktrees[0],
            specs: [{ id: "spec-new", title: "New", isArchived: false }],
          },
        ],
      },
    },
  });

  expect(state.selectedItemId).toBe("spec-new");
});

test("worktreeとitemが全消失したsnapshotでは両方nullになる", () => {
  const readyState = navigationReducer(initialWorkspaceNavigationState, {
    type: "worktreesUpdated",
    source: { status: "ready", data: workspaceA },
  });
  const emptyState = navigationReducer(readyState, {
    type: "worktreesUpdated",
    source: {
      status: "ready",
      data: { workspaceId: workspaceA.workspaceId, worktrees: [] },
    },
  });

  expect(emptyState.activeWorktreeId).toBeNull();
  expect(emptyState.selectedItemId).toBeNull();
});

test.each([
  {
    action: { type: "worktreeSelected", worktreeId: "worktree-a" },
    mode: "specs",
    selected: null,
  },
  {
    action: { type: "modeChanged", mode: "diff" },
    mode: "diff",
    selected: null,
  },
  {
    action: { type: "itemSelected", itemId: "spec-a" },
    mode: "specs",
    selected: "spec-a",
  },
] satisfies readonly {
  action: NavigationAction;
  mode: string;
  selected: string | null;
}[])("workspace未設定では履歴を作らない: $action.type", ({
  action,
  mode,
  selected,
}) => {
  const next = navigationReducer(initialWorkspaceNavigationState, action);
  expect(next.mode).toBe(mode);
  expect(next.selectedItemId).toBe(selected);
  expect(next.selectedItemIdBySelectionKey).toBe(
    initialWorkspaceNavigationState.selectedItemIdBySelectionKey,
  );
});

test("workspace未設定でworktreeを選んでも同じstateを返す", () => {
  expect(
    navigationReducer(initialWorkspaceNavigationState, {
      type: "worktreeSelected",
      worktreeId: "worktree-a",
    }),
  ).toBe(initialWorkspaceNavigationState);
});

test.each([
  {
    label: "mode",
    visit: { type: "modeChanged", mode: "diff" },
    away: { type: "modeChanged", mode: "specs" },
    keyInput: {
      workspaceId: "workspace-a",
      worktreeId: "worktree-a",
      mode: "diff",
    },
    fallback: "diff-a",
  },
  {
    label: "worktree",
    visit: { type: "worktreeSelected", worktreeId: "worktree-b" },
    away: { type: "worktreeSelected", worktreeId: "worktree-a" },
    keyInput: {
      workspaceId: "workspace-a",
      worktreeId: "worktree-b",
      mode: "specs",
    },
    fallback: "spec-b",
  },
] satisfies readonly {
  label: string;
  visit: NavigationAction;
  away: NavigationAction;
  keyInput: NavigationHistoryKeyInput;
  fallback: string;
}[])("$label切替は未登録と解除済みを保持しsource更新で候補を補完する", ({
  visit,
  away,
  keyInput,
  fallback,
}) => {
  const ready = navigationReducer(initialWorkspaceNavigationState, {
    type: "worktreesUpdated",
    source: { status: "ready", data: workspaceA },
  });
  const unvisited = navigationReducer(ready, visit);
  const key = NavigationHistoryKey.create(keyInput);
  expect(unvisited.selectedItemId).toBeNull();
  expect(
    NavigationHistory.get(unvisited.selectedItemIdBySelectionKey, key),
  ).toBeUndefined();
  const cleared = navigationReducer(unvisited, {
    type: "itemSelected",
    itemId: null,
  });
  const returned = navigationReducer(navigationReducer(cleared, away), visit);
  expect(returned.selectedItemId).toBeNull();
  expect(
    NavigationHistory.get(returned.selectedItemIdBySelectionKey, key),
  ).toBeNull();
  const refreshed = navigationReducer(returned, {
    type: "worktreesUpdated",
    source: { status: "ready", data: workspaceA },
  });
  expect(refreshed.selectedItemId).toBe(fallback);
});

test("modeとworktreeの各保存選択を往復して復元する", () => {
  const actions = [
    { type: "worktreesUpdated", source: { status: "ready", data: workspaceA } },
    { type: "itemSelected", itemId: "spec-fallback" },
    { type: "modeChanged", mode: "diff" },
    { type: "itemSelected", itemId: "diff-a" },
    { type: "worktreeSelected", worktreeId: "worktree-b" },
    { type: "itemSelected", itemId: "diff-b" },
  ] satisfies readonly NavigationAction[];
  const saved = actions.reduce(
    navigationReducer,
    initialWorkspaceNavigationState,
  );
  const worktreeAState = navigationReducer(saved, {
    type: "worktreeSelected",
    worktreeId: "worktree-a",
  });
  const specs = navigationReducer(worktreeAState, {
    type: "modeChanged",
    mode: "specs",
  });
  const diff = navigationReducer(specs, {
    type: "modeChanged",
    mode: "diff",
  });
  const worktreeBState = navigationReducer(diff, {
    type: "worktreeSelected",
    worktreeId: "worktree-b",
  });
  expect(specs.selectedItemId).toBe("spec-fallback");
  expect(diff.selectedItemId).toBe("diff-a");
  expect(worktreeBState.selectedItemId).toBe("diff-b");
  expect(worktreeBState.mode).toBe("diff");
});

test("選択候補だけが空になってもworktreeを維持して選択はnullにする", () => {
  const ready = navigationReducer(initialWorkspaceNavigationState, {
    type: "worktreesUpdated",
    source: { status: "ready", data: workspaceA },
  });
  const next = navigationReducer(ready, {
    type: "worktreesUpdated",
    source: {
      status: "ready",
      data: {
        ...workspaceA,
        worktrees: workspaceA.worktrees.map((worktree) => ({
          ...worktree,
          specs: [],
          changedFiles: [],
        })),
      },
    },
  });
  expect(next.activeWorktreeId).toBe("worktree-a");
  expect(next.selectedItemId).toBeNull();
});

test.each([
  {
    action: { type: "modeChanged", mode: "diff" },
    mode: "diff",
    selected: null,
  },
  {
    action: { type: "itemSelected", itemId: "spec-a" },
    mode: "specs",
    selected: "spec-a",
  },
] satisfies readonly {
  action: NavigationAction;
  mode: string;
  selected: string | null;
}[])("worktree未設定では履歴を作らない: $action.type", ({
  action,
  mode,
  selected,
}) => {
  const state = { ...WorkspaceNavigation.create(), workspaceId: "workspace-a" };
  const next = navigationReducer(state, action);

  expect(next.mode).toBe(mode);
  expect(next.selectedItemId).toBe(selected);
  expect(next.selectedItemIdBySelectionKey).toBe(
    state.selectedItemIdBySelectionKey,
  );
});

test("archiveされた選択を除外し、worktree消失時は残ったworktreeへ移る", () => {
  const ready = navigationReducer(WorkspaceNavigation.create(), {
    type: "worktreesUpdated",
    source: { status: "ready", data: workspaceA },
  });
  const archived = navigationReducer(ready, {
    type: "worktreesUpdated",
    source: {
      status: "ready",
      data: {
        ...workspaceA,
        worktrees: [
          {
            ...workspaceA.worktrees[0],
            specs: [
              { id: "spec-a", title: "Archived", isArchived: true },
              { id: "spec-live", title: "Live", isArchived: false },
            ],
          },
          workspaceA.worktrees[1],
        ],
      },
    },
  });
  expect(archived.activeWorktreeId).toBe("worktree-a");
  expect(archived.selectedItemId).toBe("spec-live");

  const removed = navigationReducer(archived, {
    type: "worktreesUpdated",
    source: {
      status: "ready",
      data: { ...workspaceA, worktrees: [workspaceA.worktrees[1]] },
    },
  });
  expect(removed.activeWorktreeId).toBe("worktree-b");
  expect(removed.selectedItemId).toBe("spec-b");
});

test.each([
  { type: "worktreeSelected", worktreeId: "worktree-b" },
  { type: "modeChanged", mode: "diff" },
  { type: "itemSelected", itemId: "spec-fallback" },
  { type: "itemSelected", itemId: null },
  {
    type: "worktreesUpdated",
    source: {
      status: "ready",
      data: {
        ...workspaceA,
        worktrees: [
          {
            ...workspaceA.worktrees[0],
            specs: [{ id: "spec-new", title: "New", isArchived: false }],
          },
          workspaceA.worktrees[1],
        ],
      },
    },
  },
] satisfies readonly NavigationAction[])("$type後も過去の状態と別worktreeの履歴を変更しない", (action) => {
  const otherKey = NavigationHistoryKey.create({
    workspaceId: "workspace-a",
    worktreeId: "worktree-b",
    mode: "specs",
  });
  const ready = navigationReducer(WorkspaceNavigation.create(), {
    type: "worktreesUpdated",
    source: { status: "ready", data: workspaceA },
  });
  const state = {
    ...ready,
    selectedItemIdBySelectionKey: NavigationHistory.set(
      ready.selectedItemIdBySelectionKey,
      otherKey,
      "spec-b",
    ),
  };
  const before = structuredClone(state);
  const next = navigationReducer(state, action);

  expect(state).toEqual(before);
  expect(
    NavigationHistory.get(next.selectedItemIdBySelectionKey, otherKey),
  ).toBe("spec-b");
});
