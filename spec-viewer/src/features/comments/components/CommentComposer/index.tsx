import { LoaderCircle, Send } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
} from "react";

export type CommentComposerProps = Readonly<{
  id: string;
  label: string;
  body: string;
  hint: ReactNode;
  isSaving: boolean;
  isSubmitDisabled: boolean;
  isCancelDisabled?: boolean;
  hasError?: boolean;
  placeholder?: string;
  className?: string;
  leadingContent?: ReactNode;
  additionalActions?: ReactNode;
  focusTarget?: HTMLElement | null;
  children?: ReactNode;
  onBodyChange: (body: string) => void;
  onCancel: () => void;
  onSubmit: (body: string) => void;
  onSubmitBlocked?: () => void;
}>;

/**
 * Renders the shared controlled form used to create Spec and Diff comments.
 *
 * @param props - Controlled body, state, content slots, and comment actions.
 * @returns An accessible comment form with shared keyboard and focus behavior.
 */
export function CommentComposer(props: CommentComposerProps): ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hintId = `${props.id}-hint`;
  const detailsId = `${props.id}-details`;
  const hasDetails = props.children !== undefined && props.children !== null;

  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: true });
  }, []);

  const submit = (): void => {
    if (props.isSubmitDisabled) {
      props.onSubmitBlocked?.();
      return;
    }
    props.onSubmit(props.body.trim());
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
      if (props.isCancelDisabled === true) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      props.onCancel();
      props.focusTarget?.focus({ preventScroll: true });
      return;
    }
    if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) {
      return;
    }
    event.preventDefault();
    submit();
  };

  const className =
    props.className === undefined
      ? "comment-composer"
      : `comment-composer ${props.className}`;

  return (
    <form
      aria-label={props.label}
      className={className}
      onSubmit={handleSubmit}
    >
      <div className="comment-composer__body">
        {props.leadingContent}
        <label className="comment-composer__label" htmlFor={props.id}>
          {props.label}
        </label>
        <textarea
          ref={textareaRef}
          id={props.id}
          value={props.body}
          rows={4}
          disabled={props.isSaving}
          aria-describedby={hasDetails ? `${hintId} ${detailsId}` : hintId}
          aria-invalid={props.hasError === true}
          placeholder={props.placeholder ?? "レビューコメントを書く..."}
          onChange={(event) => props.onBodyChange(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
        <p id={hintId} className="comment-composer__hint">
          {props.hint}
        </p>
        {hasDetails ? (
          <div id={detailsId} className="comment-composer__details">
            {props.children}
          </div>
        ) : null}
      </div>
      <div className="comment-composer__actions">
        {props.additionalActions}
        <button
          className="button button--secondary"
          type="button"
          disabled={props.isCancelDisabled === true}
          onClick={props.onCancel}
        >
          キャンセル
        </button>
        <button
          className="button button--primary"
          type="submit"
          disabled={props.isSubmitDisabled}
        >
          {props.isSaving ? (
            <LoaderCircle
              className="comment-composer__saving-icon"
              aria-hidden="true"
              size={15}
            />
          ) : (
            <Send aria-hidden="true" size={15} />
          )}
          {props.isSaving ? "保存中" : "保存"}
        </button>
      </div>
    </form>
  );
}
