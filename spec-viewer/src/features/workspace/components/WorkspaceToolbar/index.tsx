import { FolderOpen, RefreshCw, RotateCcw, SunMoon } from "lucide-react";

import { useTheme } from "@/features/preferences";
import { ThemeMode } from "@/features/preferences/domain/theme";
import { uiText } from "@/utils/uiText";

type Props = Readonly<{
  workspacePath: string | null;
  inputValue: string;
  isLoading: boolean;
  isBrowsing: boolean;
  errorMessage: string | null;
  canRefresh: boolean;
  /** @param nextValue - 変更後のワークスペースパス入力値。 */
  onInputChange: (nextValue: string) => void;
  /** ディレクトリ選択ダイアログを開く。 */
  onBrowse: () => void;
  /** 入力欄のパスからワークスペースを読み込む。 */
  onLoad: () => void;
  /** 現在のワークスペースを再読み込みする。 */
  onRefresh: () => void;
  /** ワークスペースの状態をリセットする。 */
  onReset: () => void;
}>;

/** @returns Workspace path controls and current workspace status. */
export function WorkspaceToolbar({
  workspacePath,
  inputValue,
  isLoading,
  isBrowsing,
  errorMessage,
  canRefresh,
  onInputChange,
  onBrowse,
  onLoad,
  onRefresh,
  onReset,
}: Props) {
  const { themeMode, setThemeMode } = useTheme();
  const isBusy = isLoading || isBrowsing;

  return (
    <form
      className="workspace-toolbar"
      aria-label={uiText.workspace.controls}
      onSubmit={(event) => {
        event.preventDefault();
        onLoad();
      }}
    >
      <div className="workspace-toolbar__brand">
        <span className="workspace-toolbar__title">Spec Reviewer</span>
        <span className="workspace-toolbar__status" aria-live="polite">
          {createStatusLabel({
            workspacePath,
            isLoading,
            isBrowsing,
            errorMessage,
          })}
        </span>
      </div>
      <label className="workspace-toolbar__field" htmlFor="workspace-path">
        <span>{uiText.workspace.path}</span>
        <input
          id="workspace-path"
          value={inputValue}
          placeholder="/workspace/spec-reviewer"
          autoComplete="off"
          disabled={isBusy}
          onChange={(event) => {
            onInputChange(event.currentTarget.value);
          }}
        />
      </label>
      <div className="workspace-toolbar__actions">
        <label className="workspace-toolbar__theme" htmlFor="theme-mode">
          <SunMoon aria-hidden="true" size={16} />
          <span>{uiText.workspace.theme}</span>
          <select
            id="theme-mode"
            value={themeMode}
            aria-label={uiText.workspace.themeMode}
            onChange={(event) => {
              setThemeMode(ThemeMode.parse(event.currentTarget.value));
            }}
          >
            <option value="system">{uiText.workspace.system}</option>
            <option value="light">{uiText.workspace.light}</option>
            <option value="dark">{uiText.workspace.dark}</option>
          </select>
        </label>
        <button
          className="button button--primary workspace-toolbar__open-button"
          type="button"
          aria-label={uiText.workspace.openFolder}
          title={uiText.workspace.openFolder}
          disabled={isBusy}
          onClick={onBrowse}
        >
          <FolderOpen aria-hidden="true" size={15} />
          {isBrowsing ? uiText.workspace.opening : "開く"}
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label={uiText.workspace.refresh}
          title={uiText.workspace.refresh}
          disabled={!canRefresh || isBusy}
          onClick={onRefresh}
        >
          <RefreshCw aria-hidden="true" size={15} />
        </button>
        <button
          className="button button--ghost"
          type="button"
          disabled={isBusy && workspacePath === null}
          onClick={onReset}
        >
          <RotateCcw aria-hidden="true" size={15} />
          {uiText.workspace.reset}
        </button>
      </div>
    </form>
  );
}

/** @returns Human-readable workspace status for toolbar assistive text. */
function createStatusLabel({
  workspacePath,
  isLoading,
  isBrowsing,
  errorMessage,
}: Readonly<{
  workspacePath: string | null;
  isLoading: boolean;
  isBrowsing: boolean;
  errorMessage: string | null;
}>): string {
  if (isBrowsing) {
    return uiText.workspace.openingPicker;
  }

  if (isLoading) {
    return uiText.workspace.loadingWorkspace;
  }

  if (errorMessage !== null) {
    return errorMessage;
  }

  if (workspacePath !== null) {
    return workspacePath;
  }

  return uiText.workspace.noWorkspace;
}
