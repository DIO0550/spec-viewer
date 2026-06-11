import {
  CommentOperationFailedState,
  CommentOperationSavingState,
} from "@/features/comments";
import type { UseCommentActionsResult } from "@/features/comments/hooks/useCommentActions";
import type { UseCommentSelectionResult } from "@/features/comments/hooks/useCommentSelection";
import type { UseCommentsResult } from "@/features/comments/hooks/useComments";
import type { CommentId } from "@/features/comments/types/comment";
import { MarkdownViewer } from "@/features/specs";
import type { UseSpecsResult } from "@/features/specs/hooks/useSpecs";
import { OpenWorkspaceEmptyState } from "@/features/workspace";
import type { UseRecentWorkspacesResult } from "@/features/workspace/hooks/useRecentWorkspaces";

type Props = Readonly<{
  showOpenWorkspacePrompt: boolean;
  isBrowsing: boolean;
  recentWorkspaces: UseRecentWorkspacesResult;
  specs: UseSpecsResult;
  comments: UseCommentsResult;
  selection: UseCommentSelectionResult;
  actions: UseCommentActionsResult;
  isCommentScopeReady: boolean;
  /** Opens the native directory picker for a new workspace. */
  onOpenWorkspace: () => void;
  /** @param path - Saved workspace path selected from the recent list */
  onOpenRecentWorkspace: (path: string) => void;
  /** @param commentId - Comment selected in the rendered document */
  onSelectComment: (commentId: CommentId) => void;
  /** Notifies once per document when contents become readable. */
  onFirstReadable: () => void;
}>;

/** @returns The center document pane, or the open-workspace prompt. */
export function DocumentViewerPane({
  showOpenWorkspacePrompt,
  isBrowsing,
  recentWorkspaces,
  specs,
  comments,
  selection,
  actions,
  isCommentScopeReady,
  onOpenWorkspace,
  onOpenRecentWorkspace,
  onSelectComment,
  onFirstReadable,
}: Props) {
  if (showOpenWorkspacePrompt) {
    return (
      <OpenWorkspaceEmptyState
        isOpening={isBrowsing}
        recentWorkspaces={recentWorkspaces.recentWorkspaces}
        onOpenWorkspace={onOpenWorkspace}
        onOpenRecentWorkspace={onOpenRecentWorkspace}
        onRemoveRecentWorkspace={recentWorkspaces.removeWorkspace}
      />
    );
  }

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

  return (
    <MarkdownViewer
      state={specs.documentState}
      selectedSpecLabel={specs.selectedSpec?.label ?? null}
      selectedFileLabel={specs.selectedFile?.label ?? null}
      comments={comments.comments}
      activeCommentId={selection.activeCommentId}
      isAddingComment={isAddingComment}
      addCommentErrorMessage={addCommentErrorMessage}
      isUpdatingComment={isUpdatingComment}
      operationState={comments.operationState}
      isCommentScopeReady={isCommentScopeReady}
      onReload={() => {
        void specs.reloadDocument();
      }}
      onAddComment={actions.addComment}
      onUpdateComment={actions.updateComment}
      onResolveComment={actions.resolveCommentAndReport}
      onReopenComment={actions.reopenCommentAndReport}
      onDeleteComment={actions.deleteCommentAndReport}
      onSelectComment={onSelectComment}
      onAnchorDisplayStatesChange={selection.updateAnchorDisplayStates}
      onFirstReadable={onFirstReadable}
    />
  );
}
