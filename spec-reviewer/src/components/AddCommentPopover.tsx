import { LoaderCircle, MessageSquarePlus, Send, X } from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { uiText } from "../lib/uiText";
import type { CommentAnchor, CommentAnchorDraft } from "../types/comment";

export type AddCommentSubmitInput = Readonly<{
  anchor: CommentAnchor;
  body: string;
}>;

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
  const [body, setBody] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const trimmedBody = body.trim();
  const isSubmitDisabled =
    isSaving || !isScopeReady || trimmedBody.length === 0;
  const scopeMessage = isScopeReady ? null : missingScopeMessage;
  const visibleErrorMessage = scopeMessage ?? validationMessage ?? errorMessage;
  const describedBy =
    visibleErrorMessage === null ? hintId : `${hintId} ${errorId}`;

  useEffect(() => {
    setBody("");
    setValidationMessage(null);
    textareaRef.current?.focus();
  }, [draft]);

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
      setValidationMessage(missingScopeMessage);
      return;
    }

    if (trimmedBody.length === 0) {
      setValidationMessage(emptyBodyMessage);
      return;
    }

    setValidationMessage(null);
    const wasSaved = await onSubmit({
      anchor: draft.anchor,
      body: trimmedBody,
    });

    if (!wasSaved) {
      setValidationMessage(failedSaveMessage);
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
          <h2 id={titleId}>コメント追加</h2>
        </div>
        <button
          className="icon-button"
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
          <label htmlFor={textareaId}>{uiText.sidebar.comments}</label>
          <textarea
            id={textareaId}
            ref={textareaRef}
            value={body}
            rows={4}
            aria-describedby={describedBy}
            aria-invalid={visibleErrorMessage !== null}
            placeholder="レビューコメントを書く..."
            onInput={(event) => {
              setBody(event.currentTarget.value);
              setValidationMessage(null);
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
