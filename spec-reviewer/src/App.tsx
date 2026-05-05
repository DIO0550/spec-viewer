import { useCallback, useEffect, useState } from "react";

import "./App.css";
import type { AddCommentSubmitInput } from "./components/AddCommentPopover";
import { AppShell } from "./components/AppShell";
import { CommentSidebar } from "./components/CommentSidebar";
import { MarkdownViewer } from "./components/MarkdownViewer";
import { OpenWorkspaceEmptyState } from "./components/OpenWorkspaceEmptyState";
import { SpecTabs } from "./components/SpecTabs";
import { SpecTree } from "./components/SpecTree";
import {
  WorkspaceToolbar,
  type WorkspaceRefreshStatus,
} from "./components/WorkspaceToolbar";
import { useComments } from "./hooks/useComments";
import { useSpecFileWatcher } from "./hooks/useSpecFileWatcher";
import { useSpecs } from "./hooks/useSpecs";
import { useWorkspace } from "./hooks/useWorkspace";
import type { CommentAnchorDisplayState, CommentId } from "./types/comment";
import { normalizeCommandError, selectWorkspaceDirectory } from "./lib/tauri";

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

function App() {
  const workspace = useWorkspace();
  const specs = useSpecs({ workspacePath: workspace.workspace?.root ?? null });
  const comments = useComments({
    workspacePath: workspace.workspace?.root ?? null,
    specId: specs.selectedSpecId,
    fileKey: specs.selectedFileKey,
    statusFilter: "all",
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
  const [refreshStatus, setRefreshStatus] =
    useState<WorkspaceRefreshStatus>(idleRefreshStatus);

  useEffect(() => {
    setActiveCommentId(null);
    setCommentAnchorDisplayStates([]);
    setRefreshStatus(idleRefreshStatus);
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

  const loadWorkspacePath = async (
    selectedDirectory: string,
  ): Promise<void> => {
    setDialogErrorMessage(null);
    setWorkspaceInput(selectedDirectory);
    await workspace.load(selectedDirectory);
  };

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
    setActiveCommentId(null);
    workspace.reset();
  };

  const resolveComment = (commentId: CommentId): void => {
    void comments.resolveComment(commentId);
  };

  const reopenComment = (commentId: CommentId): void => {
    void comments.reopenComment(commentId);
  };

  const updateComment = (commentId: CommentId, body: string): void => {
    void comments.updateComment({ commentId, body });
  };

  const deleteComment = (commentId: CommentId): void => {
    if (commentId === activeCommentId) {
      setActiveCommentId(null);
    }

    void comments.deleteComment(commentId);
  };

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
    await comments.reloadComments();
    return true;
  };

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
        loadingMessage: "Refreshing after Markdown change",
        failureStatus: "stale",
        failureMessage: "Automatic refresh failed. Content may be stale.",
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
        loadingMessage: "Refreshing after spec config change",
        failureStatus: "stale",
        failureMessage: "Automatic refresh failed. Content may be stale.",
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
      loadingMessage: "Refreshing current view",
      failureStatus: "error",
      failureMessage: "Refresh failed. Review the pane error and retry.",
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
        message: `File watcher failed. Content may be stale. ${event.message}`,
      });
    },
  });

  const toolbarErrorMessage =
    dialogErrorMessage ?? workspace.error?.message ?? null;
  const shouldShowOpenWorkspacePrompt =
    workspace.workspace === null && !workspace.isLoading;
  const addCommentErrorMessage =
    comments.mutationState.status === "error" &&
    comments.mutationState.operation === "add"
      ? comments.mutationState.error.message
      : null;
  const isAddingComment =
    comments.mutationState.status === "saving" &&
    comments.mutationState.operation === "add";
  const isCommentScopeReady =
    workspace.workspace !== null &&
    specs.selectedSpecId !== null &&
    specs.selectedFileKey !== null;

  return (
    <AppShell
      toolbar={
        <WorkspaceToolbar
          workspacePath={workspace.workspacePath}
          inputValue={workspaceInput}
          isLoading={workspace.isLoading}
          isBrowsing={isBrowsingWorkspace}
          errorMessage={toolbarErrorMessage}
          refreshStatus={refreshStatus}
          canRefresh={canRefreshCurrentView}
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
      }
      sidebar={
        <SpecTree
          state={specs.specTreeState}
          selectedSpecId={specs.selectedSpecId}
          onSelectSpec={(specId) => {
            void specs.selectSpec(specId);
          }}
          onReload={() => {
            void specs.reloadSpecs({ preserveSelection: true });
          }}
        />
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
            onOpenWorkspace={() => {
              void browseWorkspace();
            }}
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
            isCommentScopeReady={isCommentScopeReady}
            onReload={() => {
              void specs.reloadDocument();
            }}
            onAddComment={addComment}
            onSelectComment={setActiveCommentId}
            onAnchorDisplayStatesChange={updateCommentAnchorDisplayStates}
          />
        )
      }
      comments={
        <CommentSidebar
          listState={comments.listState}
          mutationState={comments.mutationState}
          activeCommentId={activeCommentId}
          anchorDisplayStates={commentAnchorDisplayStates}
          onSelectComment={setActiveCommentId}
          onResolveComment={resolveComment}
          onReopenComment={reopenComment}
          onDeleteComment={deleteComment}
          onUpdateComment={updateComment}
          onReload={() => {
            void comments.reloadComments();
          }}
        />
      }
    />
  );
}

export default App;
