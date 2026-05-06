import { FolderClock, FolderOpen, X } from "lucide-react";

import type { RecentWorkspace } from "../lib/recentWorkspaces";
import { uiText } from "../lib/uiText";

type Props = Readonly<{
  currentWorkspacePath: string | null;
  isBusy: boolean;
  recentWorkspaces: readonly RecentWorkspace[];
  onBrowse: () => void;
  onOpenWorkspace: (path: string) => void;
  onRemoveWorkspace: (path: string) => void;
}>;

/** @returns Workspace switching controls for the left navigation sidebar. */
export function WorkspaceSidebarSection({
  currentWorkspacePath,
  isBusy,
  recentWorkspaces,
  onBrowse,
  onOpenWorkspace,
  onRemoveWorkspace,
}: Props) {
  const hasRecentWorkspaces = recentWorkspaces.length > 0;

  return (
    <section
      className="workspace-sidebar-section"
      aria-label={uiText.workspace.sidebarList}
    >
      <div className="workspace-sidebar-section__header">
        <h2>{uiText.workspace.switcher}</h2>
        <button
          className="icon-button"
          type="button"
          aria-label={uiText.workspace.openFolder}
          title={uiText.workspace.openFolder}
          disabled={isBusy}
          onClick={onBrowse}
        >
          <FolderOpen aria-hidden="true" size={16} />
        </button>
      </div>
      <div className="workspace-sidebar-section__current">
        <span>{uiText.workspace.currentWorkspace}</span>
        <strong title={currentWorkspacePath ?? uiText.workspace.noWorkspace}>
          {currentWorkspacePath ?? uiText.workspace.noWorkspace}
        </strong>
      </div>
      {hasRecentWorkspaces ? (
        <div
          className="workspace-sidebar-section__list"
          aria-label={uiText.workspace.recent}
        >
          {recentWorkspaces.map((recentWorkspace) => (
            <div
              className="workspace-sidebar-section__row"
              key={recentWorkspace.path}
            >
              <button
                className="workspace-sidebar-section__item"
                type="button"
                disabled={isBusy}
                title={recentWorkspace.path}
                aria-current={
                  recentWorkspace.path === currentWorkspacePath
                    ? "location"
                    : undefined
                }
                aria-label={`${recentWorkspace.displayName}を開く`}
                onClick={() => {
                  onOpenWorkspace(recentWorkspace.path);
                }}
              >
                <span className="workspace-sidebar-section__name">
                  <FolderClock aria-hidden="true" size={14} />
                  {recentWorkspace.displayName}
                </span>
                <span className="workspace-sidebar-section__path">
                  {recentWorkspace.path}
                </span>
              </button>
              <button
                className="icon-button workspace-sidebar-section__remove"
                type="button"
                disabled={isBusy}
                aria-label={`${recentWorkspace.path}を${uiText.workspace.removeRecent}`}
                title={uiText.workspace.removeRecent}
                onClick={() => {
                  onRemoveWorkspace(recentWorkspace.path);
                }}
              >
                <X aria-hidden="true" size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="workspace-sidebar-section__empty">
          {uiText.workspace.noRecent}
        </p>
      )}
    </section>
  );
}
