import { useEffect, useState } from "react";

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
): WorkspaceWorktreesLoadState {
  const [requestState, setRequestState] =
    useState<WorkspaceWorktreesRequestState>(initialRequestState);

  useEffect(() => {
    if (workspacePath === null) {
      setRequestState({
        workspacePath: null,
        source: unavailableState,
      });
      return;
    }

    let isCurrent = true;
    setRequestState({
      workspacePath,
      source: unavailableState,
    });

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
  }, [workspacePath]);

  if (requestState.workspacePath !== workspacePath) {
    return unavailableState;
  }

  return requestState.source;
}
