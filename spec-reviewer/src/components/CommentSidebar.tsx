import { CheckCircle2, LoaderCircle, RotateCcw, Trash2 } from "lucide-react";

import type {
  CommentListState,
  CommentMutationState,
} from "../hooks/useComments";
import type { Comment, CommentId } from "../types/comment";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

type Props = Readonly<{
  listState: CommentListState;
  mutationState: CommentMutationState;
  activeCommentId: CommentId | null;
  onSelectComment: (commentId: CommentId) => void;
  onResolveComment: (commentId: CommentId) => void;
  onReopenComment: (commentId: CommentId) => void;
  onDeleteComment: (commentId: CommentId) => void;
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
  onSelectComment,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
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
        mutationState={mutationState}
        emptyMessage="No open comments"
        onSelectComment={onSelectComment}
        onResolveComment={onResolveComment}
        onReopenComment={onReopenComment}
        onDeleteComment={onDeleteComment}
      />
      <CommentSection
        title="Resolved"
        comments={groups.resolvedComments}
        activeCommentId={activeCommentId}
        mutationState={mutationState}
        emptyMessage="No resolved comments"
        onSelectComment={onSelectComment}
        onResolveComment={onResolveComment}
        onReopenComment={onReopenComment}
        onDeleteComment={onDeleteComment}
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
  mutationState: CommentMutationState;
  emptyMessage: string;
  onSelectComment: (commentId: CommentId) => void;
  onResolveComment: (commentId: CommentId) => void;
  onReopenComment: (commentId: CommentId) => void;
  onDeleteComment: (commentId: CommentId) => void;
}>;

/** @returns One grouped comment section with its count badge. */
function CommentSection({
  title,
  comments,
  activeCommentId,
  mutationState,
  emptyMessage,
  onSelectComment,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
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
              <CommentItem
                comment={comment}
                isActive={comment.id === activeCommentId}
                mutationState={mutationState}
                onSelectComment={onSelectComment}
                onResolveComment={onResolveComment}
                onReopenComment={onReopenComment}
                onDeleteComment={onDeleteComment}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type ItemProps = Readonly<{
  comment: Comment;
  isActive: boolean;
  mutationState: CommentMutationState;
  onSelectComment: (commentId: CommentId) => void;
  onResolveComment: (commentId: CommentId) => void;
  onReopenComment: (commentId: CommentId) => void;
  onDeleteComment: (commentId: CommentId) => void;
}>;

/** @returns A compact comment preview with status and destructive actions. */
function CommentItem({
  comment,
  isActive,
  mutationState,
  onSelectComment,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
}: ItemProps) {
  const isMutatingComment =
    mutationState.status === "saving" && mutationState.commentId === comment.id;
  const statusClassName = comment.resolved
    ? "comment-sidebar__status comment-sidebar__status--resolved"
    : "comment-sidebar__status";
  const actionLabel = comment.resolved ? "Reopen" : "Resolve";
  const actionAriaLabel = `${actionLabel} comment ${comment.id}`;

  return (
    <article
      className="comment-sidebar__item"
      data-active={isActive ? "true" : "false"}
    >
      <button
        className="comment-sidebar__item-main"
        type="button"
        aria-current={isActive ? "true" : undefined}
        aria-label={`Select comment ${comment.id}`}
        onClick={() => {
          onSelectComment(comment.id);
        }}
      >
        <span className={statusClassName}>
          {comment.resolved ? "Resolved" : "Open"}
        </span>
        <span className="comment-sidebar__body">{comment.body}</span>
        <span className="comment-sidebar__anchor">
          {comment.anchor.textSnippet}
        </span>
        <time
          className="comment-sidebar__timestamp"
          dateTime={comment.updatedAt}
        >
          {formatCommentTimestamp(comment.updatedAt)}
        </time>
      </button>
      <div className="comment-sidebar__actions">
        <button
          className="icon-button"
          type="button"
          aria-label={actionAriaLabel}
          disabled={isMutatingComment}
          onClick={() => {
            if (comment.resolved) {
              onReopenComment(comment.id);
              return;
            }

            onResolveComment(comment.id);
          }}
        >
          {comment.resolved ? (
            <RotateCcw aria-hidden="true" size={16} />
          ) : (
            <CheckCircle2 aria-hidden="true" size={16} />
          )}
        </button>
        <button
          className="icon-button icon-button--danger"
          type="button"
          aria-label={`Delete comment ${comment.id}`}
          disabled={isMutatingComment}
          onClick={() => {
            onDeleteComment(comment.id);
          }}
        >
          <Trash2 aria-hidden="true" size={16} />
        </button>
      </div>
    </article>
  );
}

/** @returns Comments split by open and resolved display sections. */
function groupCommentsByStatus(comments: readonly Comment[]): CommentGroups {
  return {
    openComments: comments.filter((comment) => !comment.resolved),
    resolvedComments: comments.filter((comment) => comment.resolved),
  };
}

/** @returns A readable local timestamp, falling back to the raw ISO value. */
function formatCommentTimestamp(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.valueOf())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
