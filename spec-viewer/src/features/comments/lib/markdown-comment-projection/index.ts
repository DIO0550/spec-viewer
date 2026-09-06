import {
  createRenderedBlockKey,
  readRenderedBlockModel,
  type RenderedBlockType,
} from "@/features/specs";
import type { Comment } from "@/features/comments/domain/comment";
import type {
  CommentAnchor,
  CommentBlockType,
} from "@/features/comments/domain/commentAnchor";
import type { CommentId } from "@/features/comments/domain/commentId";
import type {
  CommentAnchorDisplayState,
  CommentAnchorDisplayStatus,
} from "@/features/comments/types/comment";

export type MarkdownCommentRangeProjection = Readonly<{
  commentId: CommentId;
  start: number;
  end: number;
  state: "open" | "active";
}>;

export type MarkdownCommentAnnotationProjection = Readonly<{
  comment: Comment;
  anchorDisplayStatus: CommentAnchorDisplayStatus;
  isActive: boolean;
}>;

export type MarkdownCommentProjection = Readonly<{
  commentIds: readonly CommentId[];
  selectedCommentId: CommentId;
  state: "open" | "active" | "stale" | "moved" | "fuzzy";
  ranges: readonly MarkdownCommentRangeProjection[];
  annotations: readonly MarkdownCommentAnnotationProjection[];
}>;

type ProjectionOptions = Readonly<{
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  anchorDisplayStates: readonly CommentAnchorDisplayState[];
}>;

const renderedBlockTypeByCommentBlockType: Partial<
  Readonly<Record<CommentBlockType, RenderedBlockType>>
> = {
  heading: "heading",
  paragraph: "paragraph",
  block_quote: "paragraph",
  list_item: "list-item",
  table: "table",
  code_block: "code",
};

/**
 * Projects unresolved comments onto stable rendered block keys.
 * @param options - Comments, active selection, and current anchor states.
 * @returns Immutable block projections keyed by rendered block identity.
 */
export function createMarkdownCommentProjections({
  comments,
  activeCommentId,
  anchorDisplayStates,
}: ProjectionOptions): ReadonlyMap<string, MarkdownCommentProjection> {
  const displayStatusByCommentId = new Map(
    anchorDisplayStates.map(
      (state) => [state.commentId, state.status] as const,
    ),
  );
  const commentsByBlock = new Map<string, Comment[]>();

  for (const comment of comments) {
    if (
      comment.status === "resolved" ||
      comment.anchorResolution?.status === "orphaned"
    ) {
      continue;
    }

    const key = createCommentProjectionKey(comment);

    if (key === null) {
      continue;
    }

    const blockComments = commentsByBlock.get(key) ?? [];
    blockComments.push(comment);
    commentsByBlock.set(key, blockComments);
  }

  return new Map(
    Array.from(commentsByBlock, ([key, blockComments]) => [
      key,
      createBlockProjection({
        comments: blockComments,
        activeCommentId,
        displayStatusByCommentId,
      }),
    ]),
  );
}

/**
 * Resolves every persisted comment anchor against the committed rendered DOM.
 * @param options - Comments and the rendered Markdown root.
 * @returns Display states in the same order as the comments.
 */
export function createCommentAnchorDisplayStates({
  comments,
  renderedRoot,
}: Readonly<{
  comments: readonly Comment[];
  renderedRoot: HTMLElement | null;
}>): readonly CommentAnchorDisplayState[] {
  if (renderedRoot === null) {
    return [];
  }

  return comments.map((comment) => ({
    commentId: comment.id,
    status: resolveAnchorDisplayStatus(comment, renderedRoot),
  }));
}

/**
 * Finds the rendered block used when navigating to a comment.
 * @param options - Persisted comment and current rendered root.
 * @returns The resolution target, original target, or null when unavailable.
 */
export function findCommentScrollTarget({
  comment,
  renderedRoot,
}: Readonly<{
  comment: Comment;
  renderedRoot: HTMLElement | null;
}>): HTMLElement | null {
  if (
    renderedRoot === null ||
    comment.anchorResolution?.status === "orphaned"
  ) {
    return null;
  }

  const target = comment.anchorResolution?.target;

  if (target !== undefined && target !== null) {
    return findRenderedBlock({ anchor: target, renderedRoot });
  }

  return findRenderedBlock({ anchor: comment.anchor, renderedRoot });
}

/**
 * Compares ordered anchor display reports without exposing hook state details.
 * @param current - Previously reported states.
 * @param next - Newly reconciled states.
 * @returns Whether both reports contain identical ordered entries.
 */
export function areCommentAnchorDisplayStatesEqual(
  current: readonly CommentAnchorDisplayState[],
  next: readonly CommentAnchorDisplayState[],
): boolean {
  if (current.length !== next.length) {
    return false;
  }

  return current.every(
    (state, index) =>
      state.commentId === next[index]?.commentId &&
      state.status === next[index]?.status,
  );
}

/** @returns A block projection for comments sharing one rendered target. */
function createBlockProjection({
  comments,
  activeCommentId,
  displayStatusByCommentId,
}: Readonly<{
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  displayStatusByCommentId: ReadonlyMap<CommentId, CommentAnchorDisplayStatus>;
}>): MarkdownCommentProjection {
  const selectedComment =
    comments.find((comment) => comment.id === activeCommentId) ?? comments[0];

  return {
    commentIds: comments.map((comment) => comment.id),
    selectedCommentId: selectedComment.id,
    state: selectProjectionState({
      comments,
      activeCommentId,
      displayStatusByCommentId,
    }),
    ranges: createRangeProjections({
      comments,
      activeCommentId,
      displayStatusByCommentId,
    }),
    annotations: comments.map((comment) => ({
      comment,
      anchorDisplayStatus: displayStatusByCommentId.get(comment.id) ?? "exact",
      isActive: comment.id === activeCommentId,
    })),
  };
}

/** @returns The stable rendered key targeted by a comment resolution or anchor. */
function createCommentProjectionKey(comment: Comment): string | null {
  const target = comment.anchorResolution?.target ?? comment.anchor;
  const renderedType = mapCommentBlockType(target.blockType);

  if (renderedType === null) {
    return null;
  }

  return createRenderedBlockKey(renderedType, target.blockIndex);
}

/** @returns Visual block state with active and degraded anchors taking precedence. */
function selectProjectionState({
  comments,
  activeCommentId,
  displayStatusByCommentId,
}: Readonly<{
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  displayStatusByCommentId: ReadonlyMap<CommentId, CommentAnchorDisplayStatus>;
}>): MarkdownCommentProjection["state"] {
  if (comments.some((comment) => comment.id === activeCommentId)) {
    return "active";
  }

  const precedence = ["stale", "moved", "fuzzy"] as const;

  for (const status of precedence) {
    if (
      comments.some(
        (comment) => displayStatusByCommentId.get(comment.id) === status,
      )
    ) {
      return status;
    }
  }

  return "open";
}

/** @returns Reliable exact text ranges eligible for inline decoration. */
function createRangeProjections({
  comments,
  activeCommentId,
  displayStatusByCommentId,
}: Readonly<{
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  displayStatusByCommentId: ReadonlyMap<CommentId, CommentAnchorDisplayStatus>;
}>): readonly MarkdownCommentRangeProjection[] {
  return comments.flatMap((comment) => {
    const range = comment.anchor.charRange;
    const isReliable =
      displayStatusByCommentId.get(comment.id) === "exact" &&
      comment.anchor.blockType !== "code_block" &&
      range.end > range.start;

    if (!isReliable) {
      return [];
    }

    return [
      {
        commentId: comment.id,
        start: range.start,
        end: range.end,
        state: comment.id === activeCommentId ? "active" : "open",
      },
    ];
  });
}

/** @returns The current display status for one comment anchor. */
function resolveAnchorDisplayStatus(
  comment: Comment,
  renderedRoot: HTMLElement,
): CommentAnchorDisplayStatus {
  const resolution = comment.anchorResolution;

  if (resolution?.status === "orphaned") {
    return "orphaned";
  }

  const target = findCommentScrollTarget({ comment, renderedRoot });

  if (target === null) {
    return resolution === undefined || resolution === null
      ? "orphaned"
      : "stale";
  }

  if (resolution !== undefined && resolution !== null) {
    return resolution.status === "resolved" ? "exact" : resolution.status;
  }

  const model = readRenderedBlockModel(target);

  if (model === null) {
    return "stale";
  }

  return model.metadata.textHash === comment.anchor.textHash
    ? "exact"
    : "stale";
}

/** @returns A validated rendered element matching one anchor-like target. */
function findRenderedBlock({
  anchor,
  renderedRoot,
}: Readonly<{
  anchor: Pick<CommentAnchor, "blockType" | "blockIndex">;
  renderedRoot: HTMLElement;
}>): HTMLElement | null {
  const renderedType = mapCommentBlockType(anchor.blockType);

  if (renderedType === null) {
    return null;
  }

  const element = renderedRoot.querySelector<HTMLElement>(
    `[data-block-type="${renderedType}"][data-block-index="${anchor.blockIndex}"]`,
  );

  if (element === null) {
    return null;
  }

  return readRenderedBlockModel(element) === null ? null : element;
}

/** @returns The rendered kind corresponding to a persisted comment block type. */
function mapCommentBlockType(
  blockType: CommentBlockType,
): RenderedBlockType | null {
  return renderedBlockTypeByCommentBlockType[blockType] ?? null;
}
