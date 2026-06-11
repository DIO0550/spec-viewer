import { useEffect, useState } from "react";

import type { UserReviewTargetScope } from "@/features/review-runs/domain/userReviewTarget";
import type { UserReviewWorkspaceMode } from "@/features/review-runs/types/userReviewIpc";

const defaultTargetScope: UserReviewTargetScope = "file";
const defaultWorkspaceMode: UserReviewWorkspaceMode = "currentWorkspace";

type UseUserReviewPanelStateOptions = Readonly<{
  resetKey: string;
}>;

export type UseUserReviewPanelStateResult = Readonly<{
  targetScope: UserReviewTargetScope;
  workspaceMode: UserReviewWorkspaceMode;
  /** @param scope - User review target scope selected in the panel */
  changeTargetScope: (scope: UserReviewTargetScope) => void;
  /** @param mode - Workspace mode selected in the panel */
  changeWorkspaceMode: (mode: UserReviewWorkspaceMode) => void;
}>;

/**
 * Holds the user review panel selections for the current spec file view.
 *
 * @param options - Reset key identifying the current spec file view
 * @returns Panel selections and their change operations.
 */
export function useUserReviewPanelState({
  resetKey,
}: UseUserReviewPanelStateOptions): UseUserReviewPanelStateResult {
  const [targetScope, setTargetScope] =
    useState<UserReviewTargetScope>(defaultTargetScope);
  const [workspaceMode, setWorkspaceMode] =
    useState<UserReviewWorkspaceMode>(defaultWorkspaceMode);

  // biome-ignore lint/correctness/useExhaustiveDependencies(resetKey): 表示ビューの切り替え（resetKey変更）を契機にパネル選択を初期化するための意図的な依存
  useEffect(() => {
    setTargetScope(defaultTargetScope);
    setWorkspaceMode(defaultWorkspaceMode);
  }, [resetKey]);

  return {
    targetScope,
    workspaceMode,
    changeTargetScope: setTargetScope,
    changeWorkspaceMode: setWorkspaceMode,
  };
}
