import { Check, X } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

import type { Comment } from "@/features/comments/types/comment";
import { uiText } from "@/shared/lib/uiText";

type Props = Readonly<{
  comment: Comment;
  isOperatingComment: boolean;
  onSubmit: (body: string) => void;
  onCancel: () => void;
}>;

/** @returns The inline comment body editor with empty-body validation. */
export function CommentThreadEditor({
  comment,
  isOperatingComment,
  onSubmit,
  onCancel,
}: Props) {
  const bodyId = useId();
  const validationId = useId();
  const [draftBody, setDraftBody] = useState(comment.body);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );

  const submitEdit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const nextBody = draftBody.trim();

    if (nextBody.length === 0) {
      setValidationMessage(uiText.commentThread.emptyBody);
      return;
    }

    setValidationMessage(null);
    onSubmit(nextBody);
  };

  return (
    <form className="comment-thread__editor" onSubmit={submitEdit}>
      <label className="comment-thread__editor-label" htmlFor={bodyId}>
        {uiText.commentThread.body}
      </label>
      <textarea
        id={bodyId}
        aria-label={`${uiText.commentThread.bodyLabel} ${comment.id}`}
        aria-describedby={validationMessage === null ? undefined : validationId}
        value={draftBody}
        rows={4}
        onInput={(event) => {
          setDraftBody(event.currentTarget.value);
        }}
      />
      {validationMessage === null ? null : (
        <p
          id={validationId}
          className="comment-thread__validation"
          role="alert"
        >
          {validationMessage}
        </p>
      )}
      <div className="comment-thread__editor-actions">
        <button
          className="icon-button"
          type="submit"
          aria-label={`${uiText.commentThread.save} ${comment.id}`}
          disabled={isOperatingComment}
        >
          <Check aria-hidden="true" size={14} />
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label={`${uiText.commentThread.cancel} ${comment.id}`}
          disabled={isOperatingComment}
          onClick={onCancel}
        >
          <X aria-hidden="true" size={14} />
        </button>
      </div>
    </form>
  );
}
