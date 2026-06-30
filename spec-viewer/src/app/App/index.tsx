import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from "react";

import "../App.css";
import { useDocumentReadiness } from "@/app/App/useDocumentReadiness";
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
import { CommentScope } from "@/features/comments/domain/commentScope";
import { CommentListState } from "@/features/comments/domain/commentListState";
import {
  ThemeProvider,
  useKeyboardShortcuts,
  useLeftNavigationPreference,
  useResizableLeftNavigation,
} from "@/features/preferences";
import {
  SidebarLayout,
  SidebarPreferenceProvider,
  useSidebarPreference,
} from "@/features/sidebar";
import {
  SpecViewSelectionProvider,
  useSpecViewSelection,
} from "@/app/context/specViewSelection";
import {
  UserReviewPanel,
  useUserReviews,
  type UserReviewWorkspaceMode,
} from "@/features/review-runs";
import {
  MarkdownViewer,
  SpecTabs,
  SpecTree,
  useSpecFileWatcher,
  useSpecs,
  type SpecFileKey,
  type SpecSelectionChange,
} from "@/features/specs";
import {
  OpenWorkspaceEmptyState,
  WorkspaceProvider,
  WorkspaceDropOverlay,
  WorkspaceSidebarSection,
  WorkspaceToolbar,
  selectActiveWorkspaceRoot,
  selectIsWorkspaceOpening,
  selectWorkspace,
  selectWorkspaceError,
  useRecentWorkspaces,
  useWorkspace,
  useWorkspaceDrop,
  useWorkspaceSidebarSectionPreference,
} from "@/features/workspace";
import { WorkspaceLayout } from "@/shared/ui";
import {
  exportComments,
  generateLlmPrompt,
  selectCommentExportDestination,
  selectWorkspaceDirectory,
  validateWorkspaceDirectory,
} from "@/shared/api/tauri";
import { ExportCommentsCommandError } from "@/shared/api/tauri/exportComments";
import { GenerateLlmPromptCommandError } from "@/shared/api/tauri/generateLlmPrompt";
import { ValidateWorkspaceDirectoryCommandError } from "@/shared/api/tauri/validateWorkspaceDirectory";
import { WorkspacePath } from "@/shared/domain/workspacePath";
import { uiText } from "@/shared/lib/uiText";

type RefreshCurrentViewOptions = Readonly<{
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

function SpecViewAppContent(): ReactElement {
  const workspaceContext = useWorkspace();
  const workspaceState = workspaceContext.state;
  const workspaceActions = workspaceContext.actions;
  const currentWorkspace = selectWorkspace(workspaceState);
  const activeWorkspaceRoot = selectActiveWorkspaceRoot(workspaceState);
  const isWorkspaceOpening = selectIsWorkspaceOpening(workspaceState);
  const workspaceError = selectWorkspaceError(workspaceState);
  const recentWorkspaces = useRecentWorkspaces();
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
  const [userReviewWorkspaceMode, setUserReviewWorkspaceMode] =
    useState<UserReviewWorkspaceMode>("currentWorkspace");
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
  const [commentExportState, setCommentExportState] =
    useState<CommentExportState>(idleCommentExportState);
  const [hasAttemptedStartupRestore, setHasAttemptedStartupRestore] =
    useState(false);

  useEffect(() => {
    setActiveCommentId(null);
    setCommentAnchorDisplayStates([]);
    setDialogErrorMessage(null);
    setCommentExportState(idleCommentExportState);
  }, [
    specState.selection.fileKey,
    specState.selection.specId,
    activeWorkspaceRoot,
  ]);

  useEffect(() => {
    setUserReviewWorkspaceMode("currentWorkspace");
  }, [
    specState.selection.fileKey,
    specState.selection.specId,
    activeWorkspaceRoot,
  ]);

  useEffect(() => {
    if (!CommentListState.isLoaded(comments.listState)) {
      return;
    }

    const hasActiveComment = comments.comments.some(
      (comment) => comment.id === activeCommentId,
    );

    if (activeCommentId !== null && !hasActiveComment) {
      setActiveCommentId(null);
    }
  }, [activeCommentId, comments.comments, comments.listState]);

  const loadWorkspacePath = useCallback(
    async (
      selectedDirectory: string,
      options: LoadWorkspacePathOptions = {},
    ): Promise<boolean> => {
      setDialogErrorMessage(null);
      setDropErrorMessage(null);
      setWorkspaceInput(selectedDirectory);
      const isLoaded = await workspaceActions.load(selectedDirectory, {
        preserveCurrentWorkspace: options.preserveCurrentWorkspace,
        onWorkspaceLoaded: recentWorkspaces.recordWorkspace,
      });

      return isLoaded;
    },
    [recentWorkspaces.recordWorkspace, workspaceActions.load],
  );

  const browseWorkspace = async (): Promise<void> => {
    if (isWorkspaceOpening || isBrowsingWorkspace) {
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
      setDialogErrorMessage(getUnknownErrorMessage(error));
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
    workspaceActions.reset();
  };

  const openDroppedWorkspacePath = useCallback(
    async (selectedDirectory: string): Promise<void> => {
      if (isWorkspaceOpening || isBrowsingWorkspace) {
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
        setDropErrorMessage(
          ValidateWorkspaceDirectoryCommandError.fromUnknown(error).message,
        );
      }
    },
    [isBrowsingWorkspace, loadWorkspacePath, isWorkspaceOpening],
  );

  const openRecentWorkspacePath = useCallback(
    async (selectedDirectory: string): Promise<void> => {
      if (isWorkspaceOpening || isBrowsingWorkspace) {
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
          setWorkspaceInput(activeWorkspaceRoot ?? "");
          return;
        }

        const isLoaded = await loadWorkspacePath(selectedDirectory, {
          preserveCurrentWorkspace: true,
        });

        if (!isLoaded) {
          recentWorkspaces.removeWorkspace(selectedDirectory);
          setDialogErrorMessage(unsupportedSavedWorkspaceMessage);
          setWorkspaceInput(activeWorkspaceRoot ?? "");
        }
      } catch (error) {
        recentWorkspaces.removeWorkspace(selectedDirectory);
        setDialogErrorMessage(
          `${missingSavedWorkspaceMessage} ${
            ValidateWorkspaceDirectoryCommandError.fromUnknown(error).message
          }`,
        );
        setWorkspaceInput(activeWorkspaceRoot ?? "");
      }
    },
    [
      isBrowsingWorkspace,
      loadWorkspacePath,
      recentWorkspaces.removeWorkspace,
      activeWorkspaceRoot,
      isWorkspaceOpening,
    ],
  );

  useEffect(() => {
    if (hasAttemptedStartupRestore) {
      return;
    }

    if (
      currentWorkspace !== null ||
      isWorkspaceOpening ||
      isBrowsingWorkspace
    ) {
      return;
    }

    if (recentWorkspaces.lastActiveWorkspacePath === null) {
      return;
    }

    setHasAttemptedStartupRestore(true);
    void openRecentWorkspacePath(recentWorkspaces.lastActiveWorkspacePath);
  }, [
    hasAttemptedStartupRestore,
    isBrowsingWorkspace,
    openRecentWorkspacePath,
    recentWorkspaces.lastActiveWorkspacePath,
    isWorkspaceOpening,
    currentWorkspace,
  ]);

  const workspaceDrop = useWorkspaceDrop({
    isDisabled: isWorkspaceOpening || isBrowsingWorkspace,
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

  const resolveInlineComment = async (
    commentId: CommentId,
  ): Promise<boolean> => {
    const resolvedComment = await comments.resolveComment(commentId);

    return resolvedComment !== null;
  };

  const reopenInlineComment = async (
    commentId: CommentId,
  ): Promise<boolean> => {
    const reopenedComment = await comments.reopenComment(commentId);

    return reopenedComment !== null;
  };

  const deleteInlineComment = async (
    commentId: CommentId,
  ): Promise<boolean> => {
    if (commentId === activeCommentId) {
      setActiveCommentId(null);
    }

    return comments.deleteComment(commentId);
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
      if (currentWorkspace === null) {
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
          workspacePath: currentWorkspace.root,
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
          message: ExportCommentsCommandError.fromUnknown(error).message,
        });
      }
    },
    [currentWorkspace],
  );

  const exportCommentScope = useCallback(
    (scope: CommentExportScope): void => {
      if (specState.selection.specId === null) {
        return;
      }

      if (scope === "workspace") {
        void runCommentExport({ scope });
        return;
      }

      if (scope === "spec") {
        void runCommentExport({
          scope,
          specId: specState.selection.specId,
        });
        return;
      }

      if (specState.selection.fileKey === null) {
        return;
      }

      void runCommentExport({
        scope,
        specId: specState.selection.specId,
        fileKey: specState.selection.fileKey,
      });
    },
    [runCommentExport, specState.selection.fileKey, specState.selection.specId],
  );

  const runLlmPromptCopy = useCallback(
    async (target: ExportCommentsTarget): Promise<void> => {
      if (currentWorkspace === null) {
        return;
      }

      setCommentExportState({
        status: "saving",
        operation: target.scope,
        message: "LLM promptを生成中",
      });

      try {
        const response = await generateLlmPrompt({
          workspacePath: currentWorkspace.root,
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
          message: GenerateLlmPromptCommandError.fromUnknown(error).message,
        });
      }
    },
    [currentWorkspace],
  );

  const copyLlmPromptScope = useCallback(
    (scope: CommentExportScope): void => {
      if (specState.selection.specId === null) {
        return;
      }

      if (scope === "workspace") {
        void runLlmPromptCopy({ scope });
        return;
      }

      if (scope === "spec") {
        void runLlmPromptCopy({
          scope,
          specId: specState.selection.specId,
        });
        return;
      }

      if (specState.selection.fileKey === null) {
        return;
      }

      void runLlmPromptCopy({
        scope,
        specId: specState.selection.specId,
        fileKey: specState.selection.fileKey,
      });
    },
    [runLlmPromptCopy, specState.selection.fileKey, specState.selection.specId],
  );

  const copyMcpFeedbackPayload = useCallback(async (): Promise<void> => {
    if (
      currentWorkspace === null ||
      specState.selection.specId === null ||
      specState.selection.fileKey === null
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
        workspacePath: currentWorkspace.root,
        specId: specState.selection.specId,
        fileKey: specState.selection.fileKey,
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
        message: getUnknownErrorMessage(error),
      });
    }
  }, [
    comments.comments,
    specState.selection.fileKey,
    specState.selection.specId,
    currentWorkspace,
  ]);

  const isCurrentViewLoading = specSelectors.isLoading;

  const selectAdjacentFile = useCallback(
    (direction: NavigationDirection): boolean => {
      const selectedSpec = specSelectors.selectedSpec;

      if (
        isCurrentViewLoading ||
        selectedSpec === null ||
        selectedSpec.files.length === 0
      ) {
        return false;
      }

      const currentIndex = selectedSpec.files.findIndex(
        (file) => file.key === specState.selection.fileKey,
      );
      const selectedIndex = currentIndex < 0 ? 0 : currentIndex;
      const offset = direction === "next" ? 1 : -1;
      const nextIndex =
        (selectedIndex + offset + selectedSpec.files.length) %
        selectedSpec.files.length;
      const nextFileKey: SpecFileKey | undefined =
        selectedSpec.files[nextIndex]?.key;

      if (nextFileKey === undefined) {
        return false;
      }

      void specActions.selectFileKey(nextFileKey);
      return true;
    },
    [
      isCurrentViewLoading,
      specActions.selectFileKey,
      specState.selection.fileKey,
      specSelectors.selectedSpec,
    ],
  );

  const selectAdjacentComment = useCallback(
    (direction: NavigationDirection): boolean => {
      if (comments.comments.length === 0) {
        return false;
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
        return false;
      }

      setActiveCommentId(nextCommentId);
      return true;
    },
    [activeCommentId, comments.comments],
  );

  const refreshCurrentView = useCallback(
    async ({
      failureMessage,
      run,
    }: RefreshCurrentViewOptions): Promise<boolean> => {
      setDialogErrorMessage(null);

      try {
        const isRefreshSuccessful = await run();

        if (!isRefreshSuccessful) {
          setDialogErrorMessage(failureMessage);
          return false;
        }

        return true;
      } catch (error) {
        setDialogErrorMessage(
          `${failureMessage} ${getUnknownErrorMessage(error)}`,
        );
        return false;
      }
    },
    [],
  );

  const reloadCurrentMarkdownFromWatcher =
    useCallback(async (): Promise<void> => {
      if (isCurrentViewLoading) {
        return;
      }

      await refreshCurrentView({
        failureMessage:
          "自動再読み込みに失敗しました。内容が古い可能性があります。",
        run: async () => {
          const isDocumentReloaded = await specActions.reloadDocument();
          const areCommentsReloaded = await comments.reloadComments();
          return isDocumentReloaded && areCommentsReloaded;
        },
      });
    }, [
      comments.reloadComments,
      isCurrentViewLoading,
      refreshCurrentView,
      specActions.reloadDocument,
    ]);

  const reloadWorkspaceConfigFromWatcher =
    useCallback(async (): Promise<void> => {
      if (isCurrentViewLoading) {
        return;
      }

      await refreshCurrentView({
        failureMessage:
          "自動再読み込みに失敗しました。内容が古い可能性があります。",
        run: async () => {
          const areSpecsReloaded = await specActions.reloadSpecs();
          const areCommentsReloaded = await comments.reloadComments();
          return areSpecsReloaded && areCommentsReloaded;
        },
      });
    }, [
      comments.reloadComments,
      isCurrentViewLoading,
      refreshCurrentView,
      specActions.reloadSpecs,
    ]);

  const refreshCurrentViewManually = useCallback(async (): Promise<void> => {
    if (
      currentWorkspace === null ||
      specState.selection.specId === null ||
      specState.selection.fileKey === null ||
      isCurrentViewLoading
    ) {
      return;
    }

    await refreshCurrentView({
      failureMessage:
        "再読み込みに失敗しました。エラーを確認して再試行してください。",
      run: async () => {
        const areSpecsReloaded = await specActions.reloadSpecs();
        const areCommentsReloaded = await comments.reloadComments();
        return areSpecsReloaded && areCommentsReloaded;
      },
    });
  }, [
    comments.reloadComments,
    isCurrentViewLoading,
    refreshCurrentView,
    specActions.reloadSpecs,
    specState.selection.fileKey,
    specState.selection.specId,
    currentWorkspace,
  ]);

  useSpecFileWatcher({
    workspacePath: activeWorkspaceRoot,
    specId: specState.selection.specId,
    fileKey: specState.selection.fileKey,
    onMarkdownChange: reloadCurrentMarkdownFromWatcher,
    onConfigChange: reloadWorkspaceConfigFromWatcher,
    onWatcherError: (event) => {
      setDialogErrorMessage(
        `ファイル監視に失敗しました。内容が古い可能性があります。${event.message}`,
      );
    },
  });

  const toolbarErrorMessage =
    dropErrorMessage ?? dialogErrorMessage ?? workspaceError?.message ?? null;
  const shouldShowOpenWorkspacePrompt =
    currentWorkspace === null && !isWorkspaceOpening;
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
    currentWorkspace !== null &&
    specState.selection.specId !== null &&
    specState.selection.fileKey !== null &&
    documentReadiness.isDocumentReadable;
  const leftNavigationSubtitle =
    activeWorkspaceRoot ?? uiText.workspace.noWorkspace;
  const selectSpecFromTree = useCallback(
    (specId: string): void => {
      if (isCurrentViewLoading) {
        return;
      }

      void specActions.selectSpec(specId);
    },
    [isCurrentViewLoading, specActions.selectSpec],
  );

  const archiveSpecFromTree = useCallback(
    (specId: string): void => {
      if (isCurrentViewLoading) {
        return;
      }

      void specActions.archiveSpec(specId);
    },
    [isCurrentViewLoading, specActions.archiveSpec],
  );

  const reloadSpecsFromTree = useCallback((): void => {
    if (isCurrentViewLoading) {
      return;
    }

    void specActions.reloadSpecs();
  }, [isCurrentViewLoading, specActions.reloadSpecs]);

  const selectFileFromTabs = useCallback(
    (fileKey: SpecFileKey): void => {
      if (isCurrentViewLoading) {
        return;
      }

      void specActions.selectFileKey(fileKey);
    },
    [isCurrentViewLoading, specActions.selectFileKey],
  );

  const reloadDocumentFromViewer = useCallback((): void => {
    if (isCurrentViewLoading) {
      return;
    }

    void specActions.reloadDocument();
  }, [isCurrentViewLoading, specActions.reloadDocument]);

  useKeyboardShortcuts({
    onNextFile: () => selectAdjacentFile("next"),
    onPreviousFile: () => selectAdjacentFile("previous"),
    onNextComment: () => selectAdjacentComment("next"),
    onPreviousComment: () => selectAdjacentComment("previous"),
  });

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
              isBusy={isWorkspaceOpening || isBrowsingWorkspace}
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
              state={specState.specTreeState}
              selectedSpecId={specState.selection.specId}
              archivingSpecId={specState.archivingSpecId}
              isLoading={isCurrentViewLoading}
              onSelectSpec={selectSpecFromTree}
              onArchiveSpec={archiveSpecFromTree}
              onReload={reloadSpecsFromTree}
            />
          </div>
        </WorkspaceLayout.LeftNavigation>
        <WorkspaceLayout.Main>
          <WorkspaceLayout.Toolbar>
            <WorkspaceToolbar
              workspacePath={activeWorkspaceRoot}
              inputValue={workspaceInput}
              isLoading={isWorkspaceOpening}
              isBrowsing={isBrowsingWorkspace}
              errorMessage={toolbarErrorMessage}
              canRefresh={
                currentWorkspace !== null &&
                specState.selection.specId !== null &&
                specState.selection.fileKey !== null &&
                !isCurrentViewLoading
              }
              onInputChange={setWorkspaceInput}
              onBrowse={() => {
                void browseWorkspace();
              }}
              onLoad={loadWorkspace}
              onRefresh={() => {
                void refreshCurrentViewManually();
              }}
              onReset={resetWorkspace}
            />
          </WorkspaceLayout.Toolbar>
          <WorkspaceLayout.Tabs>
            <SpecTabs
              spec={specSelectors.selectedSpec}
              selectedFileKey={specState.selection.fileKey}
              isSelectionDisabled={isCurrentViewLoading}
              onSelectFile={selectFileFromTabs}
            />
          </WorkspaceLayout.Tabs>
          <WorkspaceLayout.Viewer>
            {shouldShowOpenWorkspacePrompt ? (
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
                state={specState.documentState}
                selectedSpecLabel={specSelectors.selectedSpec?.label ?? null}
                selectedFileLabel={specSelectors.selectedFile?.label ?? null}
                comments={comments.comments}
                activeCommentId={activeCommentId}
                isAddingComment={isAddingComment}
                addCommentErrorMessage={addCommentErrorMessage}
                isUpdatingComment={isUpdatingComment}
                operationState={comments.operationState}
                isCommentScopeReady={isCommentScopeReady}
                onReload={reloadDocumentFromViewer}
                onAddComment={addComment}
                onUpdateComment={updateComment}
                onResolveComment={resolveInlineComment}
                onReopenComment={reopenInlineComment}
                onDeleteComment={deleteInlineComment}
                onSelectComment={selectComment}
                onAnchorDisplayStatesChange={updateCommentAnchorDisplayStates}
                onFirstReadable={documentReadiness.markCurrentDocumentReadable}
              />
            )}
          </WorkspaceLayout.Viewer>
        </WorkspaceLayout.Main>
        <WorkspaceLayout.Comments>
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
            userReviewPanel={
              <SpecViewUserReviewPanel
                comments={comments.comments}
                correlationId={specState.documentState.correlationId ?? null}
                workspaceMode={userReviewWorkspaceMode}
                onWorkspaceModeChange={setUserReviewWorkspaceMode}
              />
            }
          />
        </WorkspaceLayout.Comments>
      </SidebarLayout>
      <WorkspaceDropOverlay isVisible={workspaceDrop.status === "dragging"} />
    </div>
  );
}

type UserReviewCommentSummary = Readonly<{
  id: CommentId;
  status: string;
}>;

type SpecViewUserReviewPanelProps = Readonly<{
  comments: readonly UserReviewCommentSummary[];
  correlationId: string | null;
  workspaceMode: UserReviewWorkspaceMode;
  onWorkspaceModeChange: (workspaceMode: UserReviewWorkspaceMode) => void;
}>;

function SpecViewUserReviewPanel(
  props: SpecViewUserReviewPanelProps,
): ReactElement {
  const { comments, correlationId, onWorkspaceModeChange, workspaceMode } =
    props;
  const { selection, setTargetScope, selectionId } = useSpecViewSelection();
  const userReviews = useUserReviews({
    selectionSnapshot: {
      selection,
      selectionId,
    },
    correlationId,
  });

  return (
    <UserReviewPanel
      targetScope={selection.targetScope}
      workspaceMode={workspaceMode}
      openCommentCount={countOpenComments(comments)}
      listState={userReviews.listState}
      createState={userReviews.createState}
      archiveState={userReviews.archiveState}
      onTargetScopeChange={setTargetScope}
      onWorkspaceModeChange={onWorkspaceModeChange}
      onCreateUserReview={() => {
        const openCommentIds = comments
          .filter((comment) => comment.status === "open")
          .map((comment) => comment.id);

        void userReviews.createUserReview({
          commentIds: openCommentIds,
          workspaceMode,
        });
      }}
      onArchiveUserReview={(userReviewId) => {
        void userReviews.archiveUserReview(userReviewId);
      }}
      onRefreshUserReviews={() => {
        void userReviews.reloadUserReviews();
      }}
      onCopyPath={copyTextToClipboard}
    />
  );
}

/** @returns The first or last comment index when no comment is active yet. */
/** @returns A readable message from non-command UI errors. */
function getUnknownErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  return "Unknown failure";
}

/** @returns True when an unknown value is a non-null object record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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
