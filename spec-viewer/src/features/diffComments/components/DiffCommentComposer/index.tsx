import {
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useRef,
} from "react";

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
 * Renders the controlled inline Diff comment editor.
 *
 * @param props - Draft text, mutation state, focus origin, and controlled actions.
 * @returns An accessible multiline form with keyboard submit and cancel behavior.
 */
export function DiffCommentComposer(
  props: DiffCommentComposerProps,
): ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trimmedBody = props.body.trim();
  const isSubmitDisabled =
    props.isSaving || props.canSubmit === false || trimmedBody.length === 0;
  const disabledMessage = getDisabledMessage(props.disabledReason);

  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: true });
  }, []);

  const submit = (): void => {
    if (isSubmitDisabled) {
      return;
    }
    props.onSubmit(trimmedBody);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      props.onCancel();
      props.origin?.focus({ preventScroll: true });
      return;
    }
    if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) {
      return;
    }
    event.preventDefault();
    submit();
  };

  return (
    <form
      className="diff-comment-composer"
      aria-label={props.label}
      onSubmit={handleSubmit}
    >
      <label htmlFor={props.id}>{props.label}</label>
      <textarea
        ref={textareaRef}
        id={props.id}
        value={props.body}
        disabled={props.isSaving}
        aria-invalid={props.errorMessage === null ? undefined : true}
        aria-describedby={`${props.id}-hint`}
        onChange={(event) => props.onBodyChange(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
      <p id={`${props.id}-hint`} className="diff-comment-composer__hint">
        CtrlまたはCommand+Enterで保存、Escでキャンセル
      </p>
      {props.isDurabilityUncertain === true ? (
        <p role="status" aria-live="polite">
          保存結果を確認できません。再読み込みして確認してください。
        </p>
      ) : null}
      {props.statusMessage === null ||
      props.statusMessage === undefined ? null : (
        <p role="status" aria-live="polite">
          {props.statusMessage}
        </p>
      )}
      {props.errorMessage === null ||
      props.errorMessage === undefined ? null : (
        <p role="alert">{props.errorMessage}</p>
      )}
      {disabledMessage === null ? null : <p role="alert">{disabledMessage}</p>}
      <div className="diff-comment-composer__actions">
        <button type="button" onClick={props.onCancel}>
          キャンセル
        </button>
        {props.onReanchor === undefined ? null : (
          <button type="button" onClick={props.onReanchor}>
            再アンカー
          </button>
        )}
        {props.onRetry === undefined ? null : (
          <button type="button" onClick={props.onRetry}>
            保存を再試行
          </button>
        )}
        <button type="submit" disabled={isSubmitDisabled}>
          {props.isSaving ? "保存中" : "保存"}
        </button>
      </div>
    </form>
  );
}

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
