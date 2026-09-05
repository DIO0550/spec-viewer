import type { WorkspaceNavigationAction } from "@/features/workspace/types/workspaceNavigationAction";
import type { WorkspaceNavigationState } from "@/features/workspace/types/workspaceNavigationState";
import { createNavigationHistoryKey } from "./createNavigationHistoryKey";

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

/**
 * Reconciles navigation state with a fresh worktree data snapshot: clears
 * the active worktree/item when the source is unavailable, otherwise keeps
 * the current worktree if it still exists (falling back to the first one)
 * and restores the previously selected item for that worktree/mode when
 * still available.
 *
 * @param state - Current navigation state.
 * @param source - The `sourceChanged` action's worktree source payload.
 * @returns The reconciled navigation state.
 */
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

/**
 * Switches the active worktree and restores the item that was last
 * selected for it under the current mode, if any. No-ops when no
 * workspace is loaded yet.
 *
 * @param state - Current navigation state.
 * @param worktreeId - Id of the worktree to activate.
 * @returns The navigation state with the worktree activated, or the
 * unchanged state when no workspace is loaded.
 */
function activateWorktree(
  state: WorkspaceNavigationState,
  worktreeId: NonNullable<WorkspaceNavigationState["activeWorktreeId"]>,
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

/**
 * Switches the view mode and restores the item that was last selected for
 * the active worktree under the new mode, if any. Clears the selected item
 * when no workspace or worktree is active yet.
 *
 * @param state - Current navigation state.
 * @param mode - The mode to switch to.
 * @returns The navigation state with the mode changed.
 */
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

/**
 * Records the selected item for the current worktree/mode so it can be
 * restored on later navigation back to the same worktree and mode.
 *
 * @param state - Current navigation state.
 * @param itemId - Id of the item to select, or `null` to clear the selection.
 * @returns The navigation state with the item selected and its selection
 * history updated when a workspace and worktree are active.
 */
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
