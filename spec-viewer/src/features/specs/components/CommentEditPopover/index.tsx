import { LoaderCircle, Send } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import {
  CommentOperationSavingState,
  type CommentOperationState,
} from "@/features/comments/domain/commentOperation";
import { CommentPopoverPosition } from "@/features/comments/lib/commentPopoverPosition";
import type { CommentId } from "@/features/comments/types/comment";
import type { CommentEditDraft } from "@/features/specs/components/MarkdownDocument";
import { uiText } from "@/shared/lib/uiText";

import {
  CommentEditPopoverHeader,
  CommentEditStatusActions,
  DeleteConfirmation,
} from "./parts";
import {
  emptyEditBodyMessage,
  failedDeleteMessage,
  failedStatusActionMessage,
  failedUpdateMessage,
  formatEditBlockType,
  getCommentOperationErrorMessage,
} from "./presenter";

type Props = Readonly<{
  draft: CommentEditDraft | null;
  isSaving: boolean;
  operationState: CommentOperationState;
  /**
   * @param commentId - Comment being edited
   * @param body - Replacement body text
   * @returns Whether the update was persisted.
   */
  onSubmit: (commentId: CommentId, body: string) => Promise<boolean>;
  /** @param commentId - Comment to resolve */
  onResolveComment: (commentId: CommentId) => Promise<boolean>;
  /** @param commentId - Comment to reopen */
  onReopenComment: (commentId: CommentId) => Promise<boolean>;
  /** @param commentId - Comment to delete */
  onDeleteComment: (commentId: CommentId) => Promise<boolean>;
  /** Closes the edit dialog without saving. */
  onCancel: () => void;
}>;

/** @returns A floating form for editing an existing Markdown comment. */
export function CommentEditPopover({
  draft,
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
  const popoverRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousDraftCommentIdRef = useRef<CommentId | null>(null);
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

    if (previousDraftCommentIdRef.current === nextDraftCommentId) {
      return;
    }

    previousDraftCommentIdRef.current = nextDraftCommentId;
    setBody(draft?.comment.body ?? "");
    setValidationMessage(null);
    setIsConfirmingDelete(false);
    textareaRef.current?.focus();
  }, [draft]);

  useEffect(() => {
    const closeWhenClickingOutside = (event: globalThis.MouseEvent): void => {
      if (draft === null) {
        return;
      }

      if (isBusy) {
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
  }, [draft, isBusy, onCancel]);

  if (draft === null) {
    return null;
  }

  const submitComment = async (): Promise<void> => {
    if (trimmedBody.length === 0) {
      setValidationMessage(emptyEditBodyMessage);
      return;
    }

    setValidationMessage(null);
    const wasSaved = await onSubmit(draft.comment.id, trimmedBody);

    if (!wasSaved) {
      setValidationMessage(failedUpdateMessage);
    }
  };

  const toggleResolved = async (): Promise<void> => {
    setValidationMessage(null);
    const wasChanged = draft.comment.resolved
      ? await onReopenComment(draft.comment.id)
      : await onResolveComment(draft.comment.id);

    if (!wasChanged) {
      setValidationMessage(failedStatusActionMessage);
    }
  };

  const requestDelete = (): void => {
    setValidationMessage(null);
    setIsConfirmingDelete(true);
  };

  const cancelDelete = (): void => {
    setValidationMessage(null);
    setIsConfirmingDelete(false);
  };

  const confirmDelete = async (): Promise<void> => {
    setValidationMessage(null);
    const wasDeleted = await onDeleteComment(draft.comment.id);

    if (!wasDeleted) {
      setValidationMessage(failedDeleteMessage);
    }
  };

  const submitForm = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void submitComment();
  };

  const handleTextareaKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ): void => {
    if (isBusy) {
      return;
    }

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
    if (event.defaultPrevented || event.key !== "Escape" || isBusy) {
      return;
    }

    event.preventDefault();
    onCancel();
  };

  return (
    <aside
      ref={popoverRef}
      className="add-comment-popover add-comment-popover--edit"
      style={CommentPopoverPosition.createPopoverStyle(draft.selectionBounds)}
      role="dialog"
      aria-labelledby={titleId}
      onKeyDown={handleDialogKeyDown}
    >
      <CommentEditPopoverHeader
        titleId={titleId}
        isBusy={isBusy}
        onCancel={onCancel}
      />
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
            <DeleteConfirmation
              commentId={draft.comment.id}
              isBusy={isBusy}
              onConfirm={() => {
                void confirmDelete();
              }}
              onCancel={cancelDelete}
            />
          ) : null}
        </div>
        <CommentEditStatusActions
          resolved={draft.comment.resolved}
          isBusy={isBusy}
          isConfirmingDelete={isConfirmingDelete}
          onToggleResolved={() => {
            void toggleResolved();
          }}
          onRequestDelete={requestDelete}
        />
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
    </aside>
  );
}
