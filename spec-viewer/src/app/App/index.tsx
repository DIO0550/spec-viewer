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
import { WorkspaceLayout } from "@/components";
import { WorkspacePath } from "@/domains/workspacePath";
import {
  CommentOperationFailedState,
  CommentOperationSavingState,
  useComments,
} from "@/features/comments";
import { CommentScope } from "@/features/comments/domain/commentScope";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import {
  ChangesNavigation,
  createSpecChangeId,
  DiffViewer,
  DiffWorkspace,
  type DiffWorkspaceState,
  findSpecChange,
  RevisionSelector,
  type SpecDiffWorkspaceState,
  useSpecDiffWorkspace,
  ViewModeToolbar,
} from "@/features/diff";
import {
  ThemeProvider,
  useLeftNavigationPreference,
  useResizableLeftNavigation,
} from "@/features/preferences";
import {
  deriveRepositoryDiffSummary,
  projectFileReview,
  projectRepositoryDiffTree,
  RepositoryDiffSummary,
  RepositoryDiffTree,
  type RepositoryDiffTreeAvailability,
  toDiffViewerFileDiff,
  useRepositoryDiffNavigationState,
} from "@/features/repositoryDiff";
import type {
  RepositoryDiffSelection,
  RepositoryDiffTreeProjectionNode,
} from "@/features/repositoryDiff/domain/repositoryDiff";
import type { RepositoryDiffWorkspaceState } from "@/features/repositoryDiff/domain/repositoryDiffWorkspaceState";
import { useRepositoryDiffWorkspace } from "@/features/repositoryDiff/hooks/useRepositoryDiffWorkspace";
import {
  SidebarLayout,
  SidebarPreferenceProvider,
  useSidebarPreference,
} from "@/features/sidebar";
import {
  SpecArtifactTabs,
  SpecArtifactViewer,
  type SpecSelectionChange,
  SpecTree,
  useSpecs,
} from "@/features/specs";
import {
  OpenWorkspaceEmptyState,
  useWorkspaceLoader,
  useWorkspaceNavigationState,
  useWorkspaceSidebarSectionPreference,
  WorkspaceDropOverlay,
  WorkspaceProvider,
  WorkspaceSidebarSection,
  WorkspaceToolbar,
  type WorkspaceWorktreesLoadState,
  WorktreeTree,
} from "@/features/workspace";

const WorktreesLoadState: WorkspaceWorktreesLoadState = {
  status: "unavailable",
  reason: "data-source-not-connected",
};

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
  const workspaceNavigation = useWorkspaceNavigationState(WorktreesLoadState);
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
  const { selectSpecView } = useSpecViewSelection();
  const selectCurrentSpecView = useCallback(
    (selection: SpecSelectionChange): void => {
      selectSpecView({
        workspacePath:
          selection.workspacePath === null
            ? null
            : WorkspacePath.fromString(selection.workspacePath),
        specId: selection.specId,
        fileKey: selection.fileKey,
      });
    },
    [selectSpecView],
  );
  const specs = useSpecs({
    workspacePath: activeWorkspaceRoot,
    onSelectionChange: selectCurrentSpecView,
  });
  const specState = specs.state;
  const specActions = specs.actions;
  const specSelectors = specs.selectors;
  const specDiff = useSpecDiffWorkspace({
    workspacePath: activeWorkspaceRoot,
    selection: specState.selection,
  });
  const repositoryNavigation = useRepositoryDiffNavigationState({
    workspaceId: activeWorkspaceRoot,
    worktreeId: activeWorkspaceRoot,
  });
  const repositoryNavigationEntry = repositoryNavigation.entry;
  const repositoryNavigationActions = repositoryNavigation.actions;
  const repositoryDiff = useRepositoryDiffWorkspace({
    workspacePath: activeWorkspaceRoot,
    worktreeId: activeWorkspaceRoot,
  });
  const repositoryMayOwnDiff =
    activeWorkspaceRoot !== null &&
    repositoryDiff.state.status !== "failed" &&
    repositoryDiff.state.status !== "unavailable";
  const isRepositoryDiffView =
    workspaceNavigation.state.mode === "diff" && repositoryMayOwnDiff;
  const isCurrentViewLoading = specSelectors.isLoading;
  const documentReadiness = useDocumentReadiness(specState.documentState);
  const commentScope = useMemo(
    () =>
      CommentScope.create({
        workspacePath: activeWorkspaceRoot,
        specId: specState.selection.specId,
        fileKey:
          documentReadiness.isHtmlDocument ||
          !documentReadiness.isDocumentReadable
            ? null
            : specState.selection.fileKey,
      }),
    [
      documentReadiness.isDocumentReadable,
      documentReadiness.isHtmlDocument,
      specState.selection.fileKey,
      specState.selection.specId,
      activeWorkspaceRoot,
    ],
  );
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
    selectSpecFile: specActions.selectSpecFile,
    reloadDocument: specActions.reloadDocument,
  });

  const viewRefresh = useViewRefresh({
    selection: resetKeys,
    isCurrentViewLoading,
    isRepositoryView: isRepositoryDiffView,
    reload: {
      document: specActions.reloadDocument,
      specs: specActions.reloadSpecs,
      comments: comments.reloadComments,
      diff: specDiff.refresh,
      repositoryInvalidate: repositoryDiff.invalidate,
      repository: repositoryDiff.refresh,
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
    if (
      resetKeys.fileKey === null &&
      resetKeys.specId === null &&
      resetKeys.workspaceRoot === null
    ) {
      setDialogErrorMessage(null);
      return;
    }
    setDialogErrorMessage(null);
  }, [resetKeys.fileKey, resetKeys.specId, resetKeys.workspaceRoot]);

  useEffect(() => {
    if (
      workspaceNavigation.state.mode === "diff" &&
      (specDiff.state.status === "idle" ||
        specDiff.state.status === "unavailable") &&
      !repositoryMayOwnDiff
    ) {
      workspaceNavigation.actions.changeMode("specs");
    }
  }, [
    repositoryMayOwnDiff,
    specDiff.state.status,
    workspaceNavigation.actions.changeMode,
    workspaceNavigation.state.mode,
  ]);

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
  const isCommentScopeReady =
    activeWorkspaceRoot !== null &&
    resetKeys.specId !== null &&
    resetKeys.fileKey !== null &&
    documentReadiness.isDocumentReadable;
  const canRefresh =
    activeWorkspaceRoot !== null &&
    (isRepositoryDiffView || specSelectors.canReloadDocument);
  const currentSpecChange = useMemo(
    () =>
      specDiff.state.status === "ready"
        ? findSpecChange(specDiff.state.overview.files, specState.selection)
        : null,
    [specDiff.state, specState.selection],
  );
  const selectedChangeId =
    currentSpecChange === null ? null : createSpecChangeId(currentSpecChange);
  const changesItems = useMemo(
    () =>
      specDiff.state.status === "ready"
        ? specDiff.state.overview.files.map((file) => ({
            id: createSpecChangeId(file),
            path: file.targetPath,
            change: file.change,
          }))
        : [],
    [specDiff.state],
  );
  const repositoryTreeNodes = useMemo(() => {
    const overview = repositoryDiff.state.overview;
    if (overview === null || activeWorkspaceRoot === null) {
      return [];
    }
    const nodes =
      repositoryNavigationEntry.filter === "changed"
        ? overview.changedTree
        : overview.allRoot;
    return projectRepositoryDiffTree({
      nodes,
      overview,
      worktreeId: activeWorkspaceRoot,
      filter: repositoryNavigationEntry.filter,
      ignoredPages: repositoryDiff.state.ignoredPages,
      ignoredPageStates: repositoryDiff.state.ignoredPageStates,
    });
  }, [
    activeWorkspaceRoot,
    repositoryDiff.state.ignoredPageStates,
    repositoryDiff.state.ignoredPages,
    repositoryDiff.state.overview,
    repositoryNavigationEntry.filter,
  ]);
  const repositorySummary = useMemo(() => {
    const overview = repositoryDiff.state.overview;
    return overview === null
      ? null
      : deriveRepositoryDiffSummary(overview, repositoryNavigationEntry.filter);
  }, [repositoryDiff.state.overview, repositoryNavigationEntry.filter]);
  const repositoryTreePaths = useMemo(
    () => collectRepositoryTreePaths(repositoryTreeNodes),
    [repositoryTreeNodes],
  );

  useEffect(() => {
    repositoryNavigationActions.reconcile(
      repositoryTreePaths.visiblePaths,
      repositoryTreePaths.directoryPaths,
    );
  }, [repositoryNavigationActions.reconcile, repositoryTreePaths]);

  useEffect(() => {
    const selectedPath = repositoryNavigationEntry.selectedPath;
    if (
      !isRepositoryDiffView ||
      selectedPath === null ||
      repositoryDiff.state.status !== "ready" ||
      repositoryDiff.selection?.path === selectedPath
    ) {
      return;
    }
    void repositoryDiff.selectPath(selectedPath);
  }, [
    isRepositoryDiffView,
    repositoryDiff.selectPath,
    repositoryDiff.selection?.path,
    repositoryDiff.state.status,
    repositoryNavigationEntry.selectedPath,
  ]);

  const changesAvailability =
    specDiff.state.status === "ready"
      ? ({ status: "ready" } as const)
      : specDiff.state.status === "failed"
        ? ({ status: "failed", message: specDiff.state.message } as const)
        : specDiff.state.status === "unavailable"
          ? ({ status: "unavailable", reason: specDiff.state.reason } as const)
          : ({ status: "loading" } as const);
  const diffTabAvailability =
    activeWorkspaceRoot === null
      ? ({
          status: "unavailable",
          reason: "ワークスペースを選択するとDiffを利用できます",
        } as const)
      : isRepositoryDiffView
        ? repositoryDiff.state.status === "loading" ||
          repositoryDiff.state.status === "idle"
          ? ({
              status: "unavailable",
              reason: "Repository diffを読み込んでいます",
            } as const)
          : ({ status: "ready" } as const)
        : specDiff.state.status === "idle" ||
            specDiff.state.status === "loading"
          ? ({
              status: "unavailable",
              reason: "Diff情報を読み込んでいます",
            } as const)
          : specDiff.state.status === "unavailable"
            ? ({
                status: "unavailable",
                reason: specDiff.state.reason,
              } as const)
            : ({ status: "ready" } as const);
  const diffWorkspaceState: DiffWorkspaceState = isRepositoryDiffView
    ? createRepositoryDiffWorkspaceState(
        repositoryDiff.state,
        repositoryDiff.selection,
        repositoryDiff.refresh,
      )
    : createDiffWorkspaceState(
        specDiff.state,
        specState.selection.specId,
        specState.selection.fileKey,
        currentSpecChange?.targetPath ?? null,
        specDiff.refresh,
      );

  return (
    <div className="app-drop-root">
      <SidebarLayout
        worktrees={{
          isOpen: leftNavigationPreference.isLeftNavigationOpen,
          width: resizableLeftNavigation.leftNavigationWidth,
          minWidth: resizableLeftNavigation.minLeftNavigationWidth,
          maxWidth: resizableLeftNavigation.maxLeftNavigationWidth,
          onOpen: leftNavigationPreference.openLeftNavigation,
          onClose: leftNavigationPreference.closeLeftNavigation,
          onWidthChange: resizableLeftNavigation.resizeLeftNavigationTo,
        }}
      >
        <WorkspaceLayout.Pathbar>
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
        </WorkspaceLayout.Pathbar>
        <WorkspaceLayout.Toolbar>
          <ViewModeToolbar
            mode={workspaceNavigation.state.mode}
            diffAvailability={diffTabAvailability}
            activeItemLabel={
              isRepositoryDiffView
                ? (repositoryNavigationEntry.selectedPath ?? "ファイル未選択")
                : specSelectors.selectedSpec !== null &&
                    specSelectors.selectedFile !== null
                  ? specSelectors.selectedSpec.label +
                    " / " +
                    specSelectors.selectedFile.fileName
                  : "ファイル未選択"
            }
            onModeChange={workspaceNavigation.actions.changeMode}
          />
        </WorkspaceLayout.Toolbar>
        <WorkspaceLayout.Worktrees header={null}>
          <div className="left-navigation-panel">
            <WorktreeTree
              nodes={workspaceNavigation.navigationNodes}
              selectedWorktreeId={workspaceNavigation.state.activeWorktreeId}
              emptyLabel="Worktree データはまだ利用できません"
              onSelectWorktree={workspaceNavigation.actions.selectWorktree}
            />
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
          </div>
        </WorkspaceLayout.Worktrees>
        <WorkspaceLayout.ModeNavigation>
          {workspaceNavigation.state.mode === "specs" ? (
            <SpecTree
              state={specState.specTreeState}
              selectedSpecId={specState.selection.specId}
              changeBadgesBySpecId={specDiff.badges}
              archivingSpecId={specState.archivingSpecId}
              archiveFailure={specState.archiveFailure}
              archiveReveal={specState.archiveReveal}
              isLoading={isCurrentViewLoading}
              onSelectSpec={guardedSpecActions.selectSpecFromTree}
              onArchiveSpec={guardedSpecActions.archiveSpecFromTree}
              onRetryArchive={() => {
                void specActions.retryArchiveSpec();
              }}
              onRefreshArchiveReveal={() => {
                void specActions.refreshArchiveReveal();
              }}
              onReload={guardedSpecActions.reloadSpecsFromTree}
            />
          ) : isRepositoryDiffView ? (
            <div className="repository-diff-navigation">
              <div
                className="repository-diff-navigation__filters"
                role="tablist"
                aria-label="Repository diff filter"
              >
                <button
                  className="repository-diff-navigation__filter"
                  type="button"
                  role="tab"
                  aria-selected={repositoryNavigationEntry.filter === "changed"}
                  onClick={() => {
                    repositoryNavigationActions.changeFilter("changed");
                  }}
                >
                  Changed
                </button>
                <button
                  className="repository-diff-navigation__filter"
                  type="button"
                  role="tab"
                  aria-selected={repositoryNavigationEntry.filter === "all"}
                  onClick={() => {
                    repositoryNavigationActions.changeFilter("all");
                  }}
                >
                  All
                </button>
              </div>
              {repositorySummary === null ? null : (
                <RepositoryDiffSummary summary={repositorySummary} />
              )}
              <RepositoryDiffTree
                filter={repositoryNavigationEntry.filter}
                nodes={repositoryTreeNodes}
                selectedPath={repositoryNavigationEntry.selectedPath}
                expandedPaths={repositoryNavigationEntry.expandedPaths}
                availability={createRepositoryDiffTreeAvailability(
                  repositoryDiff.state,
                  repositoryTreeNodes.length,
                )}
                onSelectFile={(path) => {
                  repositoryNavigationActions.selectPath(path);
                }}
                onToggleDirectory={(path) => {
                  repositoryNavigationActions.toggleDirectory(path);
                }}
                onLoadChildren={(nodeId, cursor) => {
                  void repositoryDiff.loadIgnoredChildren(nodeId, cursor);
                }}
                onRetry={() => {
                  void repositoryDiff.retry();
                }}
              />
            </div>
          ) : (
            <ChangesNavigation
              items={changesItems}
              selectedId={selectedChangeId}
              availability={changesAvailability}
              onSelect={(id) => {
                const change =
                  specDiff.state.status === "ready"
                    ? (specDiff.state.overview.files.find(
                        (file) => createSpecChangeId(file) === id,
                      ) ?? null)
                    : null;
                if (change === null) {
                  return;
                }
                workspaceNavigation.actions.selectItem(id);
                guardedSpecActions.selectSpecFileFromChanges(
                  change.specId,
                  change.fileKey,
                );
              }}
              onRetry={() => {
                void specDiff.refresh();
              }}
            />
          )}
        </WorkspaceLayout.ModeNavigation>
        <WorkspaceLayout.Content>
          {workspaceNavigation.state.mode === "diff" ? (
            <DiffWorkspace
              state={diffWorkspaceState}
              revisionSelector={
                isRepositoryDiffView || activeWorkspaceRoot === null ? null : (
                  <RevisionSelector
                    value={specDiff.comparison}
                    options={specDiff.revisionOptions.value}
                    history={specDiff.fileHistory.value}
                    optionsStatus={specDiff.revisionOptions.status}
                    historyStatus={specDiff.fileHistory.status}
                    isComparing={
                      specDiff.comparisonOperation.status === "loading"
                    }
                    errorMessage={
                      specDiff.comparisonOperation.status === "failed"
                        ? specDiff.comparisonOperation.message
                        : null
                    }
                    optionsErrorMessage={
                      specDiff.revisionOptions.status === "failed"
                        ? specDiff.revisionOptions.message
                        : null
                    }
                    historyErrorMessage={
                      specDiff.fileHistory.status === "failed"
                        ? specDiff.fileHistory.message
                        : null
                    }
                    onChange={(revision) => {
                      void specDiff.selectComparison(revision);
                    }}
                    onRetryOptions={() => {
                      void specDiff.retryRevisionOptions();
                    }}
                    onRetryHistory={() => {
                      void specDiff.retryFileHistory();
                    }}
                  />
                )
              }
              selectedPath={
                isRepositoryDiffView
                  ? (repositoryNavigationEntry.selectedPath ?? null)
                  : (currentSpecChange?.targetPath ?? null)
              }
              preview={null}
              availability={{ status: "ready" }}
            />
          ) : (
            <div className="specs-workspace">
              <section
                className="specs-workspace__document"
                aria-label="Spec document"
              >
                <SpecArtifactTabs
                  specLabel={specSelectors.selectedSpec?.label ?? null}
                  artifacts={specState.bundleState.bundle?.artifacts ?? []}
                  selectedIdentity={specState.selection.artifactIdentity}
                  isSelectionDisabled={isCurrentViewLoading}
                  onSelectArtifact={specActions.selectArtifact}
                />
                <div className="specs-workspace__viewer">
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
                        void workspaceLoader.actions.openRecentWorkspacePath(
                          path,
                        );
                      }}
                      onRemoveRecentWorkspace={
                        workspaceLoader.recentWorkspaces.removeWorkspace
                      }
                    />
                  ) : (
                    <SpecArtifactViewer
                      bundleState={specState.bundleState}
                      artifact={specSelectors.selectedArtifact}
                      workspacePath={activeWorkspaceRoot}
                      selectedSpecLabel={
                        specSelectors.selectedSpec?.label ?? null
                      }
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
                      onFirstReadable={
                        documentReadiness.markCurrentDocumentReadable
                      }
                    />
                  )}
                </div>
              </section>
            </div>
          )}
        </WorkspaceLayout.Content>
        {workspaceNavigation.state.mode === "specs" ? (
          <WorkspaceLayout.Comments>
            <SpecViewCommentSidebar
              comments={comments.comments}
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
        ) : null}
      </SidebarLayout>
      <WorkspaceDropOverlay
        isVisible={workspaceLoader.state.isDraggingWorkspace}
      />
    </div>
  );
}

/**
 * Maps the spec diff workspace's loading state and current selection into
 * the `DiffWorkspace` view state, short-circuiting to `noSelection` before
 * a spec/file is selected and threading `onRetry` through every failure
 * branch.
 *
 * @param state - Current spec diff workspace load state.
 * @param selectedSpecId - Id of the currently selected spec, or `null`.
 * @param selectedFileKey - Key of the currently selected file, or `null`.
 * @param selectedPath - Target path of the currently selected change, or `null`.
 * @param onRetry - Callback to retry loading after a failure.
 * @returns The `DiffWorkspace` view state matching the current selection and load state.
 */
function createDiffWorkspaceState(
  state: SpecDiffWorkspaceState,
  selectedSpecId: string | null,
  selectedFileKey: string | null,
  selectedPath: string | null,
  /** Retries loading the diff after a failure. */
  onRetry: () => Promise<boolean>,
): DiffWorkspaceState {
  if (selectedSpecId === null || selectedFileKey === null) {
    return { status: "noSelection" };
  }
  if (state.status === "idle" || state.status === "loading") {
    return { status: "loading" };
  }
  if (state.status === "unavailable") {
    return { status: "failed", message: state.reason, onRetry };
  }
  if (state.status === "failed") {
    return { status: "failed", message: state.message, onRetry };
  }
  if (state.detail.status === "unchanged") {
    return { status: "unchanged" };
  }
  if (state.detail.status === "loading") {
    return { status: "loading" };
  }
  if (state.detail.status === "failed") {
    return { status: "failed", message: state.detail.message, onRetry };
  }

  return {
    status: "ready",
    selectedPath: selectedPath ?? selectedFileKey,
    preview: <DiffViewer fileDiff={state.detail.value} />,
  };
}

function createRepositoryDiffTreeAvailability(
  state: RepositoryDiffWorkspaceState,
  nodeCount: number,
): RepositoryDiffTreeAvailability {
  if (state.status === "idle" || state.status === "loading") {
    return { status: "loading" };
  }
  if (state.status === "needsSelection") {
    return {
      status: "error",
      message: "比較元のブランチを選択してください。",
    };
  }
  if (state.status === "invalidOverride") {
    return {
      status: "error",
      message: "指定された比較元ブランチを解決できません。",
    };
  }
  if (state.status === "unavailable" || state.status === "failed") {
    return {
      status: "error",
      message: state.error?.message ?? "Repository diff の取得に失敗しました。",
    };
  }
  return nodeCount === 0 ? { status: "empty" } : { status: "ready" };
}

function collectRepositoryTreePaths(
  nodes: readonly RepositoryDiffTreeProjectionNode[],
): Readonly<{
  visiblePaths: readonly string[];
  directoryPaths: readonly string[];
}> {
  const visiblePaths: string[] = [];
  const directoryPaths: string[] = [];
  const visit = (items: readonly RepositoryDiffTreeProjectionNode[]): void => {
    items.forEach((node) => {
      visiblePaths.push(node.path);
      if (node.kind === "directory") {
        directoryPaths.push(node.path);
      }
      if (node.children.items.length > 0) {
        visit(node.children.items);
      }
    });
  };
  visit(nodes);
  return { visiblePaths, directoryPaths };
}

function createRepositoryDiffWorkspaceState(
  state: RepositoryDiffWorkspaceState,
  selection: RepositoryDiffSelection | null,
  onRetry: () => Promise<boolean>,
): DiffWorkspaceState {
  if (state.status === "idle" || state.status === "loading") {
    return { status: "loading" };
  }
  if (state.status === "needsSelection") {
    return {
      status: "selectionRequired",
      message: "比較元のブランチを選択してください。",
      onRetry,
    };
  }
  if (state.status === "invalidOverride") {
    return {
      status: "failed",
      message: "指定された比較元ブランチを解決できません。",
      onRetry,
    };
  }
  if (state.status === "unavailable" || state.status === "failed") {
    return {
      status: "failed",
      message: state.error?.message ?? "Repository diff は利用できません。",
      onRetry,
    };
  }
  if (selection === null) {
    return { status: "noSelection", label: "変更ファイル" };
  }
  if (state.detail.status === "unchanged") {
    return { status: "unchanged" };
  }
  if (state.detail.status === "loading") {
    return { status: "loading" };
  }
  if (
    state.detail.status === "unavailable" ||
    state.detail.status === "failed"
  ) {
    return {
      status: "failed",
      message: state.detail.error.message,
      onRetry,
    };
  }
  const projection = projectFileReview(state.detail.review, selection);
  return {
    status: "ready",
    selectedPath: projection.path,
    preview: (
      <DiffViewer
        fileDiff={toDiffViewerFileDiff(projection.review, projection.selection)}
      />
    ),
  };
}

export default App;
