import { useCallback, useEffect, useState } from "react";

import type { WorkspaceWorktrees } from "@/features/workspace/domain/worktree";
import { listWorktrees } from "@/lib/api/tauri";

import type { WorkspaceWorktreesLoadState } from "../../types/workspaceWorktreesLoadState";

const unavailableState: WorkspaceWorktreesLoadState = {
  status: "unavailable",
  reason: "data-source-not-connected",
};

type WorkspaceWorktreesRequestState = Readonly<{
  workspacePath: string | null;
  source: WorkspaceWorktreesLoadState;
}>;

export type UseWorkspaceWorktreesResult = Readonly<{
  state: WorkspaceWorktreesLoadState;
  refresh: () => void;
}>;

const initialRequestState: WorkspaceWorktreesRequestState = {
  workspacePath: null,
  source: unavailableState,
};

/**
 * Loads Git worktrees for the active workspace and ignores stale responses.
 *
 * @param workspacePath - Active workspace root, or null when no workspace is open.
 * @returns The current worktree source snapshot for navigation.
 */
export function useWorkspaceWorktrees(
  workspacePath: string | null,
): UseWorkspaceWorktreesResult {
  const [requestState, setRequestState] =
    useState<WorkspaceWorktreesRequestState>(initialRequestState);
  const [requestVersion, setRequestVersion] = useState(0);
  const refresh = useCallback((): void => {
    setRequestVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    if (workspacePath === null) {
      setRequestState({
        workspacePath: null,
        source: unavailableState,
      });
      return;
    }

    let isCurrent = true;
    setRequestState((current) =>
      current.workspacePath === workspacePath
        ? current
        : { workspacePath, source: unavailableState },
    );

    void listWorktrees(workspacePath).then(
      (data: WorkspaceWorktrees) => {
        if (!isCurrent) {
          return;
        }

        setRequestState({
          workspacePath,
          source: { status: "ready", data },
        });
      },
      () => {
        if (!isCurrent) {
          return;
        }

        setRequestState({
          workspacePath,
          source: unavailableState,
        });
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [requestVersion, workspacePath]);

  const state =
    requestState.workspacePath === workspacePath
      ? requestState.source
      : unavailableState;

  return { state, refresh };
}
