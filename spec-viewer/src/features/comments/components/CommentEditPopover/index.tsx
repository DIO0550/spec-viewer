import {
  CheckCircle2,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { CommentPopover } from "@/features/comments/components/CommentPopover";
import {
  CommentOperationSavingState,
  type CommentOperationKind,
  type CommentOperationState,
} from "@/features/comments/domain/commentOperation";
import type { Comment, CommentId } from "@/features/comments/types/comment";
import { createShortcutKeyHandler } from "@/lib/createShortcutKeyHandler";
import { uiText } from "@/shared/lib/uiText";

export type CommentEditPopoverDraft = Readonly<{
  comment: Comment;
}>;

type Props = Readonly<{
  draft: CommentEditPopoverDraft | null;
  style: CSSProperties | null;
  isSaving: boolean;
  operationState: CommentOperationState;
  /**
   * Submits an edited comment body.
   * @param commentId - The identifier of the comment being edited.
   * @param body - The updated comment body text.
   */
  onSubmit: (commentId: CommentId, body: string) => Promise<boolean>;
  /**
   * Resolves the edited comment.
   * @param commentId - The identifier of the comment to resolve.
   */
  onResolveComment: (commentId: CommentId) => Promise<boolean>;
  /**
   * Reopens the edited comment.
   * @param commentId - The identifier of the comment to reopen.
   */
  onReopenComment: (commentId: CommentId) => Promise<boolean>;
  /**
   * Deletes the edited comment.
   * @param commentId - The identifier of the comment to delete.
   */
  onDeleteComment: (commentId: CommentId) => Promise<boolean>;
  /** Cancels the comment edit. */
  onCancel: () => void;
}>;

const emptyEditBodyMessage = uiText.commentThread.emptyBody;
const failedUpdateMessage =
  "コメントを更新できませんでした。再試行してください。";
const failedStatusActionMessage =
  "コメントの状態を変更できませんでした。再試行してください。";
const failedDeleteMessage =
  "コメントを削除できませんでした。再試行してください。";

/** @returns Operation error message scoped to one comment and selected operations. */
function getCommentOperationErrorMessage(
  operationState: CommentOperationState,
  commentId: CommentId,
  operations: readonly CommentOperationKind[],
): string | null {
  if (operationState.status !== "error") {
    return null;
  }

  if (operationState.commentId !== commentId) {
    return null;
  }

  if (!operations.includes(operationState.operation)) {
    return null;
  }

  return operationState.error.message;
}

/**
 * @param blockType - The raw block type identifier.
 * @returns Human-readable block type text for the edit anchor preview.
 */
function formatEditBlockType(blockType: string): string {
  return blockType.replace(/_/g, " ");
}

/** @returns A floating form for editing an existing Markdown comment. */
export function CommentEditPopover({
  draft,
  style,
  isSaving,
  operationState,
  onSubmit,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
  onCancel,
}: Props) {
  const titleId = useId();
  const textareaId = useId();
  const hintId = useId();
  const errorId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousDraftCommentIdRef = useRef<CommentId | null>(null);
  const latestCommentIdRef = useRef<CommentId | null>(
    draft?.comment.id ?? null,
  );
  const [body, setBody] = useState(draft?.comment.body ?? "");
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const trimmedBody = body.trim();
  const commentId = draft?.comment.id ?? null;
  const isOperatingComment =
    commentId === null
      ? false
      : CommentOperationSavingState.isForComment(operationState, commentId);
  const isBusy = isSaving || isOperatingComment;
  const scopedOperationErrorMessage =
    commentId === null
      ? null
      : getCommentOperationErrorMessage(operationState, commentId, [
          "update",
          "resolve",
          "reopen",
          "delete",
        ]);
  const visibleErrorMessage = validationMessage ?? scopedOperationErrorMessage;
  const isSubmitDisabled = isBusy || trimmedBody.length === 0;
  const describedBy =
    visibleErrorMessage === null ? hintId : `${hintId} ${errorId}`;

  useEffect(() => {
    const nextDraftCommentId = draft?.comment.id ?? null;

    latestCommentIdRef.current = nextDraftCommentId;

    if (previousDraftCommentIdRef.current === nextDraftCommentId) {
      return;
    }

    previousDraftCommentIdRef.current = nextDraftCommentId;
    setBody(draft?.comment.body ?? "");
    setValidationMessage(null);
    setIsConfirmingDelete(false);

    if (nextDraftCommentId !== null) {
      textareaRef.current?.focus();
    }
  }, [draft?.comment.body, draft?.comment.id]);

  if (draft === null) {
    return null;
  }

  const submitComment = async (): Promise<void> => {
    if (isBusy) {
      return;
    }

    if (trimmedBody.length === 0) {
      setValidationMessage(emptyEditBodyMessage);
      return;
    }

    const targetCommentId = draft.comment.id;

    setValidationMessage(null);
    const wasSaved = await onSubmit(targetCommentId, trimmedBody);

    if (latestCommentIdRef.current !== targetCommentId) {
      return;
    }

    if (!wasSaved) {
      setValidationMessage(failedUpdateMessage);
    }
  };

  const toggleResolved = async (): Promise<void> => {
    if (isBusy) {
      return;
    }

    const targetCommentId = draft.comment.id;

    setValidationMessage(null);
    const wasChanged = draft.comment.resolved
      ? await onReopenComment(targetCommentId)
      : await onResolveComment(targetCommentId);

    if (latestCommentIdRef.current !== targetCommentId) {
      return;
    }

    if (!wasChanged) {
      setValidationMessage(failedStatusActionMessage);
    }
  };

  const requestDelete = (): void => {
    if (isBusy) {
      return;
    }

    setValidationMessage(null);
    setIsConfirmingDelete(true);
  };

  const cancelDelete = (): void => {
    if (isBusy) {
      return;
    }

    setValidationMessage(null);
    setIsConfirmingDelete(false);
  };

  const confirmDelete = async (): Promise<void> => {
    if (isBusy) {
      return;
    }

    const targetCommentId = draft.comment.id;

    setValidationMessage(null);
    const wasDeleted = await onDeleteComment(targetCommentId);

    if (latestCommentIdRef.current !== targetCommentId) {
      return;
    }

    if (!wasDeleted) {
      setValidationMessage(failedDeleteMessage);
    }
  };

  const submitForm = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void submitComment();
  };

  const handleTextareaKeyDown = createShortcutKeyHandler<HTMLTextAreaElement>({
    shortcuts: [
      {
        key: "Escape",
        allowsAdditionalModifiers: true,
        isEnabled: !isBusy,
        preventDefault: true,
        onMatch: () => {
          onCancel();
        },
      },
      {
        key: "Enter",
        modifiers: ["ctrlOrMeta"],
        allowsAdditionalModifiers: true,
        isEnabled: !isBusy,
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
        isEnabled: !isBusy,
        preventDefault: true,
        onMatch: () => {
          onCancel();
        },
      },
    ],
  });

  const statusActionLabel = draft.comment.resolved
    ? uiText.commentThread.reopen
    : uiText.commentThread.resolve;

  return (
    <CommentPopover
      className="add-comment-popover add-comment-popover--edit"
      style={style ?? undefined}
      role="dialog"
      aria-labelledby={titleId}
      onKeyDown={handleDialogKeyDown}
      isDismissDisabled={isBusy}
      onClose={onCancel}
    >
      <header className="add-comment-popover__header">
        <div>
          <span className="add-comment-popover__eyebrow">
            <Pencil aria-hidden="true" size={14} />
            既存コメント
          </span>
          <h2 id={titleId} className="add-comment-popover__title">
            コメント編集
          </h2>
        </div>
        <button
          className="icon-button add-comment-popover__close-button"
          type="button"
          aria-label="コメント編集をキャンセル"
          onClick={onCancel}
          disabled={isBusy}
        >
          <X aria-hidden="true" size={14} />
        </button>
      </header>
      <form className="add-comment-popover__form" onSubmit={submitForm}>
        <div className="add-comment-popover__body">
          <blockquote>{draft.comment.anchor.textSnippet}</blockquote>
          <label className="add-comment-popover__label" htmlFor={textareaId}>
            {uiText.sidebar.comments}
          </label>
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
            disabled={isBusy}
          />
          <p id={hintId} className="add-comment-popover__hint">
            {formatEditBlockType(draft.comment.anchor.blockType)}
            {uiText.commentThread.block} {draft.comment.anchor.blockIndex + 1},{" "}
            {uiText.commentThread.chars} {draft.comment.anchor.charRange.start}-
            {draft.comment.anchor.charRange.end}
          </p>
          {visibleErrorMessage === null ? null : (
            <p id={errorId} className="add-comment-popover__error" role="alert">
              {visibleErrorMessage}
            </p>
          )}
          {isConfirmingDelete ? (
            <div className="add-comment-popover__confirm" role="alert">
              <p>{uiText.commentThread.confirmDelete}</p>
              <div className="add-comment-popover__confirm-actions">
                <button
                  className="button button--danger"
                  type="button"
                  aria-label={`${uiText.commentThread.confirmDeleteAction} ${draft.comment.id}`}
                  disabled={isBusy}
                  onClick={() => {
                    void confirmDelete();
                  }}
                >
                  {uiText.commentThread.delete}
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  aria-label={`${uiText.commentThread.cancelDeleteAction} ${draft.comment.id}`}
                  disabled={isBusy}
                  onClick={cancelDelete}
                >
                  {uiText.commentThread.cancel}
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="add-comment-popover__status-actions">
          <button
            className="button button--secondary"
            type="button"
            disabled={isBusy}
            onClick={() => {
              void toggleResolved();
            }}
          >
            {draft.comment.resolved ? (
              <RotateCcw aria-hidden="true" size={15} />
            ) : (
              <CheckCircle2 aria-hidden="true" size={15} />
            )}
            {statusActionLabel}
          </button>
          <button
            className="button button--danger"
            type="button"
            disabled={isBusy || isConfirmingDelete}
            onClick={requestDelete}
          >
            <Trash2 aria-hidden="true" size={15} />
            {uiText.commentThread.delete}
          </button>
        </div>
        <div className="add-comment-popover__actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onCancel}
            disabled={isBusy}
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
