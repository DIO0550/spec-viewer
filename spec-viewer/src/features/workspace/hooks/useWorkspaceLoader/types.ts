import type { RecentWorkspacesClock } from "@/features/workspace/application/ports/recentWorkspacesClock";
import type { RecentWorkspacesRepository } from "@/features/workspace/application/ports/recentWorkspacesRepository";
import type { WorkspaceContextValue } from "@/features/workspace/context/types";
import type { WorkspacePath } from "@/features/workspace/domain/workspacePath";
import type { UseRecentWorkspacesResult } from "@/features/workspace/hooks/useRecentWorkspaces";
import type { SubscribeWorkspaceDragDropEvents } from "@/features/workspace/hooks/useWorkspaceDrop";
import type {
  selectWorkspaceDirectory as defaultSelectWorkspaceDirectory,
  validateWorkspaceDirectory as defaultValidateWorkspaceDirectory,
} from "@/shared/api/tauri";

/** Browser/Tauri commands adapted by the hook boundary. */
export type WorkspaceLoaderCommands = Readonly<{
  /** Opens the native directory picker. */
  selectWorkspaceDirectory: typeof defaultSelectWorkspaceDirectory;
  /** Supplies the application validation port. */
  validateWorkspaceDirectory: typeof defaultValidateWorkspaceDirectory;
}>;

export type UseWorkspaceLoaderOptions = Readonly<{
  /**
   * 共有エラースロット（App の useState）の setState をそのまま。null でクリア。
   * @param message - 表示するエラーメッセージ。null でクリア。
   */
  onError: (message: string | null) => void;
  /** テスト用 DI（デフォルト実装付き）。 */
  commands?: WorkspaceLoaderCommands;
  /** useWorkspaceDrop へのパススルー DI。 */
  subscribeDragDropEvents?: SubscribeWorkspaceDragDropEvents;
  /**
   * @internal テスト専用 override — プロダクションコードで渡してはならない。
   * 省略時（プロダクション）はフック内部で useWorkspace() を読む。
   */
  workspace?: WorkspaceContextValue;
  /** Recent-workspaces persistence port supplied by app composition. */
  recentWorkspacesRepository: RecentWorkspacesRepository;
  /** Clock used when recording a successfully opened workspace. */
  recentWorkspacesClock: RecentWorkspacesClock;
}>;

export type UseWorkspaceLoaderResult = Readonly<{
  state: Readonly<{
    activeWorkspaceRoot: WorkspacePath | null;
    isWorkspaceOpening: boolean;
    isBrowsingWorkspace: boolean;
    workspaceInput: string;
    dropErrorMessage: string | null;
    workspaceErrorMessage: string | null;
    isDraggingWorkspace: boolean;
  }>;
  actions: Readonly<{
    /** @param value - ワークスペースパス入力欄の新しい値。 */
    setWorkspaceInput: (value: string) => void;
    /** ネイティブのディレクトリ選択ダイアログを開いてワークスペースを読み込む。 */
    browseWorkspace: () => Promise<void>;
    /** 入力欄のパスからワークスペースを読み込む。 */
    loadWorkspace: () => void;
    /** @param path - 開く最近使用したワークスペースのパス。 */
    openRecentWorkspacePath: (path: WorkspacePath) => Promise<void>;
    /** 現在のワークスペースと入力・エラー状態をリセットする。 */
    resetWorkspace: () => void;
  }>;
  /**
   * recent 一覧 UI 向けの読み出し面。loader が所有する単一インスタンスを再露出する。
   */
  recentWorkspaces: Pick<
    UseRecentWorkspacesResult,
    "recentWorkspaces" | "removeWorkspace"
  >;
}>;
