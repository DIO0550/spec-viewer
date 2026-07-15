import {
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import "../App.css";
import type { SpecViewResetKeys } from "@/app/App/hooks/types";
import { useCommentSelection } from "@/app/App/hooks/useCommentSelection";
import { useGuardedSpecActions } from "@/app/App/hooks/useGuardedSpecActions";
import { useSpecViewKeyboardNavigation } from "@/app/App/hooks/useSpecViewKeyboardNavigation";
import { useViewRefresh } from "@/app/App/hooks/useViewRefresh";
import { SpecViewCommentSidebar } from "@/app/App/SpecViewCommentSidebar";
import { useDocumentReadiness } from "@/app/App/useDocumentReadiness";
import {
  SpecViewSelectionProvider,
  useSpecViewSelection,
} from "@/app/context/specViewSelection";
import {
  CommentOperationFailedState,
  CommentOperationSavingState,
  CommentScope,
  CommentStatusFilter,
  useComments,
} from "@/features/comments";
import {
  ThemeProvider,
  useLeftNavigationPreference,
  useResizableLeftNavigation,
} from "@/features/preferences";
import {
  SidebarLayout,
  SidebarPreferenceProvider,
  useSidebarPreference,
} from "@/features/sidebar";
import {
  createSpecGateway,
  MarkdownViewer,
  specCommands,
  type SpecSelectionChange,
  SpecTabs,
  SpecTree,
  useSpecs,
} from "@/features/specs";
import {
  OpenWorkspaceEmptyState,
  useWorkspaceLoader,
  useWorkspaceSidebarSectionPreference,
  WorkspaceDropOverlay,
  WorkspaceProvider,
  WorkspaceSidebarSection,
  WorkspaceToolbar,
} from "@/features/workspace";
import { uiText } from "@/shared/lib/uiText";
import { WorkspaceLayout } from "@/shared/ui";

const unavailableSpecNodeCapabilities = {
  reviewable: false,
  archiveable: false,
} as const;
const tauriSpecGateway = createSpecGateway(specCommands);

/**
 * Application root that wires the theme, workspace and selection providers.
 *
 * @returns The root application element.
 */
function App(): ReactElement {
  return (
    <ThemeProvider>
      <WorkspaceProvider>
        <SidebarPreferenceProvider>
          <SpecViewSelectionProvider>
            <SpecViewAppContent />
          </SpecViewSelectionProvider>
        </SidebarPreferenceProvider>
      </WorkspaceProvider>
    </ThemeProvider>
  );
}

/**
 * Main spec view content that composes workspace, spec and comment state.
 *
 * @returns The spec viewer content element.
 */
function SpecViewAppContent(): ReactElement {
  // 共有エラースロット: フック化せず素の useState。setState は参照安定なのでそのまま渡せる。
  const [dialogErrorMessage, setDialogErrorMessage] = useState<string | null>(
    null,
  );
  // workspace を開く知識は feature に集約済み — App は onError を渡して呼ぶだけ。
  const workspaceLoader = useWorkspaceLoader({
    onError: setDialogErrorMessage,
  });
  const { activeWorkspaceRoot, isWorkspaceOpening } = workspaceLoader.state;

  const leftNavigationPreference = useLeftNavigationPreference();
  const workspaceSidebarSectionPreference =
    useWorkspaceSidebarSectionPreference();
  const resizableLeftNavigation = useResizableLeftNavigation();
  const sidebarPreference = useSidebarPreference();
  const { selection: specViewSelection, synchronizeSelection } =
    useSpecViewSelection();
  const selectCurrentSpecView = useCallback(
    (selection: SpecSelectionChange): void => {
      synchronizeSelection({
        workspacePath: selection.workspacePath,
        specId: selection.specId,
        fileKey: selection.fileKey,
      });
    },
    [synchronizeSelection],
  );
  const specs = useSpecs({
    gateway: tauriSpecGateway,
    workspacePath: activeWorkspaceRoot,
    onSelectionChange: selectCurrentSpecView,
  });
  const specState = specs.state;
  const specActions = specs.actions;
  const specSelectors = specs.selectors;
  const isCurrentViewLoading = specSelectors.isLoading;
  const documentReadiness = useDocumentReadiness(
    specState.documentState,
    specSelectors.selectedSpec?.capabilities ?? unavailableSpecNodeCapabilities,
  );
  const commentScope = useMemo(() => {
    if (
      !documentReadiness.isDocumentReadable ||
      !documentReadiness.isDocumentCommentable
    ) {
      return null;
    }

    return CommentScope.fromSelection(specViewSelection);
  }, [
    documentReadiness.isDocumentCommentable,
    documentReadiness.isDocumentReadable,
    specViewSelection.fileKey,
    specViewSelection.specId,
    specViewSelection.targetScope,
    specViewSelection.workspacePath,
  ]);
  const comments = useComments({
    scope: commentScope,
    statusFilter: CommentStatusFilter.All,
    correlationId: specState.documentState.correlationId ?? null,
  });

  const resetKeys: SpecViewResetKeys = {
    workspaceRoot: activeWorkspaceRoot,
    specId: specState.selection.specId,
    fileKey: specState.selection.fileKey,
  };

  const commentSelection = useCommentSelection({
    comments: comments.comments,
    listState: comments.listState,
    commentActions: comments,
    openSidebar: sidebarPreference.openSidebar,
    resetKeys,
  });

  const guardedSpecActions = useGuardedSpecActions({
    isCurrentViewLoading,
    selectSpec: specActions.selectSpec,
    archiveSpec: specActions.archiveSpec,
    reloadSpecs: specActions.reloadSpecs,
    selectFileKey: specActions.selectFileKey,
    reloadDocument: specActions.reloadDocument,
  });

  const viewRefresh = useViewRefresh({
    selection: specViewSelection,
    isCurrentViewLoading,
    reload: {
      document: specActions.reloadDocument,
      specs: specActions.reloadSpecs,
      comments: comments.reloadComments,
    },
    onError: setDialogErrorMessage,
  });

  useSpecViewKeyboardNavigation({
    isCurrentViewLoading,
    selectedSpec: specSelectors.selectedSpec,
    selectedFileKey: resetKeys.fileKey,
    selectFileKey: specActions.selectFileKey,
    selectAdjacentComment: commentSelection.selectAdjacentComment,
  });

  // dialogErrorMessage の選択変更クリア（既存 effect(1) の該当分。deps は同一3値）。
  useEffect(() => {
    setDialogErrorMessage(null);
  }, [resetKeys.fileKey, resetKeys.specId, resetKeys.workspaceRoot]);

  // resetWorkspace のドメイン横断副作用を明示的な合成で維持する。
  /** Clears the active comment and resets the workspace. */
  const resetWorkspace = (): void => {
    commentSelection.clearActiveComment();
    workspaceLoader.actions.resetWorkspace();
  };

  const toolbarErrorMessage =
    workspaceLoader.state.dropErrorMessage ??
    dialogErrorMessage ??
    workspaceLoader.state.workspaceErrorMessage ??
    null;
  const shouldShowOpenWorkspacePrompt =
    activeWorkspaceRoot === null && !isWorkspaceOpening;
  const addCommentErrorMessage =
    CommentOperationFailedState.errorFor(comments.operationState, "add")
      ?.message ?? null;
  const isAddingComment = CommentOperationSavingState.matchesOperation(
    comments.operationState,
    "add",
  );
  const isUpdatingComment = CommentOperationSavingState.matchesOperation(
    comments.operationState,
    "update",
  );
  const isCommentScopeReady = commentScope !== null;
  const canRefresh =
    activeWorkspaceRoot !== null && specSelectors.canReloadDocument;
  const leftNavigationSubtitle =
    activeWorkspaceRoot ?? uiText.workspace.noWorkspace;

  return (
    <div className="app-drop-root">
      <SidebarLayout
        leftNavigation={{
          isOpen: leftNavigationPreference.isLeftNavigationOpen,
          width: resizableLeftNavigation.leftNavigationWidth,
          minWidth: resizableLeftNavigation.minLeftNavigationWidth,
          maxWidth: resizableLeftNavigation.maxLeftNavigationWidth,
          onOpen: leftNavigationPreference.openLeftNavigation,
          onClose: leftNavigationPreference.closeLeftNavigation,
          onWidthChange: resizableLeftNavigation.resizeLeftNavigationTo,
        }}
      >
        <WorkspaceLayout.LeftNavigation
          header={
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
        >
          <div className="left-navigation-panel">
            <WorkspaceSidebarSection
              currentWorkspacePath={activeWorkspaceRoot}
              isOpen={
                workspaceSidebarSectionPreference.isWorkspaceSidebarSectionOpen
              }
              isBusy={
                isWorkspaceOpening || workspaceLoader.state.isBrowsingWorkspace
              }
              recentWorkspaces={
                workspaceLoader.recentWorkspaces.recentWorkspaces
              }
              onBrowse={() => {
                void workspaceLoader.actions.browseWorkspace();
              }}
              onToggleOpen={
                workspaceSidebarSectionPreference.toggleWorkspaceSidebarSection
              }
              onOpenWorkspace={(path) => {
                void workspaceLoader.actions.openRecentWorkspacePath(path);
              }}
              onRemoveWorkspace={
                workspaceLoader.recentWorkspaces.removeWorkspace
              }
            />
            <SpecTree
              state={specState.specTreeState}
              selectedSpecId={specState.selection.specId}
              archivingSpecId={specState.archivingSpecId}
              isLoading={isCurrentViewLoading}
              onSelectSpec={guardedSpecActions.selectSpecFromTree}
              onArchiveSpec={guardedSpecActions.archiveSpecFromTree}
              onReload={guardedSpecActions.reloadSpecsFromTree}
            />
          </div>
        </WorkspaceLayout.LeftNavigation>
        <WorkspaceLayout.Main>
          <WorkspaceLayout.Toolbar>
            <WorkspaceToolbar
              workspacePath={activeWorkspaceRoot}
              inputValue={workspaceLoader.state.workspaceInput}
              isLoading={isWorkspaceOpening}
              isBrowsing={workspaceLoader.state.isBrowsingWorkspace}
              errorMessage={toolbarErrorMessage}
              canRefresh={canRefresh}
              onInputChange={workspaceLoader.actions.setWorkspaceInput}
              onBrowse={() => {
                void workspaceLoader.actions.browseWorkspace();
              }}
              onLoad={workspaceLoader.actions.loadWorkspace}
              onRefresh={() => {
                void viewRefresh.refreshCurrentViewManually();
              }}
              onReset={resetWorkspace}
            />
          </WorkspaceLayout.Toolbar>
          <WorkspaceLayout.Tabs>
            <SpecTabs
              spec={specSelectors.selectedSpec}
              selectedFileKey={specState.selection.fileKey}
              isSelectionDisabled={isCurrentViewLoading}
              onSelectFile={guardedSpecActions.selectFileFromTabs}
            />
          </WorkspaceLayout.Tabs>
          <WorkspaceLayout.Viewer>
            {shouldShowOpenWorkspacePrompt ? (
              <OpenWorkspaceEmptyState
                isOpening={workspaceLoader.state.isBrowsingWorkspace}
                recentWorkspaces={
                  workspaceLoader.recentWorkspaces.recentWorkspaces
                }
                onOpenWorkspace={() => {
                  void workspaceLoader.actions.browseWorkspace();
                }}
                onOpenRecentWorkspace={(path) => {
                  void workspaceLoader.actions.openRecentWorkspacePath(path);
                }}
                onRemoveRecentWorkspace={
                  workspaceLoader.recentWorkspaces.removeWorkspace
                }
              />
            ) : (
              <MarkdownViewer
                state={specState.documentState}
                selectedSpecLabel={specSelectors.selectedSpec?.label ?? null}
                selectedFileLabel={specSelectors.selectedFile?.label ?? null}
                comments={comments.comments}
                activeCommentId={commentSelection.activeCommentId}
                isAddingComment={isAddingComment}
                addCommentErrorMessage={addCommentErrorMessage}
                isUpdatingComment={isUpdatingComment}
                operationState={comments.operationState}
                isCommentScopeReady={isCommentScopeReady}
                onReload={guardedSpecActions.reloadDocumentFromViewer}
                onAddComment={commentSelection.addComment}
                onUpdateComment={commentSelection.updateComment}
                onResolveComment={commentSelection.resolveInlineComment}
                onReopenComment={commentSelection.reopenInlineComment}
                onDeleteComment={commentSelection.deleteInlineComment}
                onSelectComment={commentSelection.selectComment}
                onAnchorDisplayStatesChange={
                  commentSelection.updateCommentAnchorDisplayStates
                }
                onFirstReadable={documentReadiness.markCurrentDocumentReadable}
              />
            )}
          </WorkspaceLayout.Viewer>
        </WorkspaceLayout.Main>
        <WorkspaceLayout.Comments>
          <SpecViewCommentSidebar
            comments={comments.comments}
            correlationId={specState.documentState.correlationId ?? null}
            resetKeys={resetKeys}
            listState={comments.listState}
            operationState={comments.operationState}
            activeCommentId={commentSelection.activeCommentId}
            anchorDisplayStates={commentSelection.commentAnchorDisplayStates}
            onSelectComment={commentSelection.selectComment}
            onResolveComment={commentSelection.resolveComment}
            onReopenComment={commentSelection.reopenComment}
            onDeleteComment={commentSelection.deleteComment}
            onUpdateComment={commentSelection.updateComment}
            onReloadComments={() => {
              void comments.reloadComments();
            }}
          />
        </WorkspaceLayout.Comments>
      </SidebarLayout>
      <WorkspaceDropOverlay
        isVisible={workspaceLoader.state.isDraggingWorkspace}
      />
    </div>
  );
}

export default App;
