import { FolderOpen, MonitorCog, RefreshCcw, RotateCcw } from "lucide-react";

import type { ThemeMode } from "../hooks/useTheme";

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
  themeMode: ThemeMode;
  onInputChange: (nextValue: string) => void;
  onBrowse: () => void;
  onLoad: () => void;
  onRefresh: () => void;
  onReset: () => void;
  onThemeModeChange: (nextThemeMode: ThemeMode) => void;
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
  const canLoad = inputValue.trim().length > 0 && !isBusy;
  const isRefreshing = refreshStatus.status === "loading";

  return (
    <form
      className="workspace-toolbar"
      aria-label="Workspace controls"
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
        <span>Workspace path</span>
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
          <MonitorCog aria-hidden="true" size={16} />
          <span>Theme</span>
          <select
            id="theme-mode"
            value={themeMode}
            aria-label="Theme mode"
            onChange={(event) => {
              onThemeModeChange(event.currentTarget.value as ThemeMode);
            }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <button
          className="icon-button icon-button--primary"
          type="button"
          aria-label="Open workspace folder"
          title="Open workspace folder"
          disabled={isBusy}
          onClick={onBrowse}
        >
          <FolderOpen aria-hidden="true" size={16} />
        </button>
        <button
          className="button button--secondary"
          type="submit"
          disabled={!canLoad}
        >
          <RefreshCcw aria-hidden="true" size={16} />
          {isLoading ? "Loading" : "Load"}
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label="Refresh current view"
          title="Refresh current view"
          disabled={!canRefresh || isBusy || isRefreshing}
          onClick={onRefresh}
        >
          <RefreshCcw aria-hidden="true" size={16} />
        </button>
        <button
          className="button button--ghost"
          type="button"
          disabled={isBusy && workspacePath === null}
          onClick={onReset}
        >
          <RotateCcw aria-hidden="true" size={16} />
          Reset
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
    return "Opening workspace picker";
  }

  if (isLoading) {
    return "Loading workspace";
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

  return "No workspace selected";
}
