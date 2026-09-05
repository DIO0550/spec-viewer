import { RefreshCw } from "lucide-react";
import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { SpecDocumentViewer } from "@/app/App/SpecDocumentViewer";
import "../App.css";
import type { SpecViewResetKeys } from "@/app/App/hooks/types";
import { useCommentSelection } from "@/app/App/hooks/useCommentSelection";
import { useGuardedSpecActions } from "@/app/App/hooks/useGuardedSpecActions";
import { useSpecViewKeyboardNavigation } from "@/app/App/hooks/useSpecViewKeyboardNavigation";
import { useViewRefresh } from "@/app/App/hooks/useViewRefresh";
import {
  resolveRepositoryDiffWorkspacePath,
  resolveSpecDiffWorkspacePath,
} from "@/app/App/resolveDiffWorkspaceLoadPaths";
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
  CurrentFileViewer,
  createSpecChangeId,
  DiffViewer,
  DiffViewModeControls,
  DiffWorkspace,
  type DiffWorkspaceState,
  type FileDiff,
  findSpecChange,
  RevisionSelector,
  type SpecDiffWorkspaceState,
  useSpecDiffWorkspace,
  ViewModeToolbar,
} from "@/features/diff";
import {
  type DiffReviewIdentity,
  useDiffComments,
} from "@/features/diffComments";
import type {
  DiffCommentJumpTarget,
  DiffLineCommentsController,
} from "@/features/diffComments/components/DiffLineCommentSlot";
import { DiffReviewPanel } from "@/features/diffComments/components/DiffReviewPanel";
import {
  createDiffLineCommentsController,
  groupCommentsByResolvedTarget,
} from "@/features/diffComments/components/presentation";
import {
  ThemeProvider,
  useLeftNavigationPreference,
  useViewerFontSizePreference,
  useResizableLeftNavigation,
} from "@/features/preferences";
import {
  collectValidRepositoryFilePaths,
  createRepositoryFileTabId,
  findRepositoryDiffFile,
  formatRevisionIdentifier,
  projectFileReview,
  projectRepositoryDiffTree,
  RepositoryDiffFileHeader,
  RepositoryDiffTree,
  type RepositoryDiffTreeAvailability,
  RepositoryFileTabs,
  summarizeFileDiff,
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
  type SpecSelectionChange,
  SpecTree,
  useSpecs,
} from "@/features/specs";
import {
  useWorkspaceLoader,
  useWorkspaceNavigationState,
  useWorkspaceSidebarSectionPreference,
  useWorkspaceWorktrees,
  WorkspaceDropOverlay,
  WorkspaceProvider,
  WorkspaceSidebarSection,
  WorkspaceToolbar,
  WorktreeTree,
} from "@/features/workspace";
import { resolveActiveWorktreePath } from "@/features/workspace/lib/resolveActiveWorktreePath";
import { getDiffReviewIdentity } from "@/lib/api/tauri";

type DiffCommentJump = Readonly<{
  selectionPath: string;
  key: string;
  sidePath: string;
  side: "base" | "current";
  line: number;
  requestId: number;
}>;
/**
 * Application root that wires the theme, workspace and selection providers.
 *
 * @returns The root application element.
 */
function App(): ReactElement {
  return (
    <ThemeProvider fixedTheme="light">
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
  const workspaceWorktrees = useWorkspaceWorktrees(activeWorkspaceRoot);
  const worktreesLoadState = workspaceWorktrees.state;
  const worktreeCount =
    worktreesLoadState.status === "ready"
      ? worktreesLoadState.data.worktrees.length
      : 0;
  const workspaceNavigation = useWorkspaceNavigationState(worktreesLoadState);
  const activeSpecWorkspacePath = resolveActiveWorktreePath(
    activeWorkspaceRoot,
    workspaceNavigation.state.activeWorktreeId,
  );

  const leftNavigationPreference = useLeftNavigationPreference();
  const viewerFontSizePreference = useViewerFontSizePreference();
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
    workspacePath: activeSpecWorkspacePath,
    onSelectionChange: selectCurrentSpecView,
  });
  const specState = specs.state;
  const specActions = specs.actions;
  const specSelectors = specs.selectors;
  const repositoryNavigation = useRepositoryDiffNavigationState({
    workspaceId: activeWorkspaceRoot,
    worktreeId: activeWorkspaceRoot,
  });
  const repositoryNavigationEntry = repositoryNavigation.entry;
  const repositoryNavigationActions = repositoryNavigation.actions;
  const repositoryDiffWorkspacePath = resolveRepositoryDiffWorkspacePath(
    workspaceNavigation.state.mode,
    activeWorkspaceRoot,
  );
  const repositoryDiff = useRepositoryDiffWorkspace({
    workspacePath: repositoryDiffWorkspacePath,
    worktreeId: repositoryDiffWorkspacePath,
  });
  const specDiffWorkspacePath = resolveSpecDiffWorkspacePath({
    mode: workspaceNavigation.state.mode,
    activeSpecWorkspacePath,
    repositoryStatus: repositoryDiff.state.status,
  });
  const specDiff = useSpecDiffWorkspace({
    workspacePath: specDiffWorkspacePath,
    selection: specState.selection,
  });
  const repositoryMayOwnDiff =
    activeWorkspaceRoot !== null &&
    repositoryDiff.state.status !== "failed" &&
    repositoryDiff.state.status !== "unavailable";
  const isRepositoryDiffView =
    workspaceNavigation.state.mode === "diff" && repositoryMayOwnDiff;
  const loadedRepositoryDiffIdentity =
    useMemo<DiffReviewIdentity | null>(() => {
      if (!isRepositoryDiffView || repositoryDiff.state.overview === null) {
        return null;
      }
      return getDiffReviewIdentity(repositoryDiff.state.overview);
    }, [isRepositoryDiffView, repositoryDiff.state.overview]);
  const repositoryDiffIdentityCache = useRef<Readonly<{
    workspaceRoot: string;
    identity: DiffReviewIdentity;
  }> | null>(null);
  if (activeWorkspaceRoot === null || !isRepositoryDiffView) {
    repositoryDiffIdentityCache.current = null;
  } else if (loadedRepositoryDiffIdentity !== null) {
    repositoryDiffIdentityCache.current = {
      workspaceRoot: activeWorkspaceRoot,
      identity: loadedRepositoryDiffIdentity,
    };
  }
  const repositoryDiffIdentity =
    loadedRepositoryDiffIdentity ??
    (repositoryDiffIdentityCache.current?.workspaceRoot === activeWorkspaceRoot
      ? repositoryDiffIdentityCache.current.identity
      : null);
  const specDiffIdentity = useMemo<DiffReviewIdentity | null>(() => {
    if (
      workspaceNavigation.state.mode !== "diff" ||
      isRepositoryDiffView ||
      specDiff.state.status !== "ready"
    ) {
      return null;
    }
    return specDiff.state.overview.diffReviewIdentity ?? null;
  }, [isRepositoryDiffView, specDiff.state, workspaceNavigation.state.mode]);
  const activeDiffReviewIdentity = isRepositoryDiffView
    ? repositoryDiffIdentity
    : specDiffIdentity;
  const refreshActiveDiffIdentity = useCallback((): void => {
    if (isRepositoryDiffView) {
      void repositoryDiff.refresh();
      return;
    }
    void specDiff.refresh();
  }, [isRepositoryDiffView, repositoryDiff.refresh, specDiff.refresh]);
  const diffComments = useDiffComments({
    identity: activeDiffReviewIdentity,
    onIdentityInvalidated: refreshActiveDiffIdentity,
  });
  const [diffCommentOrigin, setDiffCommentOrigin] =
    useState<HTMLButtonElement | null>(null);
  const [diffCommentJump, setDiffCommentJump] =
    useState<DiffCommentJump | null>(null);
  useEffect(() => {
    if (activeDiffReviewIdentity === null) {
      setDiffCommentOrigin(null);
      setDiffCommentJump(null);
    }
  }, [activeDiffReviewIdentity]);
  const isCurrentViewLoading = specSelectors.isLoading;
  const documentReadiness = useDocumentReadiness(specState.documentState);
  const commentScope = useMemo(
    () =>
      CommentScope.create({
        workspacePath: activeSpecWorkspacePath,
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
      activeSpecWorkspacePath,
    ],
  );
  const comments = useComments({
    scope: commentScope,
    statusFilter: CommentStatusFilter.All,
    correlationId: specState.documentState.correlationId ?? null,
  });

  const resetKeys: SpecViewResetKeys = {
    workspaceRoot: activeSpecWorkspacePath,
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

  const markdownViewerCommentActions = useMemo(
    () => ({
      add: commentSelection.addComment,
      update: commentSelection.updateComment,
      resolve: commentSelection.resolveInlineComment,
      delete: commentSelection.deleteInlineComment,
      select: commentSelection.selectComment,
      reportAnchorDisplayStates:
        commentSelection.updateCommentAnchorDisplayStates,
    }),
    [
      commentSelection.addComment,
      commentSelection.deleteInlineComment,
      commentSelection.resolveInlineComment,
      commentSelection.selectComment,
      commentSelection.updateComment,
      commentSelection.updateCommentAnchorDisplayStates,
    ],
  );

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
      diff: specDiffWorkspacePath === null ? undefined : specDiff.refresh,
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
    activeSpecWorkspacePath !== null &&
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
  const repositoryAllTreeNodes = useMemo(() => {
    const overview = repositoryDiff.state.overview;
    if (overview === null || activeWorkspaceRoot === null) {
      return [];
    }
    return projectRepositoryDiffTree({
      nodes: overview.allRoot,
      overview,
      worktreeId: activeWorkspaceRoot,
      filter: "all",
      ignoredPages: repositoryDiff.state.ignoredPages,
      ignoredPageStates: repositoryDiff.state.ignoredPageStates,
    });
  }, [
    activeWorkspaceRoot,
    repositoryDiff.state.ignoredPageStates,
    repositoryDiff.state.ignoredPages,
    repositoryDiff.state.overview,
  ]);
  const repositoryChangedTreeNodes = useMemo(() => {
    const overview = repositoryDiff.state.overview;
    if (overview === null || activeWorkspaceRoot === null) {
      return [];
    }
    return projectRepositoryDiffTree({
      nodes: overview.changedTree,
      overview,
      worktreeId: activeWorkspaceRoot,
      filter: "changed",
      ignoredPages: repositoryDiff.state.ignoredPages,
      ignoredPageStates: repositoryDiff.state.ignoredPageStates,
    });
  }, [
    activeWorkspaceRoot,
    repositoryDiff.state.ignoredPageStates,
    repositoryDiff.state.ignoredPages,
    repositoryDiff.state.overview,
  ]);
  const repositoryTreeNodes =
    repositoryNavigationEntry.filter === "changed"
      ? repositoryChangedTreeNodes
      : repositoryAllTreeNodes;
  const repositoryAllTreePaths = useMemo(
    () => collectRepositoryTreePaths(repositoryAllTreeNodes),
    [repositoryAllTreeNodes],
  );
  const repositoryValidPaths = useMemo(() => {
    const overview = repositoryDiff.state.overview;
    return overview === null
      ? []
      : collectValidRepositoryFilePaths(overview, repositoryAllTreeNodes);
  }, [repositoryAllTreeNodes, repositoryDiff.state.overview]);
  const repositoryTabItems = useMemo(() => {
    const overview = repositoryDiff.state.overview;
    return repositoryNavigationEntry.openPaths.map((path) => ({
      path,
      change:
        overview === null
          ? null
          : (findRepositoryDiffFile(overview, path)?.change ?? null),
    }));
  }, [repositoryDiff.state.overview, repositoryNavigationEntry.openPaths]);

  useEffect(() => {
    if (repositoryDiff.state.overview === null) {
      return;
    }
    repositoryNavigationActions.reconcile(
      repositoryValidPaths,
      repositoryAllTreePaths.directoryPaths,
    );
  }, [
    repositoryAllTreePaths.directoryPaths,
    repositoryDiff.state.overview,
    repositoryNavigationActions.reconcile,
    repositoryValidPaths,
  ]);

  useEffect(() => {
    const activePath = repositoryNavigationEntry.activePath;
    if (
      !isRepositoryDiffView ||
      activePath === null ||
      repositoryDiff.state.status !== "ready" ||
      repositoryDiff.selection?.path === activePath
    ) {
      return;
    }
    void repositoryDiff.selectPath(activePath);
  }, [
    isRepositoryDiffView,
    repositoryDiff.selectPath,
    repositoryDiff.selection?.path,
    repositoryDiff.state.status,
    repositoryNavigationEntry.activePath,
  ]);

  const repositoryFileProjection = useMemo(() => {
    const selection = repositoryDiff.selection;
    const state = repositoryDiff.state;
    if (
      state.status !== "ready" ||
      state.detail.status !== "ready" ||
      selection === null ||
      selection.path !== repositoryNavigationEntry.activePath
    ) {
      return null;
    }
    return projectFileReview(state.detail.review, selection);
  }, [
    repositoryDiff.selection,
    repositoryDiff.state,
    repositoryNavigationEntry.activePath,
  ]);
  const repositoryFileDiff =
    repositoryFileProjection === null
      ? null
      : toDiffViewerFileDiff(
          repositoryFileProjection.review,
          repositoryFileProjection.selection,
        );
  const diffCommentsByTarget = useMemo(
    () =>
      groupCommentsByResolvedTarget(
        diffComments.session?.comments ?? [],
        diffComments.session?.identity,
      ),
    [diffComments.session?.comments, diffComments.session?.identity],
  );
  const diffLineComments = createDiffLineCommentsController({
    state: diffComments,
    origin: diffCommentOrigin,
    onOriginChange: setDiffCommentOrigin,
    onRevealComment: sidebarPreference.openSidebar,
    commentsByTarget: diffCommentsByTarget,
  });
  const jumpToDiffComment = useCallback(
    (commentId: string): void => {
      const comment = diffComments.session?.comments.find(
        (candidate) => candidate.id === commentId,
      );
      if (comment === undefined) {
        return;
      }
      const resolution = comment.anchorResolution;
      if (resolution.status !== "exact" && resolution.status !== "relocated") {
        return;
      }
      if (!isRepositoryDiffView) {
        if (specDiff.state.status !== "ready") {
          return;
        }
        const change = specDiff.state.overview.files.find((candidate) => {
          const paths = [
            candidate.targetPath,
            candidate.oldPath,
            candidate.newPath,
          ];
          return (
            paths.includes(resolution.selectionPath) ||
            paths.includes(resolution.sidePath)
          );
        });
        if (change === undefined) {
          return;
        }
        guardedSpecActions.selectSpecFileFromChanges(
          change.specId,
          change.fileKey,
        );
        setDiffCommentJump((current) => ({
          key: `${resolution.side}:${resolution.sidePath}:${resolution.line}`,
          selectionPath: resolution.selectionPath,
          sidePath: resolution.sidePath,
          side: resolution.side,
          line: resolution.line,
          requestId: (current?.requestId ?? 0) + 1,
        }));
        return;
      }
      const targetNode = findRepositoryTreeNode(
        repositoryAllTreeNodes,
        resolution.selectionPath,
      );
      repositoryNavigationActions.openPath(resolution.selectionPath);
      if (
        (resolution.side === "base" &&
          repositoryNavigationEntry.viewerMode === "editor") ||
        (resolution.side === "current" &&
          targetNode?.kind === "file" &&
          targetNode.change === null &&
          repositoryNavigationEntry.viewerMode !== "editor")
      ) {
        repositoryNavigationActions.changeViewerMode(
          resolution.side === "base" ? "unified" : "editor",
        );
      }
      setDiffCommentJump((current) => ({
        key: `${resolution.side}:${resolution.sidePath}:${resolution.line}`,
        selectionPath: resolution.selectionPath,
        sidePath: resolution.sidePath,
        side: resolution.side,
        line: resolution.line,
        requestId: (current?.requestId ?? 0) + 1,
      }));
    },
    [
      diffComments.session?.comments,
      guardedSpecActions,
      isRepositoryDiffView,
      repositoryNavigationActions,
      repositoryNavigationEntry.viewerMode,
      repositoryAllTreeNodes,
      specDiff.state,
    ],
  );
  const repositoryActiveChange = useMemo(() => {
    const overview = repositoryDiff.state.overview;
    const activePath = repositoryNavigationEntry.activePath;
    if (overview === null || activePath === null) {
      return null;
    }
    return findRepositoryDiffFile(overview, activePath);
  }, [repositoryDiff.state.overview, repositoryNavigationEntry.activePath]);
  const repositoryBaseIdentifier = formatRevisionIdentifier(
    repositoryDiff.state.overview?.base.state === "resolved"
      ? repositoryDiff.state.overview.base.mergeBaseSha
      : null,
  );
  const repositoryCurrentIdentifier = formatRevisionIdentifier(
    repositoryDiff.state.overview?.currentSnapshotId ?? null,
  );
  const repositoryLineSummary =
    repositoryFileDiff === null ? null : summarizeFileDiff(repositoryFileDiff);
  const repositoryToolbarLabel =
    repositoryNavigationEntry.activePath === null
      ? "ファイル未選択"
      : [
          repositoryNavigationEntry.activePath,
          `base ${repositoryBaseIdentifier}`,
          `current ${repositoryCurrentIdentifier}`,
          repositoryLineSummary === null
            ? null
            : `+${repositoryLineSummary.additions} -${repositoryLineSummary.deletions}`,
        ]
          .filter((part): part is string => part !== null)
          .join(" · ");

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
      : workspaceNavigation.state.mode !== "diff"
        ? ({ status: "ready" } as const)
        : isRepositoryDiffView
          ? repositoryDiff.state.status === "loading" ||
            repositoryDiff.state.status === "idle"
            ? ({
                status: "unavailable",
                reason: "変更ファイルを読み込んでいます",
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
  const repositoryPanel =
    repositoryNavigationEntry.activePath === null ||
    repositoryFileDiff === null ? null : (
      <section
        id="repository-diff-panel"
        className="repository-diff-panel"
        role="tabpanel"
        aria-labelledby={createRepositoryFileTabId(
          repositoryNavigationEntry.activePath,
        )}
      >
        <RepositoryDiffFileHeader
          path={repositoryNavigationEntry.activePath}
          change={repositoryActiveChange?.change ?? null}
          baseIdentifier={repositoryBaseIdentifier}
          currentIdentifier={repositoryCurrentIdentifier}
          summary={repositoryLineSummary}
        />
        {repositoryNavigationEntry.viewerMode === "editor" ? (
          <CurrentFileViewer
            fileDiff={repositoryFileDiff}
            revisionKey={`${repositoryFileDiff.identity.sourceId}:${repositoryFileDiff.identity.path}`}
            activeChangeId={
              repositoryNavigationEntry.jumpTargetsByPath[
                repositoryNavigationEntry.activePath
              ] ?? null
            }
            onActiveChangeIdChange={(changeId: string | null) => {
              const activePath = repositoryNavigationEntry.activePath;
              if (activePath === null) {
                return;
              }
              repositoryNavigationActions.changeJumpTarget(
                activePath,
                changeId,
              );
            }}
            commentJumpTarget={
              diffCommentJump?.selectionPath ===
              repositoryNavigationEntry.activePath
                ? diffCommentJump
                : null
            }
            lineComments={
              repositoryDiffIdentity === null ? undefined : diffLineComments
            }
          />
        ) : (
          <DiffViewer
            fileDiff={repositoryFileDiff}
            mode={repositoryNavigationEntry.viewerMode}
            activeChangeId={
              repositoryNavigationEntry.jumpTargetsByPath[
                repositoryNavigationEntry.activePath
              ] ?? null
            }
            onActiveChangeIdChange={(changeId) => {
              const activePath = repositoryNavigationEntry.activePath;
              if (activePath === null) {
                return;
              }
              repositoryNavigationActions.changeJumpTarget(
                activePath,
                changeId,
              );
            }}
            commentJumpTarget={
              diffCommentJump?.selectionPath ===
              repositoryNavigationEntry.activePath
                ? diffCommentJump
                : null
            }
            lineComments={
              repositoryDiffIdentity === null ? undefined : diffLineComments
            }
          />
        )}
      </section>
    );
  const diffWorkspaceState: DiffWorkspaceState = isRepositoryDiffView
    ? createRepositoryDiffWorkspaceState(
        repositoryDiff.state,
        repositoryDiff.selection,
        repositoryPanel,
        repositoryDiff.refresh,
      )
    : createDiffWorkspaceState(
        specDiff.state,
        specState.selection.specId,
        specState.selection.fileKey,
        currentSpecChange?.targetPath ?? null,
        specDiff.refresh,
        activeDiffReviewIdentity === null ? undefined : diffLineComments,
        diffCommentJump,
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
            viewerFontSize={viewerFontSizePreference.viewerFontSize}
            onViewerFontSizeChange={viewerFontSizePreference.setViewerFontSize}
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
            modeControls={{
              diff: isRepositoryDiffView ? (
                <DiffViewModeControls
                  mode={repositoryNavigationEntry.viewerMode}
                  disabled={repositoryNavigationEntry.activePath === null}
                  onModeChange={repositoryNavigationActions.changeViewerMode}
                />
              ) : null,
            }}
            activeItemLabel={
              isRepositoryDiffView
                ? repositoryToolbarLabel
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
            <div className="worktree-navigation__controls">
              <label className="worktree-navigation__filter">
                <input
                  aria-label="Filter worktrees"
                  placeholder="Filter worktrees..."
                  type="search"
                />
              </label>
              <div className="worktree-navigation__header">
                <span>ROOT / WORKTREES {worktreeCount}</span>
                <button
                  className="icon-button worktree-navigation__refresh"
                  type="button"
                  aria-label="Worktree一覧を再読み込み"
                  title="Worktree一覧を再読み込み"
                  disabled={activeWorkspaceRoot === null}
                  onClick={workspaceWorktrees.refresh}
                >
                  <RefreshCw aria-hidden="true" size={12} />
                </button>
              </div>
            </div>
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
                aria-label="変更ファイルの絞り込み"
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
              <RepositoryDiffTree
                filter={repositoryNavigationEntry.filter}
                nodes={repositoryTreeNodes}
                selectedPath={repositoryNavigationEntry.activePath}
                expandedPaths={repositoryNavigationEntry.expandedPaths}
                availability={createRepositoryDiffTreeAvailability(
                  repositoryDiff.state,
                  repositoryTreeNodes.length,
                )}
                onSelectFile={repositoryNavigationActions.openPath}
                onToggleDirectory={repositoryNavigationActions.toggleDirectory}
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
              fileTabs={
                isRepositoryDiffView ? (
                  <RepositoryFileTabs
                    items={repositoryTabItems}
                    activePath={repositoryNavigationEntry.activePath}
                    onActivate={repositoryNavigationActions.activateTab}
                    onClose={repositoryNavigationActions.closeTab}
                  />
                ) : null
              }
              selectedPath={
                isRepositoryDiffView
                  ? (repositoryNavigationEntry.activePath ?? null)
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
                  <SpecDocumentViewer
                    showOpenWorkspacePrompt={shouldShowOpenWorkspacePrompt}
                    openWorkspace={{
                      isOpening: workspaceLoader.state.isBrowsingWorkspace,
                      recentWorkspaces:
                        workspaceLoader.recentWorkspaces.recentWorkspaces,
                      onOpenWorkspace: () => {
                        void workspaceLoader.actions.browseWorkspace();
                      },
                      onOpenRecentWorkspace: (path) => {
                        void workspaceLoader.actions.openRecentWorkspacePath(
                          path,
                        );
                      },
                      onRemoveRecentWorkspace:
                        workspaceLoader.recentWorkspaces.removeWorkspace,
                    }}
                    viewer={{
                      bundleState: specState.bundleState,
                      artifact: specSelectors.selectedArtifact,
                      workspacePath: activeSpecWorkspacePath,
                      selectedSpecLabel:
                        specSelectors.selectedSpec?.label ?? null,
                      onReload: guardedSpecActions.reloadDocumentFromViewer,
                      onFirstReadable:
                        documentReadiness.markCurrentDocumentReadable,
                    }}
                    comments={{
                      enabled:
                        documentReadiness.isDocumentReadable &&
                        !documentReadiness.isHtmlDocument,
                      layer: {
                        comments: comments.comments,
                        activeCommentId: commentSelection.activeCommentId,
                        addState: {
                          isSaving: isAddingComment,
                          errorMessage: addCommentErrorMessage,
                          isScopeReady: isCommentScopeReady,
                        },
                        editState: {
                          isSaving: isUpdatingComment,
                          operationState: comments.operationState,
                        },
                        actions: markdownViewerCommentActions,
                      },
                    }}
                  />
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
        ) : workspaceNavigation.state.mode === "diff" &&
          activeDiffReviewIdentity !== null ? (
          <WorkspaceLayout.Comments>
            <DiffReviewPanel state={diffComments} onJump={jumpToDiffComment} />
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
 * @param lineComments - Optional line-comment controller for the preview.
 * @param commentJumpTarget - Optional resolved comment location to reveal.
 * @returns The `DiffWorkspace` view state matching the current selection and load state.
 */
function createDiffWorkspaceState(
  state: SpecDiffWorkspaceState,
  selectedSpecId: string | null,
  selectedFileKey: string | null,
  selectedPath: string | null,
  /** Retries loading the diff after a failure. */
  onRetry: () => Promise<boolean>,
  /** Renders line-comment controls when the active diff has a review identity. */
  lineComments: DiffLineCommentsController | undefined,
  /** Reveals a selected sidebar comment in the diff preview. */
  commentJumpTarget: DiffCommentJumpTarget | null,
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
    preview: (
      <SpecDiffViewerPreview
        key={
          state.detail.value.identity.sourceId +
          ":" +
          state.detail.value.identity.path
        }
        fileDiff={state.detail.value}
        lineComments={lineComments}
        commentJumpTarget={commentJumpTarget}
      />
    ),
  };
}

function SpecDiffViewerPreview(
  props: Readonly<{
    fileDiff: FileDiff;
    lineComments?: DiffLineCommentsController;
    commentJumpTarget?: DiffCommentJumpTarget | null;
  }>,
): ReactElement {
  const [activeChangeId, setActiveChangeId] = useState<string | null>(null);
  return (
    <DiffViewer
      fileDiff={props.fileDiff}
      mode="unified"
      activeChangeId={activeChangeId}
      onActiveChangeIdChange={setActiveChangeId}
      lineComments={props.lineComments}
      commentJumpTarget={props.commentJumpTarget}
    />
  );
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
      message: state.error?.message ?? "差分の取得に失敗しました。",
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

function findRepositoryTreeNode(
  nodes: readonly RepositoryDiffTreeProjectionNode[],
  path: string,
): RepositoryDiffTreeProjectionNode | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    if (node.children.items.length === 0) {
      continue;
    }
    const child = findRepositoryTreeNode(node.children.items, path);
    if (child !== null) {
      return child;
    }
  }
  return null;
}

function createRepositoryDiffWorkspaceState(
  state: RepositoryDiffWorkspaceState,
  selection: RepositoryDiffSelection | null,
  preview: ReactNode,
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
      message: state.error?.message ?? "差分は利用できません。",
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
  return {
    status: "ready",
    selectedPath: selection.path,
    preview,
  };
}

export default App;
