import { LoaderCircle, MessageSquarePlus, Send, X } from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
} from "react";

import { uiText } from "@/shared/lib/uiText";
import {
  CommentBody,
  type CommentBodyValidationError,
} from "@/features/comments/lib/comment-body";
import type {
  AddCommentSubmitInput,
  CommentAnchorDraft,
} from "@/features/comments/types/comment";

type Props = Readonly<{
  draft: CommentAnchorDraft;
  style: CSSProperties;
  isSaving: boolean;
  errorMessage: string | null;
  isScopeReady: boolean;
  onSubmit: (input: AddCommentSubmitInput) => Promise<boolean>;
  onCancel: () => void;
}>;

const missingScopeMessage =
  "保存する前にワークスペース、Spec、ファイルを選択してください。";
const emptyBodyMessage = "保存するコメントを入力してください。";
const failedSaveMessage =
  "コメントを保存できませんでした。再試行してください。";

type CommentBodyFormState = Readonly<{
  body: CommentBody;
  error: CommentBodyValidationError | null;
}>;

type CommentBodyFormAction =
  | Readonly<{
      type: "body_updated";
      value: string;
    }>
  | Readonly<{
      type: "submit_attempted";
    }>;

/** @returns Initial add-comment body form state. */
function createCommentBodyFormState(): CommentBodyFormState {
  return { body: CommentBody.create(), error: null };
}

/** @returns Next add-comment body form state for the requested action. */
function reduceCommentBodyForm(
  state: CommentBodyFormState,
  action: CommentBodyFormAction,
): CommentBodyFormState {
  if (action.type === "body_updated") {
    return {
      body: CommentBody.update(state.body, action.value),
      error: null,
    };
  }

  return {
    ...state,
    error: CommentBody.validate(state.body),
  };
}

/** @returns A floating form for saving a comment from a Markdown selection. */
export function AddCommentPopover({
  draft,
  style,
  isSaving,
  errorMessage,
  isScopeReady,
  onSubmit,
  onCancel,
}: Props) {
  const titleId = useId();
  const textareaId = useId();
  const hintId = useId();
  const errorId = useId();
  const popoverRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [commentBodyFormState, dispatchCommentBodyForm] = useReducer(
    reduceCommentBodyForm,
    undefined,
    createCommentBodyFormState,
  );
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(
    null,
  );
  const isBodyEmpty = CommentBody.isEmpty(commentBodyFormState.body);
  const isSubmitDisabled = isSaving || !isScopeReady || isBodyEmpty;
  const scopeMessage = isScopeReady ? null : missingScopeMessage;
  const visibleErrorMessage =
    scopeMessage ??
    formatCommentBodyValidationError(commentBodyFormState.error) ??
    submitErrorMessage ??
    errorMessage;
  const describedBy =
    visibleErrorMessage === null ? hintId : `${hintId} ${errorId}`;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const closeWhenClickingOutside = (event: globalThis.MouseEvent): void => {
      if (isSaving) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (popoverRef.current?.contains(target)) {
        return;
      }

      onCancel();
    };

    document.addEventListener("mousedown", closeWhenClickingOutside);

    return () => {
      document.removeEventListener("mousedown", closeWhenClickingOutside);
    };
  }, [isSaving, onCancel]);

  const submitComment = async (): Promise<void> => {
    if (!isScopeReady) {
      return;
    }

    const validationError = CommentBody.validate(commentBodyFormState.body);
    dispatchCommentBodyForm({ type: "submit_attempted" });

    if (validationError !== null) {
      return;
    }

    setSubmitErrorMessage(null);
    const wasSaved = await onSubmit({
      anchor: draft.anchor,
      body: CommentBody.getTrimmedValue(commentBodyFormState.body),
    });

    if (!wasSaved) {
      setSubmitErrorMessage(failedSaveMessage);
    }
  };

  const submitForm = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void submitComment();
  };

  const handleTextareaKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submitComment();
    }
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.defaultPrevented || event.key !== "Escape" || isSaving) {
      return;
    }

    event.preventDefault();
    onCancel();
  };

  return (
    <aside
      ref={popoverRef}
      className="add-comment-popover"
      style={style}
      role="dialog"
      aria-labelledby={titleId}
      onKeyDown={handleDialogKeyDown}
    >
      <header className="add-comment-popover__header">
        <div>
          <span className="add-comment-popover__eyebrow">
            <MessageSquarePlus aria-hidden="true" size={14} />
            新規コメント
          </span>
          <h2 id={titleId} className="add-comment-popover__title">
            コメント追加
          </h2>
        </div>
        <button
          className="icon-button add-comment-popover__close-button"
          type="button"
          aria-label="コメント追加をキャンセル"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X aria-hidden="true" size={14} />
        </button>
      </header>
      <form className="add-comment-popover__form" onSubmit={submitForm}>
        <div className="add-comment-popover__body">
          <blockquote>{draft.anchor.textSnippet}</blockquote>
          <label className="add-comment-popover__label" htmlFor={textareaId}>
            {uiText.sidebar.comments}
          </label>
          <textarea
            id={textareaId}
            ref={textareaRef}
            value={commentBodyFormState.body.value}
            rows={4}
            aria-describedby={describedBy}
            aria-invalid={visibleErrorMessage !== null}
            placeholder="レビューコメントを書く..."
            onInput={(event) => {
              dispatchCommentBodyForm({
                type: "body_updated",
                value: event.currentTarget.value,
              });
              setSubmitErrorMessage(null);
            }}
            onKeyDown={handleTextareaKeyDown}
            disabled={isSaving}
          />
          <p id={hintId} className="add-comment-popover__hint">
            {formatDraftBlockType(draft.anchor.blockType)}
            {uiText.commentThread.block} {draft.anchor.blockIndex + 1},{" "}
            {uiText.commentThread.chars} {draft.anchor.charRange.start}-
            {draft.anchor.charRange.end}
          </p>
          {visibleErrorMessage === null ? null : (
            <p id={errorId} className="add-comment-popover__error" role="alert">
              {visibleErrorMessage}
            </p>
          )}
        </div>
        <div className="add-comment-popover__actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onCancel}
            disabled={isSaving}
          >
            {uiText.commentThread.cancel}
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={isSubmitDisabled}
          >
            {isSaving ? (
              <LoaderCircle
                className="add-comment-popover__saving-icon"
                aria-hidden="true"
                size={15}
              />
            ) : (
              <Send aria-hidden="true" size={15} />
            )}
            {uiText.commentThread.save}
          </button>
        </div>
      </form>
    </aside>
  );
}

/** @returns Human-readable block type text for the anchor preview. */
function formatDraftBlockType(blockType: string): string {
  return blockType.replace(/_/g, " ");
}

/** @returns Display message for a comment body validation error. */
function formatCommentBodyValidationError(
  error: CommentBodyValidationError | null,
): string | null {
  if (error === "empty_body") {
    return emptyBodyMessage;
  }

  return null;
}
