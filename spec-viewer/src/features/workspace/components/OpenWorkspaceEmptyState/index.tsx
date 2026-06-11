import { FolderClock, FolderOpen, X } from "lucide-react";

import type { RecentWorkspace } from "@/shared/lib/recentWorkspaces";
import { uiText } from "@/shared/lib/uiText";
import { EmptyState } from "@/shared/ui/EmptyState";

type Props = Readonly<{
  isOpening: boolean;
  recentWorkspaces?: readonly RecentWorkspace[];
  /** Opens the native workspace picker. */
  onOpenWorkspace: () => void;
  /** @param path - Recent workspace path to reopen */
  onOpenRecentWorkspace?: (path: string) => void;
  /** @param path - Recent workspace path to remove from the list */
  onRemoveRecentWorkspace?: (path: string) => void;
}>;

/** @returns An initial empty state that opens the native workspace picker. */
export function OpenWorkspaceEmptyState({
  isOpening,
  recentWorkspaces = [],
  onOpenWorkspace,
  onOpenRecentWorkspace,
  onRemoveRecentWorkspace,
}: Props) {
  return (
    <section
      id="markdown-viewer-panel"
      className="markdown-viewer markdown-viewer--center"
      role="tabpanel"
      tabIndex={-1}
    >
      <EmptyState
        title={uiText.workspace.openTitle}
        description={uiText.workspace.openDescription}
        action={
          <div className="open-workspace-actions">
            <button
              className="button button--primary"
              type="button"
              disabled={isOpening}
              onClick={onOpenWorkspace}
            >
              <FolderOpen aria-hidden="true" size={16} />
              {isOpening
                ? uiText.workspace.opening
                : uiText.workspace.openTitle}
            </button>
            {recentWorkspaces.length > 0 ? (
              <section
                className="open-workspace-actions__recent"
                aria-label={uiText.workspace.recent}
              >
                <span className="open-workspace-actions__recent-title">
                  <FolderClock aria-hidden="true" size={15} />
                  {uiText.workspace.recentShort}
                </span>
                <div className="open-workspace-actions__recent-list">
                  {recentWorkspaces.map((recentWorkspace) => (
                    <div
                      className="open-workspace-actions__recent-row"
                      key={recentWorkspace.path}
                    >
                      <button
                        className="open-workspace-actions__recent-item"
                        type="button"
                        disabled={isOpening}
                        title={recentWorkspace.path}
                        aria-label={`${recentWorkspace.displayName}を開く`}
                        onClick={() => {
                          onOpenRecentWorkspace?.(recentWorkspace.path);
                        }}
                      >
                        <span className="workspace-toolbar__recent-name">
                          {recentWorkspace.displayName}
                        </span>
                        <span className="workspace-toolbar__recent-path">
                          {recentWorkspace.path}
                        </span>
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        disabled={isOpening}
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
              </section>
            ) : null}
          </div>
        }
      />
    </section>
  );
}
