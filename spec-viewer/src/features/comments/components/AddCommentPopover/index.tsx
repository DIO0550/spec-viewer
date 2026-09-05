import { MessageSquarePlus, X } from "lucide-react";
import { type CSSProperties, useId, useReducer, useState } from "react";

import { CommentComposer } from "@/features/comments/components/CommentComposer";
import { CommentPopover } from "@/features/comments/components/CommentPopover";
import {
  CommentBody,
  type CommentBodyValidationError,
} from "@/features/comments/lib/comment-body";
import type {
  AddCommentSubmitInput,
  CommentAnchorDraft,
} from "@/features/comments/types/comment";
import { createShortcutKeyHandler } from "@/lib/createShortcutKeyHandler";
import { uiText } from "@/utils/uiText";

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

/**
 * Reduces one Spec comment body action into the next validation state.
 *
 * @param state - Current controlled body and validation state.
 * @param action - Body update or submission-attempt action.
 * @returns The next immutable form state.
 */
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

/**
 * Renders the Spec adapter around the shared controlled comment form.
 *
 * @param props - Spec selection, mutation state, and comment actions.
 * @returns A floating comment popover anchored to the Markdown selection.
 */
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
  const [commentBodyFormState, dispatchCommentBodyForm] = useReducer(
    reduceCommentBodyForm,
    undefined,
    createCommentBodyFormState,
  );
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(
    null,
  );
  const isBodyEmpty = CommentBody.isEmpty(commentBodyFormState.body);
  const canSubmit = isScopeReady && !isBodyEmpty;
  const isSubmitDisabled = isSaving || !canSubmit;
  const scopeMessage = isScopeReady ? null : missingScopeMessage;
  const visibleErrorMessage =
    scopeMessage ??
    formatCommentBodyValidationError(commentBodyFormState.error) ??
    submitErrorMessage ??
    errorMessage;

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

  const handleDialogKeyDown = createShortcutKeyHandler<HTMLElement>({
    shortcuts: [
      {
        key: "Escape",
        allowsAdditionalModifiers: true,
        isEnabled: !isSaving,
        preventDefault: true,
        onMatch: onCancel,
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
      <CommentComposer
        id={textareaId}
        className="add-comment-popover__form"
        label={uiText.sidebar.comments}
        body={commentBodyFormState.body.value}
        hint={
          <>
            {formatDraftBlockType(draft.anchor.blockType)}
            {uiText.commentThread.block} {draft.anchor.blockIndex + 1},{" "}
            {uiText.commentThread.chars} {draft.anchor.charRange.start}-
            {draft.anchor.charRange.end}
          </>
        }
        isSaving={isSaving}
        isSubmitDisabled={isSubmitDisabled}
        isCancelDisabled={isSaving}
        hasError={visibleErrorMessage !== null}
        leadingContent={<blockquote>{draft.anchor.textSnippet}</blockquote>}
        onBodyChange={(body) => {
          dispatchCommentBodyForm({ type: "body_updated", value: body });
          setSubmitErrorMessage(null);
        }}
        onCancel={onCancel}
        onSubmit={() => void submitComment()}
        onSubmitBlocked={() =>
          dispatchCommentBodyForm({ type: "submit_attempted" })
        }
      >
        {visibleErrorMessage === null ? null : (
          <p className="comment-composer__error" role="alert">
            {visibleErrorMessage}
          </p>
        )}
      </CommentComposer>
    </CommentPopover>
  );
}

/**
 * @param blockType - The raw block type identifier to format.
 * @returns Human-readable block type text.
 */
function formatDraftBlockType(blockType: string): string {
  return blockType.replace(/_/g, " ");
}

/**
 * @param error - The comment body validation error, or null when valid.
 * @returns Display message for a comment body validation error.
 */
function formatCommentBodyValidationError(
  error: CommentBodyValidationError | null,
): string | null {
  if (error === "empty_body") {
    return emptyBodyMessage;
  }

  return null;
}
