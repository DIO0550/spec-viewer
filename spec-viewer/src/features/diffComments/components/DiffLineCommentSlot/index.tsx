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

  return (
    <div
      ref={slotRef}
      className="diff-line-comment-slot"
      data-comment-target-key={props.target.key}
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
          label={`${props.target.sidePath} ${props.target.side} ${props.target.line}行目へのコメント`}
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
              ? () => props.controller.onReanchorDraft?.(props.target)
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

/** Produces a document-safe ID from an opaque semantic target key. */
function createControlId(targetKey: string): string {
  return targetKey.replace(/[^a-zA-Z0-9_-]/g, "-");
}
