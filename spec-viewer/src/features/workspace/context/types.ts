import type { ReactNode } from "react";

import type { WorkspaceError } from "@/features/workspace/domain/workspaceError";
import type { Workspace } from "@/features/workspace/types/workspace";

export type WorkspaceState =
  | Readonly<{
      status: "idle";
    }>
  | Readonly<{
      status: "opening";
      requestedPath: string;
      currentWorkspace: Workspace | null;
      error: null;
    }>
  | Readonly<{
      status: "opened";
      workspace: Workspace;
      lastOpenError: WorkspaceError | null;
    }>
  | Readonly<{
      status: "failed";
      requestedPath: string;
      error: WorkspaceError;
    }>;

export type LoadWorkspaceOptions = Readonly<{
  preserveCurrentWorkspace?: boolean;
  onWorkspaceLoaded?: (workspace: Workspace) => void;
}>;

export type WorkspaceActions = Readonly<{
  /**
   * 選択したディレクトリからワークスペースを読み込む。
   * @param selectedDirectory - 開くワークスペースの絶対パス。
   * @param options - 読み込み挙動のオプション（現在保持・読み込み後コールバック）。
   * @returns 読み込みに成功したかどうか。
   */
  load: (
    selectedDirectory: string,
    options?: LoadWorkspaceOptions,
  ) => Promise<boolean>;
  /** 現在のワークスペースを初期状態へ戻す。 */
  reset: () => void;
}>;

export type WorkspaceContextValue = Readonly<{
  state: WorkspaceState;
  actions: WorkspaceActions;
}>;

export type WorkspaceProviderProps = Readonly<{
  children: ReactNode;
}>;
