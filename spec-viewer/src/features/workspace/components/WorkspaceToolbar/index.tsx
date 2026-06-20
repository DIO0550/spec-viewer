import { FolderOpen, RefreshCw, RotateCcw, SunMoon } from "lucide-react";

import {
  ThemeMode,
  type ThemeMode as ThemeModeType,
} from "@/features/preferences/domain/theme";
import { uiText } from "@/shared/lib/uiText";

export type WorkspaceRefreshStatus = Readonly<{
  status: "idle" | "loading" | "stale" | "error";
  message: string | null;
}>;

type Props = Readonly<{
  workspacePath: string | null;
  inputValue: string;
  isLoading: boolean;
  isBrowsing: boolean;
  errorMessage: string | null;
  refreshStatus: WorkspaceRefreshStatus;
  canRefresh: boolean;
  themeMode: ThemeModeType;
  onInputChange: (nextValue: string) => void;
  onBrowse: () => void;
  onLoad: () => void;
  onRefresh: () => void;
  onReset: () => void;
  onThemeModeChange: (nextThemeMode: ThemeModeType) => void;
}>;

/** @returns Workspace path controls and current workspace status. */
export function WorkspaceToolbar({
  workspacePath,
  inputValue,
  isLoading,
  isBrowsing,
  errorMessage,
  refreshStatus,
  canRefresh,
  themeMode,
  onInputChange,
  onBrowse,
  onLoad,
  onRefresh,
  onReset,
  onThemeModeChange,
}: Props) {
  const isBusy = isLoading || isBrowsing;
  const isRefreshing = refreshStatus.status === "loading";

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
        <span
          className="workspace-toolbar__status"
          aria-live="polite"
          data-refresh-status={refreshStatus.status}
        >
          {createStatusLabel({
            workspacePath,
            isLoading,
            isBrowsing,
            errorMessage,
            refreshStatus,
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
              onThemeModeChange(ThemeMode.parse(event.currentTarget.value));
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
          disabled={!canRefresh || isBusy || isRefreshing}
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
  refreshStatus,
}: Readonly<{
  workspacePath: string | null;
  isLoading: boolean;
  isBrowsing: boolean;
  errorMessage: string | null;
  refreshStatus: WorkspaceRefreshStatus;
}>): string {
  if (isBrowsing) {
    return uiText.workspace.openingPicker;
  }

  if (isLoading) {
    return uiText.workspace.loadingWorkspace;
  }

  if (refreshStatus.status !== "idle" && refreshStatus.message !== null) {
    return refreshStatus.message;
  }

  if (errorMessage !== null) {
    return errorMessage;
  }

  if (workspacePath !== null) {
    return workspacePath;
  }

  return uiText.workspace.noWorkspace;
}
