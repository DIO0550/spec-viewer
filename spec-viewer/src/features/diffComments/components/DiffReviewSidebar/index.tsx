import { RefreshCw } from "lucide-react";
import {
  type FormEvent,
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ReviewComment } from "@/features/comments/components/ReviewComment";
import type { DiffCommentReply } from "@/features/diffComments";

export type DiffReviewFilter = "open" | "resolved" | "all";

export type DiffReviewResolution =
  | Readonly<{
      status: "exact" | "relocated";
      selectionPath?: string;
      sidePath?: string;
      side?: "base" | "current";
      line?: number;
    }>
  | Readonly<{ status: "stale"; reason: string }>
  | Readonly<{ status: "unavailable"; reason: string }>;

export type DiffReviewComment = Readonly<{
  id: string;
  body: string;
  status: "open" | "resolved";
  locationLabel: string;
  snippet: string;
  resolution: DiffReviewResolution;
  replies?: readonly DiffCommentReply[];
}>;

export type DiffReviewSidebarProps = Readonly<{
  comments: readonly DiffReviewComment[];
  filter: DiffReviewFilter;
  search: string;
  selectedCommentId: string | null;
  loadState: "idle" | "loading" | "ready" | "error";
  warnings: readonly string[];
  onFilterChange: (filter: DiffReviewFilter) => void;
  onSearchChange: (search: string) => void;
  onReload?: () => void;
  onSelectComment: (commentId: string) => void;
  onUpdate?: (
    commentId: string,
    body: string,
  ) => boolean | void | Promise<boolean | void>;
  onReply?: (
    commentId: string,
    body: string,
  ) => boolean | void | Promise<boolean | void>;
  mutatingCommentId?: string | null;
  mutationDisabledReason?:
    | "revisionOverflow"
    | "permission"
    | "invalidStore"
    | null;
  onJump: (commentId: string) => void;
  onResolve: (commentId: string) => void;
  onReopen: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
}>;

const FilterLabels = {
  open: "未解決",
  resolved: "解決済み",
  all: "すべて",
} as const satisfies Record<DiffReviewFilter, string>;

const DiffReviewLabels = {
  resolve: "解決",
  reopen: "再開",
} as const;

/**
 * Renders the controlled worktree-wide Diff Review list.
 *
 * @param props - Runtime comments, list controls, warnings, and card actions.
 * @returns Accessible filters, search, warning summary, and comment cards.
 */
export function DiffReviewSidebar(props: DiffReviewSidebarProps): ReactElement {
  const counts = useMemo(() => countComments(props.comments), [props.comments]);
  const visibleComments = useMemo(
    () => filterComments(props.comments, props.filter, props.search),
    [props.comments, props.filter, props.search],
  );
  const materializedComments = useMemo(
    () => materializeComments(visibleComments, props.selectedCommentId),
    [props.selectedCommentId, visibleComments],
  );
  const selectRefs = useRef(new Map<string, HTMLButtonElement>());
  const suppressSelectionFocusRef = useRef(false);
  const commentList = useMemo(
    () =>
      visibleComments.length === 0 ? (
        <p className="diff-review-sidebar__empty" role="status">
          条件に一致するコメントはありません
        </p>
      ) : (
        <ol className="diff-review-sidebar__list">
          {materializedComments.map((comment) => (
            <li key={comment.id}>
              <ReviewComment
                comment={{
                  id: comment.id,
                  body: comment.body,
                  status: comment.status,
                  title: comment.locationLabel,
                  snippet: comment.snippet,
                  resolutionLabel: getResolutionLabel(comment.resolution),
                  canJump: canJump(comment.resolution),
                }}
                isSelected={comment.id === props.selectedCommentId}
                isMutating={
                  comment.id === props.mutatingCommentId ||
                  (props.mutationDisabledReason !== null &&
                    props.mutationDisabledReason !== undefined)
                }
                labels={DiffReviewLabels}
                isCollapsible
                searchQuery={props.search}
                selectionLabel={`${comment.locationLabel}のコメントを選択`}
                selectionRef={(element) => {
                  if (element === null) {
                    selectRefs.current.delete(comment.id);
                  } else {
                    selectRefs.current.set(comment.id, element);
                  }
                }}
                footer={
                  <DiffCommentReplies
                    commentId={comment.id}
                    replies={comment.replies ?? []}
                    isMutating={
                      comment.id === props.mutatingCommentId ||
                      (props.mutationDisabledReason !== null &&
                        props.mutationDisabledReason !== undefined)
                    }
                    onReply={props.onReply}
                  />
                }
                onSelect={props.onSelectComment}
                onUpdate={props.onUpdate ?? (() => undefined)}
                onResolve={props.onResolve}
                onReopen={props.onReopen}
                onDelete={props.onDelete}
                onJump={(commentId) => {
                  suppressSelectionFocusRef.current = true;
                  props.onJump(commentId);
                }}
              />
            </li>
          ))}
        </ol>
      ),
    [
      materializedComments,
      props.mutatingCommentId,
      props.mutationDisabledReason,
      props.onJump,
      props.onReply,
      props.onReopen,
      props.onDelete,
      props.onResolve,
      props.onSelectComment,
      props.onUpdate,
      props.search,
      props.selectedCommentId,
      visibleComments.length,
    ],
  );

  useEffect(() => {
    if (props.selectedCommentId === null) {
      return;
    }
    if (suppressSelectionFocusRef.current) {
      suppressSelectionFocusRef.current = false;
      return;
    }
    const selected = selectRefs.current.get(props.selectedCommentId);
    selected?.scrollIntoView?.({ block: "nearest" });
    selected?.focus({ preventScroll: true });
  }, [props.selectedCommentId]);

  if (props.loadState === "loading") {
    return <p role="status">Diff commentsを読み込んでいます</p>;
  }
  if (props.loadState === "error") {
    return <p role="alert">Diff commentsを読み込めませんでした</p>;
  }

  return (
    <section
      className="diff-review-sidebar"
      aria-label="Diff Review"
      data-disabled-reason={props.mutationDisabledReason ?? undefined}
    >
      <header className="diff-review-sidebar__header">
        <div className="diff-review-sidebar__title">
          <h2>コメント</h2>
          <span className="diff-review-sidebar__summary">{counts.all}件</span>
        </div>
        <div className="diff-review-sidebar__controls">
          <fieldset className="diff-review-sidebar__filters">
            <legend className="visually-hidden">コメント状態</legend>
            {(["open", "resolved", "all"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                aria-pressed={props.filter === filter}
                onClick={() => props.onFilterChange(filter)}
              >
                {FilterLabels[filter]} {counts[filter]}
              </button>
            ))}
          </fieldset>
          <label className="diff-review-sidebar__search">
            <span className="visually-hidden">コメントを検索</span>
            <input
              type="search"
              placeholder="コメントを検索"
              value={props.search}
              onInput={(event) =>
                props.onSearchChange(event.currentTarget.value)
              }
            />
          </label>
          {props.onReload === undefined ? null : (
            <button
              type="button"
              className="icon-button diff-review-sidebar__reload"
              aria-label="コメントを再読み込み"
              title="コメントを再読み込み"
              onClick={props.onReload}
            >
              <RefreshCw aria-hidden="true" size={15} />
            </button>
          )}
        </div>
      </header>
      {props.warnings.length === 0 ? null : (
        <div className="diff-review-sidebar__warnings" role="status">
          {props.warnings.join("、")}
        </div>
      )}
      {commentList}
    </section>
  );
}

/** Counts open, resolved, and total comments. */
function countComments(
  comments: readonly DiffReviewComment[],
): Readonly<Record<DiffReviewFilter, number>> {
  const open = comments.filter((comment) => comment.status === "open").length;
  return { open, resolved: comments.length - open, all: comments.length };
}

/** Filters comments by controlled status and normalized search text. */
function filterComments(
  comments: readonly DiffReviewComment[],
  filter: DiffReviewFilter,
  search: string,
): readonly DiffReviewComment[] {
  const query = search.trim().toLocaleLowerCase();
  return comments.filter((comment) => {
    const matchesFilter = filter === "all" || comment.status === filter;
    if (!matchesFilter) {
      return false;
    }
    if (query.length === 0) {
      return true;
    }
    return [comment.body, comment.locationLabel, comment.snippet].some(
      (value) => value.toLocaleLowerCase().includes(query),
    );
  });
}

const MaterializedCommentLimit = 100;

/** Keeps Review DOM bounded while ensuring the selected comment is rendered. */
function materializeComments(
  comments: readonly DiffReviewComment[],
  selectedCommentId: string | null,
): readonly DiffReviewComment[] {
  if (comments.length <= MaterializedCommentLimit) {
    return comments;
  }
  const selectedIndex = comments.findIndex(
    (comment) => comment.id === selectedCommentId,
  );
  if (selectedIndex < 0) {
    return comments.slice(0, MaterializedCommentLimit);
  }
  const centeredStart = Math.max(
    selectedIndex - Math.floor(MaterializedCommentLimit / 2),
    0,
  );
  const start = Math.min(
    centeredStart,
    comments.length - MaterializedCommentLimit,
  );
  return comments.slice(start, start + MaterializedCommentLimit);
}

/** Returns whether a runtime resolution has a safe jump target. */
function canJump(resolution: DiffReviewResolution): boolean {
  return resolution.status === "exact" || resolution.status === "relocated";
}

/** Maps runtime resolution to non-color-only user copy. */
function getResolutionLabel(resolution: DiffReviewResolution): string {
  if (resolution.status === "exact") {
    return "現在の行";
  }
  if (resolution.status === "relocated") {
    return "移動した行";
  }
  if (resolution.status === "stale") {
    return `古いアンカー: ${resolution.reason}`;
  }
  if (resolution.status === "unavailable") {
    return `一時的に利用できません: ${resolution.reason}`;
  }
  return "現在の行";
}

type DiffCommentRepliesProps = Readonly<{
  commentId: string;
  replies: readonly DiffCommentReply[];
  isMutating: boolean;
  onReply?: (
    commentId: string,
    body: string,
  ) => boolean | void | Promise<boolean | void>;
}>;

/** Renders persisted replies and a conflict-safe reply composer. */
function DiffCommentReplies(props: DiffCommentRepliesProps): ReactElement {
  const [draft, setDraft] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const normalizedDraft = draft.trim();

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (
      props.onReply === undefined ||
      normalizedDraft.length === 0 ||
      isSubmitting
    ) {
      return;
    }
    setSubmitting(true);
    void Promise.resolve(props.onReply(props.commentId, normalizedDraft)).then(
      (isCommitted) => {
        setSubmitting(false);
        if (isCommitted === false) {
          editorRef.current?.focus({ preventScroll: true });
          return;
        }
        setDraft("");
      },
      () => {
        setSubmitting(false);
        editorRef.current?.focus({ preventScroll: true });
      },
    );
  };

  return (
    <section
      className="diff-comment-replies"
      aria-label={`返信 ${props.commentId}`}
    >
      {props.replies.length === 0 ? null : (
        <ol className="diff-comment-replies__list">
          {props.replies.map((reply) => (
            <li key={reply.id} className="diff-comment-replies__item">
              <p>{reply.body}</p>
              <time dateTime={reply.createdAt}>
                {new Date(reply.createdAt).toLocaleString()}
              </time>
            </li>
          ))}
        </ol>
      )}
      {props.onReply === undefined ? null : (
        <form className="diff-comment-replies__form" onSubmit={submit}>
          <label>
            <span className="visually-hidden">返信</span>
            <textarea
              ref={editorRef}
              aria-label={`返信本文 ${props.commentId}`}
              placeholder="返信を追加"
              value={draft}
              disabled={props.isMutating || isSubmitting}
              onInput={(event) => setDraft(event.currentTarget.value)}
            />
          </label>
          <button
            type="submit"
            aria-label={`返信を送信 ${props.commentId}`}
            disabled={
              props.isMutating || isSubmitting || normalizedDraft.length === 0
            }
          >
            返信
          </button>
        </form>
      )}
    </section>
  );
}
