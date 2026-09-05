import type { ReactElement } from "react";

import { CommentComposer } from "@/features/comments/components/CommentComposer";

export type DiffCommentDisabledReason =
  | "staleTarget"
  | "saving"
  | "revisionOverflow"
  | "permission"
  | "invalidStore"
  | "permanentFailure";

export type DiffCommentComposerProps = Readonly<{
  id: string;
  label: string;
  body: string;
  isSaving: boolean;
  canSubmit?: boolean;
  disabledReason?: DiffCommentDisabledReason | null;
  isDurabilityUncertain?: boolean;
  origin?: HTMLElement | null;
  statusMessage?: string | null;
  errorMessage?: string | null;
  onBodyChange: (body: string) => void;
  onCancel: () => void;
  onSubmit: (body: string) => void;
  onRetry?: () => void;
  onReanchor?: () => void;
}>;

/**
 * Adapts Diff-specific draft and recovery state to the shared comment form.
 *
 * @param props - Diff draft text, mutation state, focus origin, and actions.
 * @returns The shared comment form with Diff-specific recovery messages.
 */
export function DiffCommentComposer(
  props: DiffCommentComposerProps,
): ReactElement {
  const isSubmitDisabled =
    props.isSaving ||
    props.canSubmit === false ||
    props.body.trim().length === 0;
  const disabledMessage = getDisabledMessage(props.disabledReason);
  const hasError =
    (props.errorMessage !== null && props.errorMessage !== undefined) ||
    disabledMessage !== null;

  return (
    <CommentComposer
      id={props.id}
      className="diff-comment-composer"
      label={props.label}
      body={props.body}
      hint="CtrlまたはCommand+Enterで保存、Escでキャンセル"
      isSaving={props.isSaving}
      isSubmitDisabled={isSubmitDisabled}
      hasError={hasError}
      focusTarget={props.origin}
      additionalActions={
        <>
          {props.onReanchor === undefined ? null : (
            <button
              className="button button--secondary"
              type="button"
              onClick={props.onReanchor}
            >
              再アンカー
            </button>
          )}
          {props.onRetry === undefined ? null : (
            <button
              className="button button--secondary"
              type="button"
              onClick={props.onRetry}
            >
              保存を再試行
            </button>
          )}
        </>
      }
      onBodyChange={props.onBodyChange}
      onCancel={props.onCancel}
      onSubmit={props.onSubmit}
    >
      {props.isDurabilityUncertain === true ? (
        <p
          className="comment-composer__status"
          role="status"
          aria-live="polite"
        >
          保存結果を確認できません。再読み込みして確認してください。
        </p>
      ) : null}
      {props.statusMessage === null ||
      props.statusMessage === undefined ? null : (
        <p
          className="comment-composer__status"
          role="status"
          aria-live="polite"
        >
          {props.statusMessage}
        </p>
      )}
      {props.errorMessage === null ||
      props.errorMessage === undefined ? null : (
        <p className="comment-composer__error" role="alert">
          {props.errorMessage}
        </p>
      )}
      {disabledMessage === null ? null : (
        <p className="comment-composer__error" role="alert">
          {disabledMessage}
        </p>
      )}
    </CommentComposer>
  );
}

/**
 * Maps a disabled Diff mutation reason to user-facing guidance.
 *
 * @param reason - The optional reason preventing comment submission.
 * @returns Guidance for the reason, or null when submission is not disabled.
 */
function getDisabledMessage(
  reason: DiffCommentDisabledReason | null | undefined,
): string | null {
  if (reason === "staleTarget") {
    return "保存先が古くなりました。再アンカーしてください。";
  }
  if (reason === "revisionOverflow") {
    return "revision上限に達したため保存できません。";
  }
  if (reason === "permission") {
    return "保存先への権限がないため保存できません。";
  }
  if (reason === "invalidStore") {
    return "コメント保存データが不正なため保存できません。";
  }
  if (reason === "permanentFailure") {
    return "再試行できないエラーのため保存できません。";
  }
  if (reason === "saving") {
    return "保存中です。";
  }
  return null;
}
