import { useCallback, useEffect, useMemo, useReducer } from "react";

import type { WorktreeId } from "@/features/workspace/domain/worktree";
import { projectWorktreeTree } from "@/features/workspace/lib/projectWorktreeTree";
import {
  initialWorkspaceNavigationState,
  reduceWorkspaceNavigationState,
} from "@/features/workspace/lib/reduceWorkspaceNavigationState";
import type { ViewMode } from "@/features/workspace/types/viewMode";
import type { WorkspaceNavigationState } from "@/features/workspace/types/workspaceNavigationState";
import type { WorkspaceWorktreesLoadState } from "@/features/workspace/types/workspaceWorktreesLoadState";
import type { WorktreeTreeNode } from "@/features/workspace/types/worktreeTreeNode";

export type UseWorkspaceNavigationStateResult = Readonly<{
  state: WorkspaceNavigationState;
  navigationNodes: readonly WorktreeTreeNode[];
  actions: Readonly<{
    selectWorktree: (worktreeId: WorktreeId) => void;
    changeMode: (mode: ViewMode) => void;
    selectItem: (itemId: string | null) => void;
  }>;
}>;

/**
 * Connects the pure navigation reducer to one worktree source snapshot.
 *
 * @param source - Ready worktree data or an explicit unavailable reason.
 * @returns Navigation state, projected nodes, and stable action callbacks.
 */
export function useWorkspaceNavigationState(
  source: WorkspaceWorktreesLoadState,
): UseWorkspaceNavigationStateResult {
  const [state, dispatch] = useReducer(
    reduceWorkspaceNavigationState,
    initialWorkspaceNavigationState,
    (initialState) =>
      reduceWorkspaceNavigationState(initialState, {
        type: "sourceChanged",
        source,
      }),
  );
  const readyData = source.status === "ready" ? source.data : null;
  const unavailableReason =
    source.status === "unavailable" ? source.reason : null;
  const stableSource = useMemo<WorkspaceWorktreesLoadState>(() => {
    if (readyData !== null) {
      return { status: "ready", data: readyData };
    }

    return {
      status: "unavailable",
      reason: unavailableReason ?? "data-source-not-connected",
    };
  }, [readyData, unavailableReason]);
  const navigationNodes = useMemo(
    () =>
      readyData === null ? [] : projectWorktreeTree(readyData, state.mode),
    [readyData, state.mode],
  );

  useEffect(() => {
    dispatch({ type: "sourceChanged", source: stableSource });
  }, [stableSource]);

  const selectWorktree = useCallback(
    (worktreeId: WorktreeId): void => {
      dispatch({ type: "worktreeSelected", worktreeId });
      dispatch({ type: "sourceChanged", source: stableSource });
    },
    [stableSource],
  );
  const changeMode = useCallback(
    (mode: ViewMode): void => {
      dispatch({ type: "modeChanged", mode });
      dispatch({ type: "sourceChanged", source: stableSource });
    },
    [stableSource],
  );
  const selectItem = useCallback((itemId: string | null): void => {
    dispatch({ type: "itemSelected", itemId });
  }, []);

  return {
    state,
    navigationNodes,
    actions: {
      selectWorktree,
      changeMode,
      selectItem,
    },
  };
}
