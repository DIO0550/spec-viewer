import { LoaderCircle } from "lucide-react";

import type {
  CommentListState,
  CommentMutationState,
} from "../hooks/useComments";
import type {
  Comment,
  CommentAnchorDisplayState,
  CommentAnchorDisplayStatus,
  CommentId,
} from "../types/comment";
import { CommentThread } from "./CommentThread";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

type Props = Readonly<{
  listState: CommentListState;
  mutationState: CommentMutationState;
  activeCommentId: CommentId | null;
  anchorDisplayStates?: readonly CommentAnchorDisplayState[];
  onSelectComment: (commentId: CommentId) => void;
  onResolveComment: (commentId: CommentId) => void;
  onReopenComment: (commentId: CommentId) => void;
  onDeleteComment: (commentId: CommentId) => void;
  onUpdateComment: (commentId: CommentId, body: string) => void;
  onReload: () => void;
}>;

type CommentGroups = Readonly<{
  openComments: readonly Comment[];
  resolvedComments: readonly Comment[];
}>;

/** @returns The right-side comment review surface for the active spec file. */
export function CommentSidebar({
  listState,
  mutationState,
  activeCommentId,
  anchorDisplayStates = [],
  onSelectComment,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
  onUpdateComment,
  onReload,
}: Props) {
  if (listState.status === "idle") {
    return (
      <section className="comment-sidebar" aria-label="Comments">
        <CommentSidebarHeader openCount={0} resolvedCount={0} />
        <EmptyState
          title="Select a spec file"
          description="Comments appear here once a workspace, spec, and file are selected."
          variant="inline"
        />
      </section>
    );
  }

  if (listState.status === "loading") {
    return (
      <section className="comment-sidebar" aria-label="Comments">
        <CommentSidebarHeader openCount={0} resolvedCount={0} />
        <div className="comment-sidebar__loading" role="status">
          <LoaderCircle aria-hidden="true" size={18} />
          <span>Loading comments</span>
        </div>
      </section>
    );
  }

  if (listState.status === "error") {
    return (
      <section className="comment-sidebar" aria-label="Comments">
        <CommentSidebarHeader openCount={0} resolvedCount={0} />
        <ErrorState
          title="Comments unavailable"
          message={listState.error.message}
          actionLabel="Retry"
          onAction={onReload}
        />
      </section>
    );
  }

  if (listState.status === "empty") {
    return (
      <section className="comment-sidebar" aria-label="Comments">
        <CommentSidebarHeader openCount={0} resolvedCount={0} />
        <EmptyState
          title="No comments yet"
          description="Open and resolved comments for this file will appear here."
          variant="inline"
        />
      </section>
    );
  }

  const groups = groupCommentsByStatus(listState.comments);
  const anchorDisplayStatusByCommentId =
    createAnchorDisplayStatusByCommentId(anchorDisplayStates);

  return (
    <section className="comment-sidebar" aria-label="Comments">
      <CommentSidebarHeader
        openCount={groups.openComments.length}
        resolvedCount={groups.resolvedComments.length}
      />
      <MutationErrorMessage mutationState={mutationState} />
      <CommentSection
        title="Open"
        comments={groups.openComments}
        activeCommentId={activeCommentId}
        anchorDisplayStatusByCommentId={anchorDisplayStatusByCommentId}
        mutationState={mutationState}
        emptyMessage="No open comments"
        onSelectComment={onSelectComment}
        onResolveComment={onResolveComment}
        onReopenComment={onReopenComment}
        onDeleteComment={onDeleteComment}
        onUpdateComment={onUpdateComment}
      />
      <CommentSection
        title="Resolved"
        comments={groups.resolvedComments}
        activeCommentId={activeCommentId}
        anchorDisplayStatusByCommentId={anchorDisplayStatusByCommentId}
        mutationState={mutationState}
        emptyMessage="No resolved comments"
        onSelectComment={onSelectComment}
        onResolveComment={onResolveComment}
        onReopenComment={onReopenComment}
        onDeleteComment={onDeleteComment}
        onUpdateComment={onUpdateComment}
      />
    </section>
  );
}

type HeaderProps = Readonly<{
  openCount: number;
  resolvedCount: number;
}>;

/** @returns Sidebar title and total count badges. */
function CommentSidebarHeader({ openCount, resolvedCount }: HeaderProps) {
  return (
    <header className="comment-sidebar__header">
      <div>
        <h2>Comments</h2>
        <p>Active file review notes</p>
      </div>
      <div className="comment-sidebar__summary" aria-label="Comment counts">
        <span className="comment-sidebar__count">
          Open<span>{openCount}</span>
        </span>
        <span className="comment-sidebar__count comment-sidebar__count--muted">
          Resolved<span>{resolvedCount}</span>
        </span>
      </div>
    </header>
  );
}

type MutationErrorMessageProps = Readonly<{
  mutationState: CommentMutationState;
}>;

/** @returns A compact mutation error, or null when the latest mutation succeeded. */
function MutationErrorMessage({ mutationState }: MutationErrorMessageProps) {
  if (mutationState.status !== "error") {
    return null;
  }

  return (
    <p className="comment-sidebar__mutation-error" role="alert">
      {mutationState.error.message}
    </p>
  );
}

type SectionProps = Readonly<{
  title: "Open" | "Resolved";
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  anchorDisplayStatusByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >;
  mutationState: CommentMutationState;
  emptyMessage: string;
  onSelectComment: (commentId: CommentId) => void;
  onResolveComment: (commentId: CommentId) => void;
  onReopenComment: (commentId: CommentId) => void;
  onDeleteComment: (commentId: CommentId) => void;
  onUpdateComment: (commentId: CommentId, body: string) => void;
}>;

/** @returns One grouped comment section with its count badge. */
function CommentSection({
  title,
  comments,
  activeCommentId,
  anchorDisplayStatusByCommentId,
  mutationState,
  emptyMessage,
  onSelectComment,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
  onUpdateComment,
}: SectionProps) {
  return (
    <section className="comment-sidebar__section" aria-labelledby={title}>
      <div className="comment-sidebar__section-header">
        <h3 id={title}>{title}</h3>
        <span aria-label={`${title} comment count`}>{comments.length}</span>
      </div>
      {comments.length === 0 ? (
        <p className="comment-sidebar__section-empty">{emptyMessage}</p>
      ) : (
        <ul className="comment-sidebar__list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <CommentThread
                comment={comment}
                isActive={comment.id === activeCommentId}
                anchorDisplayStatus={
                  anchorDisplayStatusByCommentId.get(comment.id) ?? "current"
                }
                mutationState={mutationState}
                onSelectComment={onSelectComment}
                onResolveComment={onResolveComment}
                onReopenComment={onReopenComment}
                onDeleteComment={onDeleteComment}
                onUpdateComment={onUpdateComment}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** @returns Comments split by open and resolved display sections. */
function groupCommentsByStatus(comments: readonly Comment[]): CommentGroups {
  return {
    openComments: comments.filter((comment) => !comment.resolved),
    resolvedComments: comments.filter((comment) => comment.resolved),
  };
}

/** @returns A lookup of rendered anchor status by comment id. */
function createAnchorDisplayStatusByCommentId(
  states: readonly CommentAnchorDisplayState[],
): ReadonlyMap<CommentId, CommentAnchorDisplayStatus> {
  return new Map(
    states.map((state) => [state.commentId, state.status] as const),
  );
}
