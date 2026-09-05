import { expect, test } from "vitest";

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
