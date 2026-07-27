import { createNavigationHistoryKey } from "./createNavigationHistoryKey";
import type { WorkspaceNavigationAction } from "@/features/workspace/types/workspaceNavigationAction";
import type { WorkspaceNavigationState } from "@/features/workspace/types/workspaceNavigationState";

export const initialWorkspaceNavigationState: WorkspaceNavigationState = {
  workspaceId: null,
  activeWorktreeId: null,
  mode: "specs",
  selectedItemId: null,
  selectedItemIdBySelectionKey: {},
};

/**
 * Reduces session-local workspace navigation without mutating prior state.
 *
 * @param state - Current navigation state.
 * @param action - Navigation event.
 * @returns The next immutable state.
 */
export function reduceWorkspaceNavigationState(
  state: WorkspaceNavigationState,
  action: WorkspaceNavigationAction,
): WorkspaceNavigationState {
  switch (action.type) {
    case "sourceChanged":
      return reduceSourceChanged(state, action.source);
    case "worktreeSelected":
      return activateWorktree(state, action.worktreeId);
    case "modeChanged":
      return activateMode(state, action.mode);
    case "itemSelected":
      return selectItem(state, action.itemId);
  }
}

function reduceSourceChanged(
  state: WorkspaceNavigationState,
  source: Extract<
    WorkspaceNavigationAction,
    { type: "sourceChanged" }
  >["source"],
): WorkspaceNavigationState {
  if (source.status === "unavailable") {
    return {
      ...state,
      workspaceId: null,
      activeWorktreeId: null,
      selectedItemId: null,
    };
  }

  const workspaceId = source.data.workspaceId;
  const hasCurrentWorktree = source.data.worktrees.some(
    (worktree) =>
      workspaceId === state.workspaceId &&
      worktree.id === state.activeWorktreeId,
  );
  const activeWorktreeId = hasCurrentWorktree
    ? state.activeWorktreeId
    : (source.data.worktrees[0]?.id ?? null);
  const activeWorktree = source.data.worktrees.find(
    (worktree) => worktree.id === activeWorktreeId,
  );
  const key =
    activeWorktreeId === null
      ? null
      : createNavigationHistoryKey(workspaceId, activeWorktreeId, state.mode);
  const preferredItemId =
    key === null ? null : (state.selectedItemIdBySelectionKey[key] ?? null);
  const availableItemIds =
    activeWorktree === undefined
      ? []
      : state.mode === "specs"
        ? activeWorktree.specs
            .filter((spec) => !spec.isArchived)
            .map((spec) => spec.id)
        : activeWorktree.changedFiles.map((file) => file.id);
  const selectedItemId =
    preferredItemId !== null && availableItemIds.includes(preferredItemId)
      ? preferredItemId
      : (availableItemIds[0] ?? null);

  return {
    ...state,
    workspaceId,
    activeWorktreeId,
    selectedItemId,
    selectedItemIdBySelectionKey:
      key === null
        ? state.selectedItemIdBySelectionKey
        : {
            ...state.selectedItemIdBySelectionKey,
            [key]: selectedItemId,
          },
  };
}

function activateWorktree(
  state: WorkspaceNavigationState,
  worktreeId: string,
): WorkspaceNavigationState {
  if (state.workspaceId === null) {
    return state;
  }

  return {
    ...state,
    activeWorktreeId: worktreeId,
    selectedItemId:
      state.selectedItemIdBySelectionKey[
        createNavigationHistoryKey(state.workspaceId, worktreeId, state.mode)
      ] ?? null,
  };
}

function activateMode(
  state: WorkspaceNavigationState,
  mode: WorkspaceNavigationState["mode"],
): WorkspaceNavigationState {
  if (state.workspaceId === null || state.activeWorktreeId === null) {
    return { ...state, mode, selectedItemId: null };
  }

  return {
    ...state,
    mode,
    selectedItemId:
      state.selectedItemIdBySelectionKey[
        createNavigationHistoryKey(
          state.workspaceId,
          state.activeWorktreeId,
          mode,
        )
      ] ?? null,
  };
}

function selectItem(
  state: WorkspaceNavigationState,
  itemId: string | null,
): WorkspaceNavigationState {
  if (state.workspaceId === null || state.activeWorktreeId === null) {
    return { ...state, selectedItemId: itemId };
  }

  const key = createNavigationHistoryKey(
    state.workspaceId,
    state.activeWorktreeId,
    state.mode,
  );

  return {
    ...state,
    selectedItemId: itemId,
    selectedItemIdBySelectionKey: {
      ...state.selectedItemIdBySelectionKey,
      [key]: itemId,
    },
  };
}
