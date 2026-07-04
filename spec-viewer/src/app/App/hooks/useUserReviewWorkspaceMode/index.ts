import { useEffect, useState } from "react";
import type { SpecViewResetKeys } from "@/app/App/hooks/types";
import type { UserReviewWorkspaceMode } from "@/features/review-runs";

export type UseUserReviewWorkspaceModeOptions = Readonly<{
  resetKeys: SpecViewResetKeys;
}>;

export type UseUserReviewWorkspaceModeResult = Readonly<{
  workspaceMode: UserReviewWorkspaceMode;
  setWorkspaceMode: (mode: UserReviewWorkspaceMode) => void;
}>;

/**
 * @param options - The reset keys that identify the current selection.
 * @returns User review workspace mode that resets to "currentWorkspace" on selection change.
 */
export function useUserReviewWorkspaceMode(
  options: UseUserReviewWorkspaceModeOptions,
): UseUserReviewWorkspaceModeResult {
  const { resetKeys } = options;
  const [workspaceMode, setWorkspaceMode] =
    useState<UserReviewWorkspaceMode>("currentWorkspace");

  useEffect(() => {
    setWorkspaceMode("currentWorkspace");
  }, [resetKeys.fileKey, resetKeys.specId, resetKeys.workspaceRoot]);

  return {
    workspaceMode,
    setWorkspaceMode,
  };
}
