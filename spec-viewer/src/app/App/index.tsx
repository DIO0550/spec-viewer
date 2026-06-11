import { useCallback, useMemo } from "react";

import "../App.css";
import { CommentReviewPane } from "@/app/App/components/CommentReviewPane";
import { DocumentViewerPane } from "@/app/App/components/DocumentViewerPane";
import { useCurrentViewRefresh } from "@/app/App/hooks/useCurrentViewRefresh";
import { useComments } from "@/features/comments";
import { CommentScope } from "@/features/comments/domain/commentScope";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import { useCommentActions } from "@/features/comments/hooks/useCommentActions";
import { useCommentExport } from "@/features/comments/hooks/useCommentExport";
import { useCommentSelection } from "@/features/comments/hooks/useCommentSelection";
import type { CommentId } from "@/features/comments/types/comment";
import {
  useKeyboardShortcuts,
  useLeftNavigationPreference,
  useResizableLeftNavigation,
  useResizableSidebar,
  useSidebarPreference,
  useTheme,
} from "@/features/preferences";
import { useUserReviews } from "@/features/review-runs";
import { useUserReviewPanelState } from "@/features/review-runs/hooks/useUserReviewPanelState";
import { SpecTabs, SpecTree, useSpecs } from "@/features/specs";
import {
  SpecFileNavigation,
  type SpecFileNavigationDirection,
} from "@/features/specs/domain/specFileNavigation";
import { useDocumentReadable } from "@/features/specs/hooks/useDocumentReadable";
import {
  useRecentWorkspaces,
  useWorkspace,
  useWorkspaceSidebarSectionPreference,
  WorkspaceDropOverlay,
  WorkspaceSidebarSection,
  WorkspaceToolbar,
} from "@/features/workspace";
import { useWorkspaceSession } from "@/features/workspace/hooks/useWorkspaceSession";
import { uiText } from "@/shared/lib/uiText";
import { AppShell } from "@/shared/ui";

const VIEW_RESET_KEY_SEPARATOR = "\u0000";

/** @returns The Spec Reviewer application root composing all feature surfaces. */
function App() {
  const workspace = useWorkspace();
  const recentWorkspaces = useRecentWorkspaces();
  const theme = useTheme();
  const leftNavigationPreference = useLeftNavigationPreference();
  const workspaceSidebarSectionPreference =
    useWorkspaceSidebarSectionPreference();
  const resizableLeftNavigation = useResizableLeftNavigation();
  const sidebarPreference = useSidebarPreference();
  const resizableSidebar = useResizableSidebar();
  const session = useWorkspaceSession({ workspace, recentWorkspaces });
  const workspaceRoot = workspace.workspace?.root ?? null;
  const specs = useSpecs({ workspacePath: workspaceRoot });
  const documentReadable = useDocumentReadable({
    documentState: specs.documentState,
  });
  const isDocumentReadable = documentReadable.isDocumentReadable;
  const isHtmlDocument =
    specs.documentState.status === "ready" &&
    specs.documentState.document.format === "html";
  const viewResetKey = [
    workspaceRoot ?? "",
    specs.selectedSpecId ?? "",
    specs.selectedFileKey ?? "",
  ].join(VIEW_RESET_KEY_SEPARATOR);
  const commentScope = useMemo(
    () =>
      CommentScope.create({
        workspacePath: workspaceRoot,
        specId: specs.selectedSpecId,
        fileKey:
          isHtmlDocument || !isDocumentReadable ? null : specs.selectedFileKey,
      }),
    [
      isDocumentReadable,
      isHtmlDocument,
      specs.selectedFileKey,
      specs.selectedSpecId,
      workspaceRoot,
    ],
  );
  const comments = useComments({
    scope: commentScope,
    statusFilter: CommentStatusFilter.All,
    correlationId: specs.documentState.correlationId ?? null,
  });
  const commentSelection = useCommentSelection({
    comments: comments.comments,
    listState: comments.listState,
    resetKey: viewResetKey,
  });
  const commentActions = useCommentActions({
    comments,
    onCommentAdded: commentSelection.activateComment,
    onDeleteRequested: commentSelection.clearIfActive,
  });
  const commentExport = useCommentExport({
    workspacePath: workspaceRoot,
    specId: specs.selectedSpecId,
    fileKey: specs.selectedFileKey,
    comments: comments.comments,
    resetKey: viewResetKey,
  });
  const userReviewPanelState = useUserReviewPanelState({
    resetKey: viewResetKey,
  });
  const userReviews = useUserReviews({
    workspacePath: workspaceRoot,
    specId: isDocumentReadable ? specs.selectedSpecId : null,
    fileKey: isDocumentReadable ? specs.selectedFileKey : null,
    targetScope: userReviewPanelState.targetScope,
    correlationId: specs.documentState.correlationId ?? null,
  });
  const reloadSpecsPreservingSelection = useCallback(
    (): Promise<boolean> => specs.reloadSpecs({ preserveSelection: true }),
    [specs.reloadSpecs],
  );
  const refresh = useCurrentViewRefresh({
    workspacePath: workspaceRoot,
    specId: specs.selectedSpecId,
    fileKey: specs.selectedFileKey,
    reloadDocument: specs.reloadDocument,
    reloadSpecs: reloadSpecsPreservingSelection,
    reloadComments: comments.reloadComments,
    onRefreshStarted: session.clearDialogError,
  });

  const selectComment = useCallback(
    (commentId: CommentId): void => {
      commentSelection.activateComment(commentId);
      sidebarPreference.openSidebar();
    },
    [commentSelection.activateComment, sidebarPreference.openSidebar],
  );

  /** Clears the loaded workspace together with the highlighted comment. */
  const resetWorkspace = (): void => {
    commentSelection.clearActiveComment();
    session.resetWorkspace();
  };

  /** @param direction - Wrap-around direction over the selected spec files */
  const selectAdjacentFile = (direction: SpecFileNavigationDirection): void => {
    const nextFileKey = SpecFileNavigation.adjacentFileKey({
      files: specs.selectedSpec?.files ?? [],
      selectedFileKey: specs.selectedFileKey,
      direction,
    });

    if (nextFileKey === null) {
      return;
    }

    void specs.selectFileKey(nextFileKey);
  };

  useKeyboardShortcuts({
    isEnabled: true,
    /** Selects the next file tab in the current spec. */
    onNextFile: () => {
      selectAdjacentFile("next");
    },
    /** Selects the previous file tab in the current spec. */
    onPreviousFile: () => {
      selectAdjacentFile("previous");
    },
    /** Highlights the next comment in the sidebar list. */
    onNextComment: () => {
      commentSelection.selectAdjacentComment("next");
    },
    /** Highlights the previous comment in the sidebar list. */
    onPreviousComment: () => {
      commentSelection.selectAdjacentComment("previous");
    },
  });

  const shouldShowOpenWorkspacePrompt =
    workspace.workspace === null && !workspace.isLoading;
  const isCommentScopeReady =
    workspaceRoot !== null &&
    specs.selectedSpecId !== null &&
    specs.selectedFileKey !== null &&
    isDocumentReadable;
  const leftNavigationSubtitle =
    workspace.workspacePath ?? uiText.workspace.noWorkspace;

  return (
    <div className="app-drop-root">
      <AppShell
        isLeftNavigationOpen={leftNavigationPreference.isLeftNavigationOpen}
        onOpenLeftNavigation={leftNavigationPreference.openLeftNavigation}
        onCloseLeftNavigation={leftNavigationPreference.closeLeftNavigation}
        leftNavigationWidth={resizableLeftNavigation.leftNavigationWidth}
        leftNavigationMinWidth={resizableLeftNavigation.minLeftNavigationWidth}
        leftNavigationMaxWidth={resizableLeftNavigation.maxLeftNavigationWidth}
        onLeftNavigationWidthChange={
          resizableLeftNavigation.resizeLeftNavigationTo
        }
        isCommentsSidebarOpen={sidebarPreference.isSidebarOpen}
        onOpenCommentsSidebar={sidebarPreference.openSidebar}
        onCloseCommentsSidebar={sidebarPreference.closeSidebar}
        commentsSidebarWidth={resizableSidebar.sidebarWidth}
        commentsSidebarMinWidth={resizableSidebar.minSidebarWidth}
        commentsSidebarMaxWidth={resizableSidebar.maxSidebarWidth}
        onCommentsSidebarWidthChange={resizableSidebar.resizeSidebarTo}
        leftNavigationHeader={
          <div className="left-navigation-brand">
            <span className="left-navigation-brand__mark" aria-hidden="true">
              S
            </span>
            <span className="left-navigation-brand__copy">
              <strong>Spec Reviewer</strong>
              <span title={leftNavigationSubtitle}>
                {leftNavigationSubtitle}
              </span>
            </span>
          </div>
        }
        toolbar={
          <WorkspaceToolbar
            workspacePath={workspace.workspacePath}
            inputValue={session.workspaceInput}
            isLoading={workspace.isLoading}
            isBrowsing={session.isBrowsing}
            errorMessage={session.toolbarErrorMessage}
            refreshStatus={refresh.refreshStatus}
            canRefresh={refresh.canRefresh}
            themeMode={theme.themeMode}
            onInputChange={session.changeWorkspaceInput}
            onBrowse={() => {
              void session.browseWorkspace();
            }}
            onLoad={session.loadWorkspaceFromInput}
            onRefresh={() => {
              void refresh.refreshCurrentView();
            }}
            onReset={resetWorkspace}
            onThemeModeChange={theme.setThemeMode}
          />
        }
        sidebar={
          <div className="left-navigation-panel">
            <WorkspaceSidebarSection
              currentWorkspacePath={workspace.workspacePath}
              isOpen={
                workspaceSidebarSectionPreference.isWorkspaceSidebarSectionOpen
              }
              isBusy={workspace.isLoading || session.isBrowsing}
              recentWorkspaces={recentWorkspaces.recentWorkspaces}
              onBrowse={() => {
                void session.browseWorkspace();
              }}
              onToggleOpen={
                workspaceSidebarSectionPreference.toggleWorkspaceSidebarSection
              }
              onOpenWorkspace={(path) => {
                void session.openRecentWorkspace(path);
              }}
              onRemoveWorkspace={recentWorkspaces.removeWorkspace}
            />
            <SpecTree
              state={specs.specTreeState}
              selectedSpecId={specs.selectedSpecId}
              archivingSpecId={specs.archivingSpecId}
              onSelectSpec={(specId) => {
                void specs.selectSpec(specId);
              }}
              onArchiveSpec={(specId) => {
                void specs.archiveSpec(specId);
              }}
              onReload={() => {
                void specs.reloadSpecs({ preserveSelection: true });
              }}
            />
          </div>
        }
        tabs={
          <SpecTabs
            spec={specs.selectedSpec}
            selectedFileKey={specs.selectedFileKey}
            onSelectFile={(fileKey) => {
              void specs.selectFileKey(fileKey);
            }}
          />
        }
        viewer={
          <DocumentViewerPane
            showOpenWorkspacePrompt={shouldShowOpenWorkspacePrompt}
            isBrowsing={session.isBrowsing}
            recentWorkspaces={recentWorkspaces}
            specs={specs}
            comments={comments}
            selection={commentSelection}
            actions={commentActions}
            isCommentScopeReady={isCommentScopeReady}
            onOpenWorkspace={() => {
              void session.browseWorkspace();
            }}
            onOpenRecentWorkspace={(path) => {
              void session.openRecentWorkspace(path);
            }}
            onSelectComment={selectComment}
            onFirstReadable={documentReadable.markCurrentDocumentReadable}
          />
        }
        comments={
          <CommentReviewPane
            comments={comments}
            selection={commentSelection}
            actions={commentActions}
            commentExport={commentExport}
            userReviews={userReviews}
            panelState={userReviewPanelState}
            onSelectComment={selectComment}
          />
        }
      />
      <WorkspaceDropOverlay isVisible={session.isDropTargetActive} />
    </div>
  );
}

export default App;
