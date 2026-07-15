import { LoaderCircle, MessageSquarePlus, Send, X } from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
} from "react";
import { CommentPopover } from "@/features/comments/components/CommentPopover";
import {
  CommentBody,
  type CommentBodyDraft,
  type CommentBodyParseError,
} from "@/features/comments/domain/commentBody";
import { toCommentBodyValidationMessage } from "@/features/comments/lib/comment-body-validation-message";
import type {
  AddCommentSubmitInput,
  CommentAnchorDraft,
} from "@/features/comments/types/comment";
import { createShortcutKeyHandler } from "@/lib/createShortcutKeyHandler";
import { uiText } from "@/shared/lib/uiText";

type Props = Readonly<{
  draft: CommentAnchorDraft;
  style: CSSProperties;
  isSaving: boolean;
  errorMessage: string | null;
  isScopeReady: boolean;
  /**
   * Submits the drafted comment.
   * @param input - The comment submission payload.
   */
  onSubmit: (input: AddCommentSubmitInput) => Promise<boolean>;
  /** Cancels the add-comment interaction. */
  onCancel: () => void;
}>;

const missingScopeMessage =
  "保存する前にワークスペース、Spec、ファイルを選択してください。";
const failedSaveMessage =
  "コメントを保存できませんでした。再試行してください。";

type CommentBodyFormState = Readonly<{
  draft: CommentBodyDraft;
  error: CommentBodyParseError | null;
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
  return { draft: "", error: null };
}

/** @returns Next add-comment body form state for the requested action. */
function reduceCommentBodyForm(
  state: CommentBodyFormState,
  action: CommentBodyFormAction,
): CommentBodyFormState {
  if (action.type === "body_updated") {
    return {
      draft: action.value,
      error: null,
    };
  }

  const parseResult = CommentBody.parse(state.draft);
  return {
    ...state,
    error: parseResult.ok ? null : parseResult.error,
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [commentBodyFormState, dispatchCommentBodyForm] = useReducer(
    reduceCommentBodyForm,
    undefined,
    createCommentBodyFormState,
  );
  const commentBodyParseResult = CommentBody.parse(commentBodyFormState.draft);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(
    null,
  );
  const canSubmit = isScopeReady && commentBodyParseResult.ok;
  const isSubmitDisabled = isSaving || !canSubmit;
  const scopeMessage = isScopeReady ? null : missingScopeMessage;
  const bodyValidationMessage =
    commentBodyFormState.error === null
      ? null
      : toCommentBodyValidationMessage(commentBodyFormState.error);
  const visibleErrorMessage =
    scopeMessage ?? bodyValidationMessage ?? submitErrorMessage ?? errorMessage;
  const describedBy =
    visibleErrorMessage === null ? hintId : `${hintId} ${errorId}`;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const submitComment = async (): Promise<void> => {
    if (!isScopeReady) {
      return;
    }

    const parseResult = CommentBody.parse(commentBodyFormState.draft);
    dispatchCommentBodyForm({ type: "submit_attempted" });

    if (!parseResult.ok) {
      return;
    }

    setSubmitErrorMessage(null);
    const wasSaved = await onSubmit({
      anchor: draft.anchor,
      body: parseResult.commentBody,
    });

    if (!wasSaved) {
      setSubmitErrorMessage(failedSaveMessage);
    }
  };

  const submitForm = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void submitComment();
  };

  const handleTextareaKeyDown = createShortcutKeyHandler<HTMLTextAreaElement>({
    shortcuts: [
      {
        key: "Enter",
        modifiers: ["ctrlOrMeta"],
        allowsAdditionalModifiers: true,
        isEnabled: !isSaving,
        preventDefault: true,
        onMatch: () => {
          void submitComment();
        },
      },
    ],
  });

  const handleDialogKeyDown = createShortcutKeyHandler<HTMLElement>({
    shortcuts: [
      {
        key: "Escape",
        allowsAdditionalModifiers: true,
        isEnabled: !isSaving,
        preventDefault: true,
        onMatch: () => {
          onCancel();
        },
      },
    ],
  });

  return (
    <CommentPopover
      className="add-comment-popover"
      style={style}
      role="dialog"
      aria-labelledby={titleId}
      onKeyDown={handleDialogKeyDown}
      isDismissDisabled={isSaving}
      onClose={onCancel}
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
            value={commentBodyFormState.draft}
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
    </CommentPopover>
  );
}

/**
 * @param blockType - The raw block type identifier to format.
 * @returns Human-readable block type text for the anchor preview.
 */
function formatDraftBlockType(blockType: string): string {
  return blockType.replace(/_/g, " ");
}
