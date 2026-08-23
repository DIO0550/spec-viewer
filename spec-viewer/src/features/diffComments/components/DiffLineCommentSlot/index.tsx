import { type ReactElement, useRef } from "react";

import {
  DiffCommentComposer,
  type DiffCommentDisabledReason,
} from "@/features/diffComments/components/DiffCommentComposer";
import {
  DiffLineCommentControl,
  type DiffLineCommentSummary,
  type DiffLineCommentTarget,
} from "@/features/diffComments/components/DiffLineCommentControl";

export type DiffLineCommentDraft = Readonly<{
  target: DiffLineCommentTarget;
  body: string;
  isSaving: boolean;
  canSubmit?: boolean;
  disabledReason?: DiffCommentDisabledReason | null;
  canRetry?: boolean;
  canReanchor?: boolean;
  isDurabilityUncertain?: boolean;
  origin: HTMLElement | null;
  statusMessage?: string | null;
  errorMessage?: string | null;
}>;

export type DiffCommentJumpTarget = DiffLineCommentTarget &
  Readonly<{ requestId: number }>;

export type DiffLineCommentsController = Readonly<{
  commentsByTarget: Readonly<
    Record<string, readonly DiffLineCommentSummary[] | undefined>
  >;
  activeCommentId: string | null;
  draft: DiffLineCommentDraft | null;
  onStartDraft: (
    target: DiffLineCommentTarget,
    origin: HTMLButtonElement,
  ) => void;
  onDraftBodyChange: (body: string) => void;
  onCancelDraft: () => void;
  onSubmitDraft: (target: DiffLineCommentTarget, body: string) => void;
  onSelectComment: (commentId: string) => void;
  onRetryDraft?: () => void;
  onReanchorDraft?: (target: DiffLineCommentTarget) => void;
}>;

/**
 * Renders the control and active inline composer for one semantic target.
 *
 * @param props - Target and workspace-wide controlled comment state.
 * @returns The target control followed by its composer when active.
 */
export function DiffLineCommentSlot(
  props: Readonly<{
    target: DiffLineCommentTarget;
    controller: DiffLineCommentsController;
  }>,
): ReactElement {
  const comments = props.controller.commentsByTarget[props.target.key] ?? [];
  const draft = props.controller.draft;
  const isActiveDraft = draft?.target.key === props.target.key;
  const slotRef = useRef<HTMLDivElement>(null);
  const mountedOrigin =
    draft?.origin?.isConnected === true
      ? draft.origin
      : (slotRef.current?.querySelector<HTMLButtonElement>(
          ".diff-line-comment-control",
        ) ?? null);
  const draftLineLabel =
    draft?.target.endLine === undefined ||
    draft.target.endLine === draft.target.line
      ? `${draft?.target.line ?? props.target.line}行目`
      : `${draft.target.line}–${draft.target.endLine}行目`;

  return (
    <div
      ref={slotRef}
      className="diff-line-comment-slot"
      data-comment-target-key={props.target.key}
      data-draft-active={isActiveDraft ? "true" : undefined}
    >
      <DiffLineCommentControl
        target={props.target}
        comments={comments}
        activeCommentId={props.controller.activeCommentId}
        onStartDraft={props.controller.onStartDraft}
        onSelectComment={props.controller.onSelectComment}
      />
      {isActiveDraft && draft !== null ? (
        <DiffCommentComposer
          id={`diff-comment-composer-${createControlId(props.target.key)}`}
          label={`${props.target.sidePath} ${props.target.side} ${draftLineLabel}へのコメント`}
          body={draft.body}
          isSaving={draft.isSaving}
          origin={mountedOrigin}
          statusMessage={draft.statusMessage}
          canSubmit={draft.canSubmit ?? true}
          disabledReason={draft.disabledReason ?? null}
          isDurabilityUncertain={draft.isDurabilityUncertain ?? false}
          errorMessage={draft.errorMessage}
          onBodyChange={props.controller.onDraftBodyChange}
          onCancel={() => {
            const currentOrigin =
              slotRef.current?.querySelector<HTMLButtonElement>(
                ".diff-line-comment-control",
              ) ?? null;
            props.controller.onCancelDraft();
            requestAnimationFrame(() => {
              currentOrigin?.focus({ preventScroll: true });
            });
          }}
          onRetry={
            draft.canRetry === true ? props.controller.onRetryDraft : undefined
          }
          onReanchor={
            draft.canReanchor === true &&
            props.controller.onReanchorDraft !== undefined
              ? () => props.controller.onReanchorDraft?.(draft.target)
              : undefined
          }
          onSubmit={(body) =>
            props.controller.onSubmitDraft(props.target, body)
          }
        />
      ) : null}
    </div>
  );
}

/**
 * Renders unresolved comments as a persistent thread below their Diff line.
 *
 * @param props - Semantic target and workspace-wide controlled comment state.
 * @returns The unresolved thread, or null when the line has no open comments.
 */
export function DiffInlineCommentThread(
  props: Readonly<{
    target: DiffLineCommentTarget;
    controller: DiffLineCommentsController;
  }>,
): ReactElement | null {
  const comments = props.controller.commentsByTarget[props.target.key] ?? [];
  if (comments.length === 0) {
    return null;
  }

  return (
    <ol
      className="diff-inline-comment-thread"
      aria-label={`${props.target.sidePath} ${props.target.line}行目の未解決コメント`}
    >
      {comments.map((comment) => (
        <li key={comment.id}>
          <button
            type="button"
            className="diff-inline-comment-thread__comment"
            aria-current={
              comment.id === props.controller.activeCommentId
                ? "true"
                : undefined
            }
            onClick={() => props.controller.onSelectComment(comment.id)}
          >
            <span className="diff-inline-comment-thread__header">
              <span
                className="diff-inline-comment-thread__avatar"
                aria-hidden="true"
              >
                R
              </span>
              <strong>Review</strong>
              <time dateTime={comment.createdAt}>
                {formatCommentTimestamp(comment.createdAt)}
              </time>
            </span>
            <span className="diff-inline-comment-thread__body">
              {comment.label}
            </span>
            <span className="diff-inline-comment-thread__footer">
              スレッドを表示
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
/**
 * @param createdAt - Persisted ISO comment timestamp.
 * @returns A compact locale timestamp for the inline thread header.
 */
function formatCommentTimestamp(createdAt: string): string {
  const timestamp = new Date(createdAt);
  if (Number.isNaN(timestamp.getTime())) {
    return createdAt;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}
/** Produces a document-safe ID from an opaque semantic target key. */
function createControlId(targetKey: string): string {
  return targetKey.replace(/[^a-zA-Z0-9_-]/g, "-");
}
