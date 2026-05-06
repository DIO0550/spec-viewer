import {
  FolderClock,
  FolderOpen,
  MonitorCog,
  RefreshCcw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";

import type { ThemeMode } from "../hooks/useTheme";
import type { RecentWorkspace } from "../lib/recentWorkspaces";
import { uiText } from "../lib/uiText";

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
  recentWorkspaces?: readonly RecentWorkspace[];
  onInputChange: (nextValue: string) => void;
  onBrowse: () => void;
  onLoad: () => void;
  onRefresh: () => void;
  onReset: () => void;
  onThemeModeChange: (nextThemeMode: ThemeMode) => void;
  onOpenRecentWorkspace?: (path: string) => void;
  onRemoveRecentWorkspace?: (path: string) => void;
  onClearRecentWorkspaces?: () => void;
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
  recentWorkspaces = [],
  onInputChange,
  onBrowse,
  onLoad,
  onRefresh,
  onReset,
  onThemeModeChange,
  onOpenRecentWorkspace,
  onRemoveRecentWorkspace,
  onClearRecentWorkspaces,
}: Props) {
  const isBusy = isLoading || isBrowsing;
  const canLoad = inputValue.trim().length > 0 && !isBusy;
  const isRefreshing = refreshStatus.status === "loading";
  const hasRecentWorkspaces = recentWorkspaces.length > 0;
  const recentSummaryRef = useRef<HTMLElement>(null);
  const [isRecentMenuOpen, setIsRecentMenuOpen] = useState(false);

  const closeRecentMenu = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== "Escape" || !isRecentMenuOpen) {
      return;
    }

    event.preventDefault();
    setIsRecentMenuOpen(false);
    recentSummaryRef.current?.focus();
  };

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
          <MonitorCog aria-hidden="true" size={16} />
          <span>{uiText.workspace.theme}</span>
          <select
            id="theme-mode"
            value={themeMode}
            aria-label={uiText.workspace.themeMode}
            onChange={(event) => {
              onThemeModeChange(event.currentTarget.value as ThemeMode);
            }}
          >
            <option value="system">{uiText.workspace.system}</option>
            <option value="light">{uiText.workspace.light}</option>
            <option value="dark">{uiText.workspace.dark}</option>
          </select>
        </label>
        <button
          className="icon-button icon-button--primary"
          type="button"
          aria-label={uiText.workspace.openFolder}
          title={uiText.workspace.openFolder}
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
          {isLoading ? uiText.workspace.loading : uiText.workspace.load}
        </button>
        <details
          className="workspace-toolbar__recent"
          open={isRecentMenuOpen}
          onToggle={(event) => {
            setIsRecentMenuOpen(event.currentTarget.open);
          }}
          onKeyDown={closeRecentMenu}
        >
          <summary
            ref={recentSummaryRef}
            aria-label={uiText.workspace.switcher}
            title={uiText.workspace.recent}
            aria-disabled={!hasRecentWorkspaces}
            aria-keyshortcuts="Escape"
          >
            <FolderClock aria-hidden="true" size={16} />
            <span>{uiText.workspace.switcher}</span>
          </summary>
          <div className="workspace-toolbar__recent-menu">
            {hasRecentWorkspaces ? (
              <>
                <div
                  className="workspace-toolbar__recent-list"
                  aria-label={uiText.workspace.recent}
                >
                  {recentWorkspaces.map((recentWorkspace) => (
                    <div
                      className="workspace-toolbar__recent-row"
                      key={recentWorkspace.path}
                    >
                      <button
                        className="workspace-toolbar__recent-item"
                        type="button"
                        disabled={isBusy}
                        title={recentWorkspace.path}
                        aria-label={`${recentWorkspace.displayName}を開く`}
                        onClick={() => {
                          onOpenRecentWorkspace?.(recentWorkspace.path);
                        }}
                      >
                        <span className="workspace-toolbar__recent-name">
                          {recentWorkspace.displayName}
                          {recentWorkspace.path === workspacePath ? (
                            <span className="workspace-toolbar__current-badge">
                              {uiText.workspace.currentWorkspace}
                            </span>
                          ) : null}
                        </span>
                        <span className="workspace-toolbar__recent-path">
                          {recentWorkspace.path}
                        </span>
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        disabled={isBusy}
                        aria-label={`${recentWorkspace.path}を${uiText.workspace.removeRecent}`}
                        title={uiText.workspace.removeRecent}
                        onClick={() => {
                          onRemoveRecentWorkspace?.(recentWorkspace.path);
                        }}
                      >
                        <X aria-hidden="true" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="button button--ghost workspace-toolbar__recent-clear"
                  type="button"
                  disabled={isBusy}
                  onClick={onClearRecentWorkspaces}
                >
                  <Trash2 aria-hidden="true" size={14} />
                  {uiText.workspace.clearRecent}
                </button>
              </>
            ) : (
              <span className="workspace-toolbar__recent-empty">
                {uiText.workspace.noRecent}
              </span>
            )}
          </div>
        </details>
        <button
          className="icon-button"
          type="button"
          aria-label={uiText.workspace.refresh}
          title={uiText.workspace.refresh}
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
