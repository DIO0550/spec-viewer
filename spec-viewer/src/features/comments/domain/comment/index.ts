import type {
  BlockType,
  CommentAnchor,
} from "@/features/comments/domain/commentAnchor";
import type { CommentBody } from "@/features/comments/domain/commentBody";
import {
  type CommentStatus,
  CommentStatusFilter,
  type CommentStatusFilter as CommentStatusFilterType,
} from "@/features/comments/domain/commentStatusFilter";
import type { CommentId } from "@/shared/domain/commentId";
import {
  IsoDateTime,
  type IsoDateTime as IsoDateTimeType,
} from "@/shared/domain/isoDateTime";

declare const commentBrand: unique symbol;

export type CommentAnchorResolutionStatus =
  | "resolved"
  | "moved"
  | "fuzzy"
  | "orphaned";

export type CommentAnchorResolutionReason =
  | "exact_match"
  | "moved_by_hash"
  | "stale_snippet"
  | "fuzzy_match"
  | "missing_original_block"
  | "ambiguous_fuzzy_candidates"
  | "below_threshold"
  | "deleted_text"
  | "unsupported_block_type";

export type CommentAnchorResolutionTarget = Readonly<{
  blockType: BlockType;
  blockIndex: number;
  textHash: string;
  textSnippet: string;
  sourceRange: Readonly<{
    startByteOffset: number;
    endByteOffset: number;
  }> | null;
  score: number;
}>;

export type CommentAnchorResolution = Readonly<{
  status: CommentAnchorResolutionStatus;
  reason: CommentAnchorResolutionReason;
  details: string | null;
  target: CommentAnchorResolutionTarget | null;
}>;

export type Comment = Readonly<{
  id: CommentId;
  anchor: CommentAnchor;
  body: CommentBody;
  status: CommentStatus;
  anchorResolution: CommentAnchorResolution | null;
  createdAt: IsoDateTimeType;
  updatedAt: IsoDateTimeType;
  readonly [commentBrand]: "Comment";
}>;

export type CreateCommentInput = Readonly<{
  id: CommentId;
  anchor: CommentAnchor;
  body: CommentBody;
  anchorResolution?: CommentAnchorResolution | null;
  createdAt: IsoDateTimeType;
}>;

export type RestoreCommentInput = Readonly<{
  id: CommentId;
  anchor: CommentAnchor;
  body: CommentBody;
  status: CommentStatus;
  anchorResolution: CommentAnchorResolution | null;
  createdAt: IsoDateTimeType;
  updatedAt: IsoDateTimeType;
}>;

export type CommentTimestampOrderError =
  | Readonly<{
      reason: "updatedAtBeforeCreatedAt";
      createdAt: IsoDateTimeType;
      updatedAt: IsoDateTimeType;
    }>
  | Readonly<{
      reason: "updatedAtBeforePreviousUpdate";
      previousUpdatedAt: IsoDateTimeType;
      updatedAt: IsoDateTimeType;
    }>;

export type CommentResult =
  | Readonly<{ ok: true; value: Comment }>
  | Readonly<{ ok: false; error: CommentTimestampOrderError }>;

export type UpdateCommentBodyInput = Readonly<{
  body: CommentBody;
  updatedAt: IsoDateTimeType;
}>;

export type ChangeCommentStatusInput = Readonly<{
  updatedAt: IsoDateTimeType;
}>;

export type ReconcileCommentCreationInput = Readonly<{
  anchor: CommentAnchor;
  body: CommentBody;
}>;

export type CommentRevisionExpectation =
  | Readonly<{ kind: "update"; body: CommentBody }>
  | Readonly<{ kind: "resolve" }>
  | Readonly<{ kind: "reopen" }>
  | Readonly<{ kind: "toggle"; status: CommentStatus }>;

export type CommentReconciliationError =
  | Readonly<{
      reason: "commentIdMismatch";
      expected: CommentId;
      actual: CommentId;
    }>
  | Readonly<{
      reason: "createdAtMismatch";
      expected: IsoDateTimeType;
      actual: IsoDateTimeType;
    }>
  | Readonly<{
      reason: "anchorMismatch";
      expected: CommentAnchor;
      actual: CommentAnchor;
    }>
  | Readonly<{
      reason: "updatedAtBeforePreviousUpdate";
      previousUpdatedAt: IsoDateTimeType;
      updatedAt: IsoDateTimeType;
    }>
  | Readonly<{
      reason: "bodyMismatch";
      expected: CommentBody;
      actual: CommentBody;
    }>
  | Readonly<{
      reason: "statusMismatch";
      expected: CommentStatus;
      actual: CommentStatus;
    }>
  | Readonly<{
      reason: "creationTimestampMismatch";
      createdAt: IsoDateTimeType;
      updatedAt: IsoDateTimeType;
    }>;

export type CommentReconciliationResult =
  | Readonly<{ ok: true; value: Comment }>
  | Readonly<{ ok: false; error: CommentReconciliationError }>;

export const Comment = {
  /**
   * @param input - Validated values for a new comment.
   * @returns A new open comment whose creation and update timestamps match.
   */
  create(input: CreateCommentInput): Comment {
    return toComment({
      ...input,
      status: "open",
      anchorResolution: input.anchorResolution ?? null,
      updatedAt: input.createdAt,
    });
  },

  /**
   * @param input - Validated persisted or transport values.
   * @returns A restored comment, or a timestamp-order error.
   */
  restore(input: RestoreCommentInput): CommentResult {
    if (IsoDateTime.compare(input.updatedAt, input.createdAt) < 0) {
      return {
        ok: false,
        error: {
          reason: "updatedAtBeforeCreatedAt",
          createdAt: input.createdAt,
          updatedAt: input.updatedAt,
        },
      };
    }

    return { ok: true, value: toComment(input) };
  },

  /**
   * @param response - Decoded add response.
   * @param input - Anchor and body submitted by the caller.
   * @returns A created comment only when the response preserves the create contract.
   */
  reconcileCreation(
    response: Comment,
    input: ReconcileCommentCreationInput,
  ): CommentReconciliationResult {
    if (!anchorsEqual(response.anchor, input.anchor)) {
      return reconciliationFailure({
        reason: "anchorMismatch",
        expected: input.anchor,
        actual: response.anchor,
      });
    }
    if (response.body !== input.body) {
      return reconciliationFailure({
        reason: "bodyMismatch",
        expected: input.body,
        actual: response.body,
      });
    }
    if (response.status !== "open") {
      return reconciliationFailure({
        reason: "statusMismatch",
        expected: "open",
        actual: response.status,
      });
    }
    if (response.updatedAt !== response.createdAt) {
      return reconciliationFailure({
        reason: "creationTimestampMismatch",
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      });
    }

    return { ok: true, value: toComment(response) };
  },

  /**
   * @param current - Latest aggregate in the active collection.
   * @param response - Decoded command response.
   * @param expectation - Operation-specific mutable field contract.
   * @returns A reconciled revision or its first invariant mismatch.
   */
  reconcileRevision(
    current: Comment,
    response: Comment,
    expectation: CommentRevisionExpectation,
  ): CommentReconciliationResult {
    if (response.id !== current.id) {
      return reconciliationFailure({
        reason: "commentIdMismatch",
        expected: current.id,
        actual: response.id,
      });
    }
    if (response.createdAt !== current.createdAt) {
      return reconciliationFailure({
        reason: "createdAtMismatch",
        expected: current.createdAt,
        actual: response.createdAt,
      });
    }
    if (!anchorsEqual(response.anchor, current.anchor)) {
      return reconciliationFailure({
        reason: "anchorMismatch",
        expected: current.anchor,
        actual: response.anchor,
      });
    }
    if (IsoDateTime.compare(response.updatedAt, current.updatedAt) < 0) {
      return reconciliationFailure({
        reason: "updatedAtBeforePreviousUpdate",
        previousUpdatedAt: current.updatedAt,
        updatedAt: response.updatedAt,
      });
    }

    const expected = expectedRevisionFields(current, expectation);
    if (response.body !== expected.body) {
      return reconciliationFailure({
        reason: "bodyMismatch",
        expected: expected.body,
        actual: response.body,
      });
    }
    if (response.status !== expected.status) {
      return reconciliationFailure({
        reason: "statusMismatch",
        expected: expected.status,
        actual: response.status,
      });
    }

    return {
      ok: true,
      value: Comment.preserveAnchorResolution(current, toComment(response)),
    };
  },

  /**
   * @param left - First comment aggregate.
   * @param right - Second comment aggregate.
   * @returns True when persisted fields match, excluding derived anchor resolution metadata.
   */
  hasSamePersistedState(left: Comment, right: Comment): boolean {
    if (left.id !== right.id || left.body !== right.body) {
      return false;
    }
    if (left.status !== right.status || left.createdAt !== right.createdAt) {
      return false;
    }
    if (left.updatedAt !== right.updatedAt) {
      return false;
    }

    return anchorsEqual(left.anchor, right.anchor);
  },

  /**
   * @param comment - Comment to evaluate.
   * @returns True when the comment is unresolved.
   */
  isOpen(comment: Pick<Comment, "status">): boolean {
    return comment.status === "open";
  },

  /**
   * @param comment - Comment to evaluate.
   * @returns True when the comment is resolved.
   */
  isResolved(comment: Pick<Comment, "status">): boolean {
    return comment.status === "resolved";
  },

  /**
   * @param comment - Existing comment.
   * @param input - Validated replacement body and authoritative update time.
   * @returns Updated comment, or an error when time would move backwards.
   */
  updateBody(comment: Comment, input: UpdateCommentBodyInput): CommentResult {
    return changeComment(comment, input.updatedAt, { body: input.body });
  },

  /**
   * @param comment - Existing comment.
   * @param input - Authoritative update time.
   * @returns Resolved comment, or an error when time would move backwards.
   */
  resolve(comment: Comment, input: ChangeCommentStatusInput): CommentResult {
    return changeComment(comment, input.updatedAt, { status: "resolved" });
  },

  /**
   * @param comment - Existing comment.
   * @param input - Authoritative update time.
   * @returns Reopened comment, or an error when time would move backwards.
   */
  reopen(comment: Comment, input: ChangeCommentStatusInput): CommentResult {
    return changeComment(comment, input.updatedAt, { status: "open" });
  },

  /**
   * @param current - Existing comment in local state.
   * @param next - Incoming authoritative command result.
   * @returns Incoming comment with a known anchor resolution preserved when omitted.
   */
  preserveAnchorResolution(
    current: Comment | undefined,
    next: Comment,
  ): Comment {
    if (next.anchorResolution !== null) {
      return next;
    }
    if (current === undefined || current.anchorResolution === null) {
      return next;
    }

    return toComment({
      ...next,
      anchorResolution: current.anchorResolution,
    });
  },

  /**
   * @param comment - Comment to evaluate.
   * @param statusFilter - Active status filter.
   * @returns True when the filter includes the comment.
   */
  matchesStatusFilter(
    comment: Comment,
    statusFilter: CommentStatusFilterType,
  ): boolean {
    return CommentStatusFilter.matches(statusFilter, comment.status);
  },
} as const;

/**
 * @param comment - Existing comment.
 * @param updatedAt - Proposed update time.
 * @param changes - Aggregate fields changed by the operation.
 * @returns Updated comment, or an error when time would move backwards.
 */
function changeComment(
  comment: Comment,
  updatedAt: IsoDateTimeType,
  changes: Partial<Pick<Comment, "body" | "status">>,
): CommentResult {
  if (IsoDateTime.compare(updatedAt, comment.updatedAt) < 0) {
    return {
      ok: false,
      error: {
        reason: "updatedAtBeforePreviousUpdate",
        previousUpdatedAt: comment.updatedAt,
        updatedAt,
      },
    };
  }

  return {
    ok: true,
    value: toComment({ ...comment, ...changes, updatedAt }),
  };
}

/**
 * @param error - First invariant mismatch found while reconciling.
 * @returns A failed response reconciliation result.
 */
function reconciliationFailure(
  error: CommentReconciliationError,
): CommentReconciliationResult {
  return { ok: false, error };
}

/**
 * @param current - Latest accepted aggregate.
 * @param expectation - Operation-specific response contract.
 * @returns Mutable fields permitted by the requested operation.
 */
function expectedRevisionFields(
  current: Comment,
  expectation: CommentRevisionExpectation,
): Readonly<{ body: CommentBody; status: CommentStatus }> {
  if (expectation.kind === "update") {
    return { body: expectation.body, status: current.status };
  }
  if (expectation.kind === "resolve") {
    return { body: current.body, status: "resolved" };
  }
  if (expectation.kind === "reopen") {
    return { body: current.body, status: "open" };
  }

  return { body: current.body, status: expectation.status };
}

/**
 * @param left - First validated anchor.
 * @param right - Second validated anchor.
 * @returns True when every persisted anchor field is equal.
 */
function anchorsEqual(left: CommentAnchor, right: CommentAnchor): boolean {
  if (left.fileKey !== right.fileKey) {
    return false;
  }
  if (left.blockType !== right.blockType) {
    return false;
  }
  if (left.blockIndex !== right.blockIndex) {
    return false;
  }
  if (left.textHash !== right.textHash) {
    return false;
  }
  if (left.textSnippet !== right.textSnippet) {
    return false;
  }
  if (left.charRange.start !== right.charRange.start) {
    return false;
  }

  return left.charRange.end === right.charRange.end;
}

/**
 * @param fields - Validated aggregate fields.
 * @returns Branded Comment aggregate.
 */
function toComment(fields: Omit<Comment, typeof commentBrand>): Comment {
  return {
    id: fields.id,
    anchor: copyAnchor(fields.anchor),
    body: fields.body,
    status: fields.status,
    anchorResolution: copyAnchorResolution(fields.anchorResolution),
    createdAt: fields.createdAt,
    updatedAt: fields.updatedAt,
  } as Comment;
}

/**
 * @param anchor - Validated anchor to detach.
 * @returns A detached copy of a validated comment anchor.
 */
function copyAnchor(anchor: CommentAnchor): CommentAnchor {
  return {
    fileKey: anchor.fileKey,
    blockType: anchor.blockType,
    blockIndex: anchor.blockIndex,
    textHash: anchor.textHash,
    textSnippet: anchor.textSnippet,
    charRange: {
      start: anchor.charRange.start,
      end: anchor.charRange.end,
    },
  } as CommentAnchor;
}

/**
 * @param resolution - Optional resolution metadata to detach.
 * @returns A detached copy of an optional anchor resolution.
 */
function copyAnchorResolution(
  resolution: CommentAnchorResolution | null,
): CommentAnchorResolution | null {
  if (resolution === null) {
    return null;
  }

  return {
    status: resolution.status,
    reason: resolution.reason,
    details: resolution.details,
    target: copyResolutionTarget(resolution.target),
  };
}

/**
 * @param target - Optional resolution target to detach.
 * @returns A detached copy of an optional anchor resolution target.
 */
function copyResolutionTarget(
  target: CommentAnchorResolutionTarget | null,
): CommentAnchorResolutionTarget | null {
  if (target === null) {
    return null;
  }

  return {
    blockType: target.blockType,
    blockIndex: target.blockIndex,
    textHash: target.textHash,
    textSnippet: target.textSnippet,
    sourceRange: copySourceRange(target.sourceRange),
    score: target.score,
  };
}

/**
 * @param sourceRange - Optional source range to detach.
 * @returns A detached copy of an optional source range.
 */
function copySourceRange(
  sourceRange: CommentAnchorResolutionTarget["sourceRange"],
): CommentAnchorResolutionTarget["sourceRange"] {
  if (sourceRange === null) {
    return null;
  }

  return {
    startByteOffset: sourceRange.startByteOffset,
    endByteOffset: sourceRange.endByteOffset,
  };
}
