import { type ReactElement, useEffect, useMemo, useRef } from "react";

import { ReviewComment } from "@/features/comments/components/ReviewComment";

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
  mutatingCommentId?: string | null;
  mutationDisabledReason?:
    | "revisionOverflow"
    | "permission"
    | "invalidStore"
    | null;
  onJump: (commentId: string) => void;
  onResolve: (commentId: string) => void;
  onReopen: (commentId: string) => void;
}>;

const FilterLabels = {
  open: "Open",
  resolved: "Resolved",
  all: "All",
} as const satisfies Record<DiffReviewFilter, string>;

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
        <p role="status">条件に一致するコメントはありません</p>
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
                searchQuery={props.search}
                selectionLabel={`${comment.locationLabel}のコメントを選択`}
                selectionRef={(element) => {
                  if (element === null) {
                    selectRefs.current.delete(comment.id);
                  } else {
                    selectRefs.current.set(comment.id, element);
                  }
                }}
                onSelect={props.onSelectComment}
                onUpdate={props.onUpdate ?? (() => undefined)}
                onResolve={props.onResolve}
                onReopen={props.onReopen}
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
      props.onReopen,
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
        <h2>Review</h2>
        <div role="group" aria-label="コメント状態">
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
        </div>
        <label>
          コメントを検索
          <input
            type="search"
            value={props.search}
            onInput={(event) => props.onSearchChange(event.currentTarget.value)}
          />
        </label>
        {props.onReload === undefined ? null : (
          <button type="button" onClick={props.onReload}>
            Diff commentsを再読み込み
          </button>
        )}
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
