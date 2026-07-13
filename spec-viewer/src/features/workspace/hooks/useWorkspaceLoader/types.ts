import type { WorkspaceContextValue } from "@/features/workspace/context/types";
import type {
  WorkspacePath,
  WorkspacePathParseError,
} from "@/features/workspace/domain/workspacePath";
import type { UseRecentWorkspacesResult } from "@/features/workspace/hooks/useRecentWorkspaces";
import type { SubscribeWorkspaceDragDropEvents } from "@/features/workspace/hooks/useWorkspaceDrop";
import type { RecentWorkspaceStorage } from "@/features/workspace/infrastructure/recentWorkspaces";
import type {
  selectWorkspaceDirectory as defaultSelectWorkspaceDirectory,
  validateWorkspaceDirectory as defaultValidateWorkspaceDirectory,
} from "@/shared/api/tauri";

/** IPC コマンドの DI（useComments の `commands?` 規約に合わせた1オブジェクト）。 */
export type WorkspaceLoaderCommands = Readonly<{
  /** browse アダプタ（index.ts）が使う。flow には渡さない（ダイアログはフック専有の副作用）。 */
  selectWorkspaceDirectory: typeof defaultSelectWorkspaceDirectory;
  /** index.ts が io.validate ラッパーに包んで flow へ渡す。 */
  validateWorkspaceDirectory: typeof defaultValidateWorkspaceDirectory;
}>;

/**
 * flow へ注入する IPC 2関数（flow に注入してよい副作用は IPC のみ。
 * state setter・エラー報告コールバックは渡さない）。
 * index.ts が「クリア + input 更新」（途中経過 — 観測可能な既存挙動）を各 IPC 呼び出しの
 * 直前に合成したラッパーとして組み立てる。flow は結果値だけを読む。
 */
export type WorkspaceLoaderFlowIo = Readonly<{
  /**
   * validateWorkspaceDirectory の薄いラッパー。flow は isDirectory のみ読む（構造的最小型）。
   * @param path - 検証対象のワークスペースディレクトリパス。
   */
  validate: (
    path: WorkspacePath,
  ) => Promise<Readonly<{ isDirectory: boolean }>>;
  /**
   * workspace.actions.load の薄いラッパー（`onWorkspaceLoaded: recordWorkspace` を pre-bind 済み）。
   * Provider 内 catch 済みのため reject しない。
   * @param path - 読み込むワークスペースディレクトリパス。
   * @param preserveCurrentWorkspace - 失敗時に現在のワークスペースを保持するか。
   */
  load: (
    path: WorkspacePath,
    preserveCurrentWorkspace: boolean,
  ) => Promise<boolean>;
}>;

/** 入口ガードの評価値（呼び出し時点の値を index.ts が束ねる）。 */
export type WorkspaceLoaderGuards = Readonly<{
  isWorkspaceOpening: boolean;
  isBrowsingWorkspace: boolean;
}>;

/** validate なし入口（browse 合流後 / 手入力）の共通 outcome。 */
export type WorkspaceOpenOutcome =
  | Readonly<{ type: "loaded" }>
  | Readonly<{ type: "loadFailedSilently" }>;

export type OpenWorkspaceFromInputOutcome =
  | Readonly<{ type: "emptyInput" }>
  | Readonly<{ type: "invalidInput"; error: WorkspacePathParseError }>
  | WorkspaceOpenOutcome;

export type OpenDroppedWorkspaceOutcome =
  | Readonly<{ type: "skipped" }>
  | WorkspaceOpenOutcome
  | Readonly<{ type: "notDirectory"; dropMessage: string }>
  | Readonly<{ type: "dropException"; dropMessage: string }>;

/** recent 失敗3種が共有する適用データ（フックは 一覧削除 → dialog エラー → rollback の順で適用）。 */
export type RecentWorkspaceFailure = Readonly<{
  removePath: WorkspacePath;
  dialogMessage: string;
  /** `activeWorkspaceRoot ?? ""`（null 合体は flow 内の純粋ロジック）。 */
  rollbackInput: string;
}>;

export type OpenRecentWorkspaceOutcome =
  | Readonly<{ type: "skipped" }>
  | Readonly<{ type: "loaded" }>
  | (Readonly<{ type: "recentMissing" }> & RecentWorkspaceFailure)
  | (Readonly<{ type: "recentUnsupported" }> & RecentWorkspaceFailure)
  | (Readonly<{ type: "recentException" }> & RecentWorkspaceFailure);

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
  /** テスト専用: 内部 useRecentWorkspaces({ storage }) へのパススルー DI。 */
  recentWorkspacesStorage?: RecentWorkspaceStorage | null;
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
