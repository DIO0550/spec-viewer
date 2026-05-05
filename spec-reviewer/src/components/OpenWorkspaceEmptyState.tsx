import { FolderClock, FolderOpen, X } from "lucide-react";

import type { RecentWorkspace } from "../lib/recentWorkspaces";
import { EmptyState } from "./EmptyState";

type Props = Readonly<{
  isOpening: boolean;
  recentWorkspaces?: readonly RecentWorkspace[];
  onOpenWorkspace: () => void;
  onOpenRecentWorkspace?: (path: string) => void;
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
        title="Open a workspace"
        description="Choose or drop a supported spec workspace folder to read Markdown files."
        action={
          <div className="open-workspace-actions">
            <button
              className="button button--primary"
              type="button"
              disabled={isOpening}
              onClick={onOpenWorkspace}
            >
              <FolderOpen aria-hidden="true" size={16} />
              {isOpening ? "Opening" : "Open workspace"}
            </button>
            {recentWorkspaces.length > 0 ? (
              <div
                className="open-workspace-actions__recent"
                aria-label="Recent workspaces"
              >
                <span className="open-workspace-actions__recent-title">
                  <FolderClock aria-hidden="true" size={15} />
                  Recent
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
                        onClick={() => {
                          onOpenRecentWorkspace?.(recentWorkspace.path);
                        }}
                      >
                        {recentWorkspace.path}
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        disabled={isOpening}
                        aria-label={`Remove ${recentWorkspace.path} from recent workspaces`}
                        title="Remove from recent workspaces"
                        onClick={() => {
                          onRemoveRecentWorkspace?.(recentWorkspace.path);
                        }}
                      >
                        <X aria-hidden="true" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        }
      />
    </section>
  );
}
