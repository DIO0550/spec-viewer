import { ChevronDown, ChevronRight, Folder, FolderOpen, X } from "lucide-react";
import { useId } from "react";

import { WorkspacePath } from "@/features/workspace/domain/workspacePath";
import type { RecentWorkspace } from "@/features/workspace/infrastructure/recentWorkspaces";
import { uiText } from "@/shared/lib/uiText";

type Props = Readonly<{
  currentWorkspacePath: string | null;
  isOpen: boolean;
  isBusy: boolean;
  recentWorkspaces: readonly RecentWorkspace[];
  /** ディレクトリ選択ダイアログを開く。 */
  onBrowse: () => void;
  /** ワークスペース切替セクションの開閉を切り替える。 */
  onToggleOpen: () => void;
  /** @param path - 開く最近使用したワークスペースのパス。 */
  onOpenWorkspace: (path: WorkspacePath) => void;
  /** @param path - 一覧から削除する最近使用したワークスペースのパス。 */
  onRemoveWorkspace: (path: WorkspacePath) => void;
}>;

/** @returns Workspace switching controls for the left navigation sidebar. */
export function WorkspaceSidebarSection({
  currentWorkspacePath,
  isOpen,
  isBusy,
  recentWorkspaces,
  onBrowse,
  onToggleOpen,
  onOpenWorkspace,
  onRemoveWorkspace,
}: Props) {
  const contentId = useId();
  const hasRecentWorkspaces = recentWorkspaces.length > 0;
  const toggleLabel = isOpen
    ? uiText.workspace.collapseSwitcher
    : uiText.workspace.expandSwitcher;

  return (
    <section
      className="workspace-sidebar-section"
      aria-label={uiText.workspace.sidebarList}
      data-state={isOpen ? "open" : "collapsed"}
    >
      <div className="workspace-sidebar-section__header">
        <div className="workspace-sidebar-section__title">
          <button
            className="icon-button workspace-sidebar-section__toggle"
            type="button"
            aria-label={toggleLabel}
            aria-expanded={isOpen}
            aria-controls={contentId}
            title={toggleLabel}
            onClick={onToggleOpen}
          >
            {isOpen ? (
              <ChevronDown aria-hidden="true" size={16} />
            ) : (
              <ChevronRight aria-hidden="true" size={16} />
            )}
          </button>
          <h2>{uiText.workspace.switcher}</h2>
        </div>
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
        <Folder aria-hidden="true" size={14} />
        <span>
          <span>{uiText.workspace.currentWorkspace}</span>
          <strong title={currentWorkspacePath ?? uiText.workspace.noWorkspace}>
            {currentWorkspacePath ?? uiText.workspace.noWorkspace}
          </strong>
        </span>
      </div>
      {isOpen ? (
        <div id={contentId} className="workspace-sidebar-section__content">
          {hasRecentWorkspaces ? (
            <ul
              className="workspace-sidebar-section__list"
              aria-label={uiText.workspace.recent}
            >
              {recentWorkspaces.map((recentWorkspace) => (
                <li
                  className="workspace-sidebar-section__row"
                  key={recentWorkspace.path}
                >
                  <button
                    className="workspace-sidebar-section__item"
                    type="button"
                    disabled={isBusy}
                    title={recentWorkspace.path}
                    aria-current={
                      isCurrentWorkspace(
                        recentWorkspace.path,
                        currentWorkspacePath,
                      )
                        ? "location"
                        : undefined
                    }
                    aria-label={`${recentWorkspace.displayName}を開く`}
                    onClick={() => {
                      onOpenWorkspace(recentWorkspace.path);
                    }}
                  >
                    <span className="workspace-sidebar-section__name">
                      <Folder aria-hidden="true" size={14} />
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
                </li>
              ))}
            </ul>
          ) : (
            <p className="workspace-sidebar-section__empty">
              {uiText.workspace.noRecent}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** @returns Whether a recent workspace matches the current UI path. */
function isCurrentWorkspace(
  recentWorkspacePath: WorkspacePath,
  currentWorkspacePath: string | null,
): boolean {
  if (currentWorkspacePath === null) {
    return false;
  }

  const parsedCurrentPath = WorkspacePath.parse(currentWorkspacePath);

  return (
    parsedCurrentPath.ok &&
    WorkspacePath.equals(recentWorkspacePath, parsedCurrentPath.path)
  );
}
