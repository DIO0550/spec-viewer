import { useCallback, useEffect, useRef, useState } from "react";

import "./App.css";
import {
  CommentSidebar,
  CommentOperationFailedState,
  CommentOperationSavingState,
  createSpecSkillMcpFeedbackDryRunPayload,
  renderSpecSkillMcpFeedbackDryRunPayload,
  useComments,
  type AddCommentSubmitInput,
  type CommentAnchorDisplayState,
  type CommentExportOperation,
  type CommentExportScope,
  type CommentId,
  type ExportCommentsResponse,
  type ExportCommentsTarget,
  type GenerateLlmPromptResponse,
  type SpecSkillMcpFeedbackPayload,
} from "@/features/comments";
import { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import {
  useKeyboardShortcuts,
  useLeftNavigationPreference,
  useResizableLeftNavigation,
  useResizableSidebar,
  useSidebarPreference,
  useTheme,
} from "@/features/preferences";
import {
  ReviewRunPanel,
  useReviewRuns,
  type ReviewRunExecutionMode,
  type ReviewRunTargetScope,
} from "@/features/review-runs";
import {
  MarkdownViewer,
  SpecTabs,
  SpecTree,
  useSpecFileWatcher,
  useSpecs,
  type SpecFileKey,
} from "@/features/specs";
import {
  OpenWorkspaceEmptyState,
  WorkspaceDropOverlay,
  WorkspaceSidebarSection,
  WorkspaceToolbar,
  useRecentWorkspaces,
  useWorkspace,
  useWorkspaceDrop,
  useWorkspaceSidebarSectionPreference,
  type WorkspaceRefreshStatus,
} from "@/features/workspace";
import { AppShell } from "@/shared/ui";
import {
  exportComments,
  generateLlmPrompt,
  normalizeCommandError,
  selectCommentExportDestination,
  selectWorkspaceDirectory,
  validateWorkspaceDirectory,
} from "@/shared/api/tauri";
import { uiText } from "@/shared/lib/uiText";

const idleRefreshStatus: WorkspaceRefreshStatus = {
  status: "idle",
  message: null,
};

type RefreshCurrentViewOptions = Readonly<{
  loadingMessage: string;
  failureStatus: "stale" | "error";
  failureMessage: string;
  run: () => Promise<boolean>;
}>;

type LoadWorkspacePathOptions = Readonly<{
  preserveCurrentWorkspace?: boolean;
}>;

type NavigationDirection = "next" | "previous";

type CommentExportState =
  | Readonly<{
      status: "idle";
      operation: null;
      message: null;
    }>
  | Readonly<{
      status: "saving";
      operation: CommentExportOperation;
      message: string;
    }>
  | Readonly<{
      status: "success";
      operation: CommentExportOperation;
      message: string;
    }>
  | Readonly<{
      status: "error";
      operation: CommentExportOperation;
      message: string;
    }>;

const invalidDroppedDirectoryMessage =
  "ワークスペースフォルダをドロップしてください。ファイルはワークスペースとして開けません。";
const missingSavedWorkspaceMessage =
  "ワークスペースが見つかりません。保存済み一覧から削除しました。";
const unsupportedSavedWorkspaceMessage =
  "対応していないワークスペースです。保存済み一覧から削除しました。";
const idleCommentExportState: CommentExportState = {
  status: "idle",
  operation: null,
  message: null,
};

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
  const specs = useSpecs({ workspacePath: workspace.workspace?.root ?? null });
  const isHtmlDocument =
    specs.documentState.status === "ready" &&
    specs.documentState.document.format === "html";
  const [readableDocumentKey, setReadableDocumentKey] = useState<string | null>(
    null,
  );
  const currentDocumentKey = createDocumentReadableKey(specs.documentState);
  const isDocumentReadable =
    specs.documentState.status === "missing" ||
    (currentDocumentKey !== null && readableDocumentKey === currentDocumentKey);
  const comments = useComments({
    workspacePath: workspace.workspace?.root ?? null,
    specId: specs.selectedSpecId,
    fileKey:
      isHtmlDocument || !isDocumentReadable ? null : specs.selectedFileKey,
    statusFilter: CommentStatusFilter.All,
    correlationId: specs.documentState.correlationId ?? null,
  });
  const [reviewRunTargetScope, setReviewRunTargetScope] =
    useState<ReviewRunTargetScope>("file");
  const [reviewRunExecutionMode, setReviewRunExecutionMode] =
    useState<ReviewRunExecutionMode>("currentWorkspace");
  const reviewRuns = useReviewRuns({
    workspacePath: workspace.workspace?.root ?? null,
    specId: isDocumentReadable ? specs.selectedSpecId : null,
    fileKey: isDocumentReadable ? specs.selectedFileKey : null,
    targetScope: reviewRunTargetScope,
    correlationId: specs.documentState.correlationId ?? null,
  });
  const [workspaceInput, setWorkspaceInput] = useState("");
  const [activeCommentId, setActiveCommentId] = useState<CommentId | null>(
    null,
  );
  const [commentAnchorDisplayStates, setCommentAnchorDisplayStates] = useState<
    readonly CommentAnchorDisplayState[]
  >([]);
  const [isBrowsingWorkspace, setIsBrowsingWorkspace] = useState(false);
  const [dialogErrorMessage, setDialogErrorMessage] = useState<string | null>(
    null,
  );
  const [dropErrorMessage, setDropErrorMessage] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] =
    useState<WorkspaceRefreshStatus>(idleRefreshStatus);
  const [commentExportState, setCommentExportState] =
    useState<CommentExportState>(idleCommentExportState);
  const hasAttemptedStartupRestoreRef = useRef(false);

  useEffect(() => {
    setActiveCommentId(null);
    setCommentAnchorDisplayStates([]);
    setRefreshStatus(idleRefreshStatus);
    setCommentExportState(idleCommentExportState);
  }, [specs.selectedFileKey, specs.selectedSpecId, workspace.workspace?.root]);

  useEffect(() => {
    setReviewRunTargetScope("file");
    setReviewRunExecutionMode("currentWorkspace");
  }, [specs.selectedFileKey, specs.selectedSpecId, workspace.workspace?.root]);

  useEffect(() => {
    if (
      comments.listState.status !== "ready" &&
      comments.listState.status !== "empty"
    ) {
      return;
    }

    const hasActiveComment = comments.comments.some(
      (comment) => comment.id === activeCommentId,
    );

    if (activeCommentId !== null && !hasActiveComment) {
      setActiveCommentId(null);
    }
  }, [activeCommentId, comments.comments, comments.listState.status]);

  const loadWorkspacePath = useCallback(
    async (
      selectedDirectory: string,
      options: LoadWorkspacePathOptions = {},
    ): Promise<boolean> => {
      setDialogErrorMessage(null);
      setDropErrorMessage(null);
      setWorkspaceInput(selectedDirectory);
      const isLoaded = await workspace.load(selectedDirectory, {
        preserveCurrentWorkspace: options.preserveCurrentWorkspace,
        onWorkspaceLoaded: recentWorkspaces.recordWorkspace,
      });

      return isLoaded;
    },
    [recentWorkspaces.recordWorkspace, workspace.load],
  );

  const browseWorkspace = async (): Promise<void> => {
    if (workspace.isLoading || isBrowsingWorkspace) {
      return;
    }

    setDialogErrorMessage(null);
    setIsBrowsingWorkspace(true);

    try {
      const selectedDirectory = await selectWorkspaceDirectory();

      if (selectedDirectory === null) {
        return;
      }

      await loadWorkspacePath(selectedDirectory);
    } catch (error) {
      setDialogErrorMessage(normalizeCommandError(error).message);
    } finally {
      setIsBrowsingWorkspace(false);
    }
  };

  const loadWorkspace = (): void => {
    const selectedDirectory = workspaceInput.trim();

    if (selectedDirectory.length === 0) {
      return;
    }

    void loadWorkspacePath(selectedDirectory);
  };

  const resetWorkspace = (): void => {
    setWorkspaceInput("");
    setDialogErrorMessage(null);
    setDropErrorMessage(null);
    setActiveCommentId(null);
    workspace.reset();
  };

  const openDroppedWorkspacePath = useCallback(
    async (selectedDirectory: string): Promise<void> => {
      if (workspace.isLoading || isBrowsingWorkspace) {
        return;
      }

      setDialogErrorMessage(null);
      setDropErrorMessage(null);
      setWorkspaceInput(selectedDirectory);

      try {
        const validation = await validateWorkspaceDirectory(selectedDirectory);

        if (!validation.isDirectory) {
          setDropErrorMessage(invalidDroppedDirectoryMessage);
          return;
        }

        await loadWorkspacePath(selectedDirectory, {
          preserveCurrentWorkspace: true,
        });
      } catch (error) {
        setDropErrorMessage(normalizeCommandError(error).message);
      }
    },
    [isBrowsingWorkspace, loadWorkspacePath, workspace.isLoading],
  );

  const openRecentWorkspacePath = useCallback(
    async (selectedDirectory: string): Promise<void> => {
      if (workspace.isLoading || isBrowsingWorkspace) {
        return;
      }

      setDialogErrorMessage(null);
      setDropErrorMessage(null);
      setWorkspaceInput(selectedDirectory);

      try {
        const validation = await validateWorkspaceDirectory(selectedDirectory);

        if (!validation.isDirectory) {
          recentWorkspaces.removeWorkspace(selectedDirectory);
          setDialogErrorMessage(missingSavedWorkspaceMessage);
          setWorkspaceInput(workspace.workspace?.root ?? "");
          return;
        }

        const isLoaded = await loadWorkspacePath(selectedDirectory, {
          preserveCurrentWorkspace: true,
        });

        if (!isLoaded) {
          recentWorkspaces.removeWorkspace(selectedDirectory);
          setDialogErrorMessage(unsupportedSavedWorkspaceMessage);
          setWorkspaceInput(workspace.workspace?.root ?? "");
        }
      } catch (error) {
        recentWorkspaces.removeWorkspace(selectedDirectory);
        setDialogErrorMessage(
          `${missingSavedWorkspaceMessage} ${normalizeCommandError(error).message}`,
        );
        setWorkspaceInput(workspace.workspace?.root ?? "");
      }
    },
    [
      isBrowsingWorkspace,
      loadWorkspacePath,
      recentWorkspaces.removeWorkspace,
      workspace.workspace?.root,
      workspace.isLoading,
    ],
  );

  useEffect(() => {
    if (hasAttemptedStartupRestoreRef.current) {
      return;
    }

    if (
      workspace.workspace !== null ||
      workspace.isLoading ||
      isBrowsingWorkspace
    ) {
      return;
    }

    if (recentWorkspaces.lastActiveWorkspacePath === null) {
      return;
    }

    hasAttemptedStartupRestoreRef.current = true;
    void openRecentWorkspacePath(recentWorkspaces.lastActiveWorkspacePath);
  }, [
    isBrowsingWorkspace,
    openRecentWorkspacePath,
    recentWorkspaces.lastActiveWorkspacePath,
    workspace.isLoading,
    workspace.workspace,
  ]);

  const workspaceDrop = useWorkspaceDrop({
    isDisabled: workspace.isLoading || isBrowsingWorkspace,
    onDropWorkspacePath: (selectedDirectory) => {
      void openDroppedWorkspacePath(selectedDirectory);
    },
    onInvalidDrop: setDropErrorMessage,
  });

  const resolveComment = (commentId: CommentId): void => {
    void comments.resolveComment(commentId);
  };

  const reopenComment = (commentId: CommentId): void => {
    void comments.reopenComment(commentId);
  };

  const updateComment = async (
    commentId: CommentId,
    body: string,
  ): Promise<boolean> => {
    const updatedComment = await comments.updateComment({ commentId, body });

    return updatedComment !== null;
  };

  const deleteComment = (commentId: CommentId): void => {
    if (commentId === activeCommentId) {
      setActiveCommentId(null);
    }

    void comments.deleteComment(commentId);
  };

  const selectComment = useCallback(
    (commentId: CommentId): void => {
      setActiveCommentId(commentId);
      sidebarPreference.openSidebar();
    },
    [sidebarPreference.openSidebar],
  );

  const updateCommentAnchorDisplayStates = useCallback(
    (nextStates: readonly CommentAnchorDisplayState[]): void => {
      setCommentAnchorDisplayStates(nextStates);
    },
    [],
  );

  const addComment = async ({
    anchor,
    body,
  }: AddCommentSubmitInput): Promise<boolean> => {
    const addedComment = await comments.addComment({ anchor, body });

    if (addedComment === null) {
      return false;
    }

    setActiveCommentId(addedComment.id);
    return true;
  };

  const runCommentExport = useCallback(
    async (target: ExportCommentsTarget): Promise<void> => {
      if (workspace.workspace === null) {
        return;
      }

      setCommentExportState({
        status: "saving",
        operation: target.scope,
        message: "export先を選択中",
      });

      try {
        const destinationPath = await selectCommentExportDestination(target);

        if (destinationPath === null) {
          setCommentExportState(idleCommentExportState);
          return;
        }

        setCommentExportState({
          status: "saving",
          operation: target.scope,
          message: "コメントをexport中",
        });

        const response = await exportComments({
          workspacePath: workspace.workspace.root,
          target,
          destinationPath,
        });

        setCommentExportState({
          status: "success",
          operation: target.scope,
          message: formatCommentExportSuccessMessage(response),
        });
      } catch (error) {
        setCommentExportState({
          status: "error",
          operation: target.scope,
          message: normalizeCommandError(error).message,
        });
      }
    },
    [workspace.workspace],
  );

  const exportCommentScope = useCallback(
    (scope: CommentExportScope): void => {
      if (specs.selectedSpecId === null) {
        return;
      }

      if (scope === "workspace") {
        void runCommentExport({ scope });
        return;
      }

      if (scope === "spec") {
        void runCommentExport({
          scope,
          specId: specs.selectedSpecId,
        });
        return;
      }

      if (specs.selectedFileKey === null) {
        return;
      }

      void runCommentExport({
        scope,
        specId: specs.selectedSpecId,
        fileKey: specs.selectedFileKey,
      });
    },
    [runCommentExport, specs.selectedFileKey, specs.selectedSpecId],
  );

  const runLlmPromptCopy = useCallback(
    async (target: ExportCommentsTarget): Promise<void> => {
      if (workspace.workspace === null) {
        return;
      }

      setCommentExportState({
        status: "saving",
        operation: target.scope,
        message: "LLM promptを生成中",
      });

      try {
        const response = await generateLlmPrompt({
          workspacePath: workspace.workspace.root,
          target,
        });
        await copyTextToClipboard(response.prompt);

        setCommentExportState({
          status: "success",
          operation: target.scope,
          message: formatLlmPromptCopySuccessMessage(response),
        });
      } catch (error) {
        setCommentExportState({
          status: "error",
          operation: target.scope,
          message: normalizeCommandError(error).message,
        });
      }
    },
    [workspace.workspace],
  );

  const copyLlmPromptScope = useCallback(
    (scope: CommentExportScope): void => {
      if (specs.selectedSpecId === null) {
        return;
      }

      if (scope === "workspace") {
        void runLlmPromptCopy({ scope });
        return;
      }

      if (scope === "spec") {
        void runLlmPromptCopy({
          scope,
          specId: specs.selectedSpecId,
        });
        return;
      }

      if (specs.selectedFileKey === null) {
        return;
      }

      void runLlmPromptCopy({
        scope,
        specId: specs.selectedSpecId,
        fileKey: specs.selectedFileKey,
      });
    },
    [runLlmPromptCopy, specs.selectedFileKey, specs.selectedSpecId],
  );

  const copyMcpFeedbackPayload = useCallback(async (): Promise<void> => {
    if (
      workspace.workspace === null ||
      specs.selectedSpecId === null ||
      specs.selectedFileKey === null
    ) {
      return;
    }

    setCommentExportState({
      status: "saving",
      operation: "mcpFeedback",
      message: "MCP feedback dry-run payloadを準備中",
    });

    try {
      const payload = createSpecSkillMcpFeedbackDryRunPayload({
        workspacePath: workspace.workspace.root,
        specId: specs.selectedSpecId,
        fileKey: specs.selectedFileKey,
        comments: comments.comments,
        generatedAt: new Date().toISOString(),
      });

      await copyTextToClipboard(
        renderSpecSkillMcpFeedbackDryRunPayload(payload),
      );

      setCommentExportState({
        status: "success",
        operation: "mcpFeedback",
        message: formatMcpFeedbackCopySuccessMessage(payload),
      });
    } catch (error) {
      setCommentExportState({
        status: "error",
        operation: "mcpFeedback",
        message: normalizeCommandError(error).message,
      });
    }
  }, [
    comments.comments,
    specs.selectedFileKey,
    specs.selectedSpecId,
    workspace.workspace,
  ]);

  const createReviewRunFromOpenComments =
    useCallback(async (): Promise<void> => {
      const openCommentIds = comments.comments
        .filter((comment) => comment.status === "open")
        .map((comment) => comment.id);

      await reviewRuns.createReviewRun({
        commentIds: openCommentIds,
        executionMode: reviewRunExecutionMode,
      });
    }, [comments.comments, reviewRunExecutionMode, reviewRuns.createReviewRun]);

  const selectAdjacentFile = useCallback(
    (direction: NavigationDirection): void => {
      const selectedSpec = specs.selectedSpec;

      if (selectedSpec === null || selectedSpec.files.length === 0) {
        return;
      }

      const currentIndex = selectedSpec.files.findIndex(
        (file) => file.key === specs.selectedFileKey,
      );
      const selectedIndex = currentIndex < 0 ? 0 : currentIndex;
      const offset = direction === "next" ? 1 : -1;
      const nextIndex =
        (selectedIndex + offset + selectedSpec.files.length) %
        selectedSpec.files.length;
      const nextFileKey: SpecFileKey | undefined =
        selectedSpec.files[nextIndex]?.key;

      if (nextFileKey === undefined) {
        return;
      }

      void specs.selectFileKey(nextFileKey);
    },
    [specs.selectFileKey, specs.selectedFileKey, specs.selectedSpec],
  );

  const selectAdjacentComment = useCallback(
    (direction: NavigationDirection): void => {
      if (comments.comments.length === 0) {
        return;
      }

      const currentIndex = comments.comments.findIndex(
        (comment) => comment.id === activeCommentId,
      );
      const offset = direction === "next" ? 1 : -1;
      const nextIndex =
        currentIndex < 0
          ? selectFallbackCommentIndex(direction, comments.comments.length)
          : (currentIndex + offset + comments.comments.length) %
            comments.comments.length;
      const nextCommentId = comments.comments[nextIndex]?.id;

      if (nextCommentId === undefined) {
        return;
      }

      setActiveCommentId(nextCommentId);
    },
    [activeCommentId, comments.comments],
  );

  const refreshCurrentView = useCallback(
    async ({
      loadingMessage,
      failureStatus,
      failureMessage,
      run,
    }: RefreshCurrentViewOptions): Promise<boolean> => {
      setDialogErrorMessage(null);
      setRefreshStatus({
        status: "loading",
        message: loadingMessage,
      });

      try {
        const isRefreshSuccessful = await run();

        if (!isRefreshSuccessful) {
          setRefreshStatus({
            status: failureStatus,
            message: failureMessage,
          });
          return false;
        }

        setRefreshStatus(idleRefreshStatus);
        return true;
      } catch (error) {
        setRefreshStatus({
          status: failureStatus,
          message: `${failureMessage} ${normalizeCommandError(error).message}`,
        });
        return false;
      }
    },
    [],
  );

  const reloadCurrentMarkdownFromWatcher =
    useCallback(async (): Promise<void> => {
      await refreshCurrentView({
        loadingMessage: "Markdown変更を反映中",
        failureStatus: "stale",
        failureMessage:
          "自動再読み込みに失敗しました。内容が古い可能性があります。",
        run: async () => {
          const isDocumentReloaded = await specs.reloadDocument();
          const areCommentsReloaded = await comments.reloadComments();
          return isDocumentReloaded && areCommentsReloaded;
        },
      });
    }, [comments.reloadComments, refreshCurrentView, specs.reloadDocument]);

  const reloadWorkspaceConfigFromWatcher =
    useCallback(async (): Promise<void> => {
      await refreshCurrentView({
        loadingMessage: "Spec設定変更を反映中",
        failureStatus: "stale",
        failureMessage:
          "自動再読み込みに失敗しました。内容が古い可能性があります。",
        run: async () => {
          const areSpecsReloaded = await specs.reloadSpecs({
            preserveSelection: true,
          });
          const areCommentsReloaded = await comments.reloadComments();
          return areSpecsReloaded && areCommentsReloaded;
        },
      });
    }, [comments.reloadComments, refreshCurrentView, specs.reloadSpecs]);

  const canRefreshCurrentView =
    workspace.workspace !== null &&
    specs.selectedSpecId !== null &&
    specs.selectedFileKey !== null;

  const refreshCurrentViewManually = useCallback(async (): Promise<void> => {
    if (!canRefreshCurrentView || refreshStatus.status === "loading") {
      return;
    }

    await refreshCurrentView({
      loadingMessage: "現在の表示を再読み込み中",
      failureStatus: "error",
      failureMessage:
        "再読み込みに失敗しました。エラーを確認して再試行してください。",
      run: async () => {
        const areSpecsReloaded = await specs.reloadSpecs({
          preserveSelection: true,
        });
        const areCommentsReloaded = await comments.reloadComments();
        return areSpecsReloaded && areCommentsReloaded;
      },
    });
  }, [
    canRefreshCurrentView,
    comments.reloadComments,
    refreshCurrentView,
    refreshStatus.status,
    specs.reloadSpecs,
  ]);

  useSpecFileWatcher({
    workspacePath: workspace.workspace?.root ?? null,
    specId: specs.selectedSpecId,
    fileKey: specs.selectedFileKey,
    onMarkdownChange: reloadCurrentMarkdownFromWatcher,
    onConfigChange: reloadWorkspaceConfigFromWatcher,
    onWatcherError: (event) => {
      setRefreshStatus({
        status: "stale",
        message: `ファイル監視に失敗しました。内容が古い可能性があります。${event.message}`,
      });
    },
  });

  const toolbarErrorMessage =
    dropErrorMessage ?? dialogErrorMessage ?? workspace.error?.message ?? null;
  const shouldShowOpenWorkspacePrompt =
    workspace.workspace === null && !workspace.isLoading;
  const addCommentErrorMessage =
    CommentOperationFailedState.errorFor(comments.operationState, "add")
      ?.message ?? null;
  const updateCommentErrorMessage =
    CommentOperationFailedState.errorFor(comments.operationState, "update")
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
    workspace.workspace !== null &&
    specs.selectedSpecId !== null &&
    specs.selectedFileKey !== null &&
    isDocumentReadable;
  const leftNavigationSubtitle =
    workspace.workspacePath ?? uiText.workspace.noWorkspace;

  useKeyboardShortcuts({
    isEnabled: true,
    onNextFile: () => {
      selectAdjacentFile("next");
    },
    onPreviousFile: () => {
      selectAdjacentFile("previous");
    },
    onNextComment: () => {
      selectAdjacentComment("next");
    },
    onPreviousComment: () => {
      selectAdjacentComment("previous");
    },
  });

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
            inputValue={workspaceInput}
            isLoading={workspace.isLoading}
            isBrowsing={isBrowsingWorkspace}
            errorMessage={toolbarErrorMessage}
            refreshStatus={refreshStatus}
            canRefresh={canRefreshCurrentView}
            themeMode={theme.themeMode}
            onInputChange={setWorkspaceInput}
            onBrowse={() => {
              void browseWorkspace();
            }}
            onLoad={loadWorkspace}
            onRefresh={() => {
              void refreshCurrentViewManually();
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
              isBusy={workspace.isLoading || isBrowsingWorkspace}
              recentWorkspaces={recentWorkspaces.recentWorkspaces}
              onBrowse={() => {
                void browseWorkspace();
              }}
              onToggleOpen={
                workspaceSidebarSectionPreference.toggleWorkspaceSidebarSection
              }
              onOpenWorkspace={(path) => {
                void openRecentWorkspacePath(path);
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
          shouldShowOpenWorkspacePrompt ? (
            <OpenWorkspaceEmptyState
              isOpening={isBrowsingWorkspace}
              recentWorkspaces={recentWorkspaces.recentWorkspaces}
              onOpenWorkspace={() => {
                void browseWorkspace();
              }}
              onOpenRecentWorkspace={(path) => {
                void openRecentWorkspacePath(path);
              }}
              onRemoveRecentWorkspace={recentWorkspaces.removeWorkspace}
            />
          ) : (
            <MarkdownViewer
              state={specs.documentState}
              selectedSpecLabel={specs.selectedSpec?.label ?? null}
              selectedFileLabel={specs.selectedFile?.label ?? null}
              comments={comments.comments}
              activeCommentId={activeCommentId}
              isAddingComment={isAddingComment}
              addCommentErrorMessage={addCommentErrorMessage}
              isUpdatingComment={isUpdatingComment}
              updateCommentErrorMessage={updateCommentErrorMessage}
              isCommentScopeReady={isCommentScopeReady}
              onReload={() => {
                void specs.reloadDocument();
              }}
              onAddComment={addComment}
              onUpdateComment={updateComment}
              onSelectComment={selectComment}
              onAnchorDisplayStatesChange={updateCommentAnchorDisplayStates}
              onFirstReadable={() => {
                setReadableDocumentKey(currentDocumentKey);
              }}
            />
          )
        }
        comments={
          <CommentSidebar
            listState={comments.listState}
            operationState={comments.operationState}
            exportState={commentExportState}
            activeCommentId={activeCommentId}
            anchorDisplayStates={commentAnchorDisplayStates}
            onSelectComment={selectComment}
            onResolveComment={resolveComment}
            onReopenComment={reopenComment}
            onDeleteComment={deleteComment}
            onUpdateComment={updateComment}
            onReload={() => {
              void comments.reloadComments();
            }}
            onExportComments={exportCommentScope}
            onCopyLlmPrompt={copyLlmPromptScope}
            onCopyMcpFeedback={() => {
              void copyMcpFeedbackPayload();
            }}
            reviewRunPanel={
              <ReviewRunPanel
                targetScope={reviewRunTargetScope}
                executionMode={reviewRunExecutionMode}
                openCommentCount={countOpenComments(comments.comments)}
                listState={reviewRuns.listState}
                createState={reviewRuns.createState}
                archiveState={reviewRuns.archiveState}
                onTargetScopeChange={setReviewRunTargetScope}
                onExecutionModeChange={setReviewRunExecutionMode}
                onCreateReviewRun={() => {
                  void createReviewRunFromOpenComments();
                }}
                onArchiveReviewRun={(reviewRunId) => {
                  void reviewRuns.archiveReviewRun(reviewRunId);
                }}
                onRefreshReviewRuns={() => {
                  void reviewRuns.reloadReviewRuns();
                }}
                onCopyPath={copyTextToClipboard}
              />
            }
          />
        }
      />
      <WorkspaceDropOverlay isVisible={workspaceDrop.status === "dragging"} />
    </div>
  );
}

/** @returns The first or last comment index when no comment is active yet. */
function selectFallbackCommentIndex(
  direction: NavigationDirection,
  commentCount: number,
): number {
  if (direction === "next") {
    return 0;
  }

  return Math.max(commentCount - 1, 0);
}

function formatCommentExportSuccessMessage(
  response: ExportCommentsResponse,
): string {
  return `${response.commentCount}件のコメントを${response.destinationPath}へexportしました。`;
}

/** @returns The number of unresolved comments in the active sidebar list. */
function countOpenComments(comments: readonly { status: string }[]): number {
  return comments.filter((comment) => comment.status === "open").length;
}

/** @returns A stable identity for the document load that must become readable. */
function createDocumentReadableKey(
  state: ReturnType<typeof useSpecs>["documentState"],
): string | null {
  if (state.status !== "ready") {
    return null;
  }

  return [
    state.workspacePath,
    state.specId,
    state.fileKey,
    state.correlationId ?? "no-correlation",
  ].join("\u0000");
}

/** Copies generated prompt text to the browser clipboard. */
async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard === undefined) {
    throw new Error("この環境ではクリップボードを利用できません。");
  }

  await navigator.clipboard.writeText(text);
}

/** @returns A compact success message for copied LLM prompt bundles. */
function formatLlmPromptCopySuccessMessage(
  response: GenerateLlmPromptResponse,
): string {
  return `${response.contextFileCount}ファイル / ${response.commentCount}件のコメントを含むLLM promptをコピーしました。`;
}

/** @returns A compact success message for copied Spec Skill MCP feedback dry-runs. */
function formatMcpFeedbackCopySuccessMessage(
  payload: SpecSkillMcpFeedbackPayload,
): string {
  return `${payload.summary.commentCount}件のコメントを${payload.interface.toolName}向けdry-run MCP feedback payloadとしてコピーしました。`;
}

export default App;
