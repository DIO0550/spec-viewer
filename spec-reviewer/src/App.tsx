import { useCallback, useEffect, useState } from "react";

import "./App.css";
import type { AddCommentSubmitInput } from "./components/AddCommentPopover";
import { AppShell } from "./components/AppShell";
import { CommentSidebar } from "./components/CommentSidebar";
import { MarkdownViewer } from "./components/MarkdownViewer";
import { OpenWorkspaceEmptyState } from "./components/OpenWorkspaceEmptyState";
import { SpecTabs } from "./components/SpecTabs";
import { SpecTree } from "./components/SpecTree";
import { WorkspaceToolbar } from "./components/WorkspaceToolbar";
import { useComments } from "./hooks/useComments";
import { useSpecFileWatcher } from "./hooks/useSpecFileWatcher";
import { useSpecs } from "./hooks/useSpecs";
import { useWorkspace } from "./hooks/useWorkspace";
import type { CommentAnchorDisplayState, CommentId } from "./types/comment";
import { normalizeCommandError, selectWorkspaceDirectory } from "./lib/tauri";

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

  useEffect(() => {
    setActiveCommentId(null);
    setCommentAnchorDisplayStates([]);
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

  const reloadCurrentMarkdownFromWatcher =
    useCallback(async (): Promise<void> => {
      setDialogErrorMessage(null);
      await specs.reloadDocument();
      await comments.reloadComments();
    }, [comments.reloadComments, specs.reloadDocument]);

  const reloadWorkspaceConfigFromWatcher =
    useCallback(async (): Promise<void> => {
      setDialogErrorMessage(null);
      await specs.reloadSpecs();
      await comments.reloadComments();
    }, [comments.reloadComments, specs.reloadSpecs]);

  useSpecFileWatcher({
    workspacePath: workspace.workspace?.root ?? null,
    specId: specs.selectedSpecId,
    fileKey: specs.selectedFileKey,
    onMarkdownChange: reloadCurrentMarkdownFromWatcher,
    onConfigChange: reloadWorkspaceConfigFromWatcher,
    onWatcherError: (event) => {
      setDialogErrorMessage(event.message);
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
          onInputChange={setWorkspaceInput}
          onBrowse={() => {
            void browseWorkspace();
          }}
          onLoad={loadWorkspace}
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
            void specs.reloadSpecs();
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
