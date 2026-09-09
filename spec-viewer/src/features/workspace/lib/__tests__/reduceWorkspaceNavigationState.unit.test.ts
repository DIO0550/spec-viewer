import { expect, test } from "vitest";

import {
  NavigationHistory,
  NavigationHistoryKey,
  type NavigationHistoryKeyInput,
} from "@/features/workspace/domain/navigationHistory";
import type { WorkspaceNavigationAction } from "@/features/workspace/types/workspaceNavigationAction";
import type { WorkspaceWorktrees } from "@/features/workspace/domain/worktree";
import {
  initialWorkspaceNavigationState,
  reduceWorkspaceNavigationState,
} from "@/features/workspace/lib/reduceWorkspaceNavigationState";

const workspaceA: WorkspaceWorktrees = {
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
};

test("modeはworkspaceとworktreeを往復してもsession-globalに維持される", () => {
  let state = reduceWorkspaceNavigationState(initialWorkspaceNavigationState, {
    type: "sourceChanged",
    source: { status: "ready", data: workspaceA },
  });
  state = reduceWorkspaceNavigationState(state, {
    type: "modeChanged",
    mode: "diff",
  });
  state = reduceWorkspaceNavigationState(state, {
    type: "worktreeSelected",
    worktreeId: "worktree-b",
  });
  state = reduceWorkspaceNavigationState(state, {
    type: "worktreeSelected",
    worktreeId: "worktree-a",
  });

  expect(state.mode).toBe("diff");
});

test("unavailableから同じworkspaceへ戻ると3-tupleの選択履歴を復元する", () => {
  let state = reduceWorkspaceNavigationState(initialWorkspaceNavigationState, {
    type: "sourceChanged",
    source: { status: "ready", data: workspaceA },
  });
  state = reduceWorkspaceNavigationState(state, {
    type: "itemSelected",
    itemId: "spec-fallback",
  });
  state = reduceWorkspaceNavigationState(state, {
    type: "sourceChanged",
    source: {
      status: "unavailable",
      reason: "data-source-not-connected",
    },
  });
  state = reduceWorkspaceNavigationState(state, {
    type: "sourceChanged",
    source: { status: "ready", data: workspaceA },
  });

  expect(state.selectedItemId).toBe("spec-fallback");
});

test("workspace identityが違う場合は別workspaceの選択履歴を復元しない", () => {
  let state = reduceWorkspaceNavigationState(initialWorkspaceNavigationState, {
    type: "sourceChanged",
    source: { status: "ready", data: workspaceA },
  });
  state = reduceWorkspaceNavigationState(state, {
    type: "itemSelected",
    itemId: "spec-fallback",
  });
  state = reduceWorkspaceNavigationState(state, {
    type: "sourceChanged",
    source: {
      status: "ready",
      data: {
        workspaceId: "workspace-b",
        worktrees: workspaceA.worktrees,
      },
    },
  });

  expect(state.selectedItemId).toBe("spec-a");
  const returned = reduceWorkspaceNavigationState(state, {
    type: "sourceChanged",
    source: { status: "ready", data: workspaceA },
  });
  expect(returned.selectedItemId).toBe("spec-fallback");
});

test("snapshot更新で選択対象が消えた場合だけ表示順の先頭へfallbackする", () => {
  let state = reduceWorkspaceNavigationState(initialWorkspaceNavigationState, {
    type: "sourceChanged",
    source: { status: "ready", data: workspaceA },
  });
  state = reduceWorkspaceNavigationState(state, {
    type: "itemSelected",
    itemId: "spec-fallback",
  });
  state = reduceWorkspaceNavigationState(state, {
    type: "sourceChanged",
    source: {
      status: "ready",
      data: {
        workspaceId: workspaceA.workspaceId,
        worktrees: [
          {
            ...workspaceA.worktrees[0]!,
            specs: [{ id: "spec-new", title: "New", isArchived: false }],
          },
        ],
      },
    },
  });

  expect(state.selectedItemId).toBe("spec-new");
});

test("worktreeとitemが全消失したsnapshotでは両方nullになる", () => {
  const readyState = reduceWorkspaceNavigationState(
    initialWorkspaceNavigationState,
    {
      type: "sourceChanged",
      source: { status: "ready", data: workspaceA },
    },
  );
  const emptyState = reduceWorkspaceNavigationState(readyState, {
    type: "sourceChanged",
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
  action: WorkspaceNavigationAction;
  mode: string;
  selected: string | null;
}[])("workspace未設定では履歴を作らない: $action.type", ({
  action,
  mode,
  selected,
}) => {
  const next = reduceWorkspaceNavigationState(
    initialWorkspaceNavigationState,
    action,
  );
  expect(next.mode).toBe(mode);
  expect(next.selectedItemId).toBe(selected);
  expect(next.selectedItemIdBySelectionKey).toBe(
    initialWorkspaceNavigationState.selectedItemIdBySelectionKey,
  );
});

test("workspace未設定でworktreeを選んでも同じstateを返す", () => {
  expect(
    reduceWorkspaceNavigationState(initialWorkspaceNavigationState, {
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
  visit: WorkspaceNavigationAction;
  away: WorkspaceNavigationAction;
  keyInput: NavigationHistoryKeyInput;
  fallback: string;
}[])("$label切替は未登録と解除済みを保持しsource更新で候補を補完する", ({
  visit,
  away,
  keyInput,
  fallback,
}) => {
  const ready = reduceWorkspaceNavigationState(
    initialWorkspaceNavigationState,
    { type: "sourceChanged", source: { status: "ready", data: workspaceA } },
  );
  const unvisited = reduceWorkspaceNavigationState(ready, visit);
  const key = NavigationHistoryKey.create(keyInput);
  expect(unvisited.selectedItemId).toBeNull();
  expect(
    NavigationHistory.get(unvisited.selectedItemIdBySelectionKey, key),
  ).toBeUndefined();
  const cleared = reduceWorkspaceNavigationState(unvisited, {
    type: "itemSelected",
    itemId: null,
  });
  const returned = reduceWorkspaceNavigationState(
    reduceWorkspaceNavigationState(cleared, away),
    visit,
  );
  expect(returned.selectedItemId).toBeNull();
  expect(
    NavigationHistory.get(returned.selectedItemIdBySelectionKey, key),
  ).toBeNull();
  const refreshed = reduceWorkspaceNavigationState(returned, {
    type: "sourceChanged",
    source: { status: "ready", data: workspaceA },
  });
  expect(refreshed.selectedItemId).toBe(fallback);
});

test("modeとworktreeの各保存選択を往復して復元する", () => {
  const actions = [
    { type: "sourceChanged", source: { status: "ready", data: workspaceA } },
    { type: "itemSelected", itemId: "spec-fallback" },
    { type: "modeChanged", mode: "diff" },
    { type: "itemSelected", itemId: "diff-a" },
    { type: "worktreeSelected", worktreeId: "worktree-b" },
    { type: "itemSelected", itemId: "diff-b" },
  ] satisfies readonly WorkspaceNavigationAction[];
  const saved = actions.reduce(
    reduceWorkspaceNavigationState,
    initialWorkspaceNavigationState,
  );
  const worktreeAState = reduceWorkspaceNavigationState(saved, {
    type: "worktreeSelected",
    worktreeId: "worktree-a",
  });
  const specs = reduceWorkspaceNavigationState(worktreeAState, {
    type: "modeChanged",
    mode: "specs",
  });
  const diff = reduceWorkspaceNavigationState(specs, {
    type: "modeChanged",
    mode: "diff",
  });
  const worktreeBState = reduceWorkspaceNavigationState(diff, {
    type: "worktreeSelected",
    worktreeId: "worktree-b",
  });
  expect(specs.selectedItemId).toBe("spec-fallback");
  expect(diff.selectedItemId).toBe("diff-a");
  expect(worktreeBState.selectedItemId).toBe("diff-b");
  expect(worktreeBState.mode).toBe("diff");
});

test("選択候補だけが空になってもworktreeを維持して選択はnullにする", () => {
  const ready = reduceWorkspaceNavigationState(
    initialWorkspaceNavigationState,
    { type: "sourceChanged", source: { status: "ready", data: workspaceA } },
  );
  const next = reduceWorkspaceNavigationState(ready, {
    type: "sourceChanged",
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
