import { ChevronDown, ChevronRight } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type ReviewCommentPresentation = Readonly<{
  id: string;
  body: string;
  status: "open" | "resolved";
  title: ReactNode;
  snippet: string;
  resolutionLabel: string;
  canJump: boolean;
}>;

export type ReviewCommentLabels = Readonly<{
  edit: string;
  resolve: string;
  reopen: string;
  save: string;
  cancel: string;
  delete: string;
  confirmDelete: string;
  confirmDeleteAction: string;
}>;

export type ReviewCommentProps = Readonly<{
  comment: ReviewCommentPresentation;
  isSelected: boolean;
  isMutating: boolean;
  searchQuery?: string;
  selectionRef?: RefCallback<HTMLButtonElement>;
  selectionLabel?: string;
  articleClassName?: string;
  selectClassName?: string;
  anchorDetails?: ReactNode;
  footer?: ReactNode;
  isCollapsible?: boolean;
  showJump?: boolean;
  labels?: Partial<ReviewCommentLabels>;
  onSelectionKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onSelect: (commentId: string) => void;
  onUpdate: (
    commentId: string,
    body: string,
  ) => boolean | void | Promise<boolean | void>;
  onResolve: (commentId: string) => void;
  onReopen: (commentId: string) => void;
  onJump: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
}>;

const DefaultLabels: ReviewCommentLabels = {
  edit: "コメントを編集",
  resolve: "Resolve",
  reopen: "Reopen",
  save: "保存",
  cancel: "キャンセル",
  delete: "削除",
  confirmDelete: "このコメントを完全に削除しますか？",
  confirmDeleteAction: "コメント削除を確定",
};

/** Shared Review comment presentation used by Spec and Diff adapters. */
export function ReviewComment(props: ReviewCommentProps): ReactElement {
  const { comment } = props;
  const labels = { ...DefaultLabels, ...props.labels };
  const [isEditing, setEditing] = useState(false);
  const [isConfirmingDelete, setConfirmingDelete] = useState(false);
  const [draftBody, setDraftBody] = useState(comment.body);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [isSubmittingEdit, setSubmittingEdit] = useState(false);
  const [isCollapsed, setCollapsed] = useState(
    props.isCollapsible === true && comment.status === "resolved",
  );
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previousStatusRef = useRef(comment.status);
  const contentId = `review-comment-content-${toHtmlId(comment.id)}`;

  useEffect(() => {
    if (!isEditing) {
      setDraftBody(comment.body);
    }
  }, [comment.body, isEditing]);

  useEffect(() => {
    if (isEditing && !isSubmittingEdit) {
      editorRef.current?.focus({ preventScroll: true });
    }
  }, [isEditing, isSubmittingEdit]);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = comment.status;
    if (props.isCollapsible !== true || previousStatus === comment.status) {
      return;
    }
    setCollapsed(comment.status === "resolved");
  }, [comment.status, props.isCollapsible]);

  const submitEdit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const body = draftBody.trim();
    if (body.length === 0) {
      setValidationMessage("コメント本文を入力してください。");
      return;
    }
    if (isSubmittingEdit) {
      return;
    }
    setValidationMessage(null);
    setSubmittingEdit(true);
    void Promise.resolve(props.onUpdate(comment.id, body)).then(
      (isCommitted) => {
        setSubmittingEdit(false);
        if (isCommitted === false) {
          editorRef.current?.focus({ preventScroll: true });
          return;
        }
        setEditing(false);
      },
      () => {
        setSubmittingEdit(false);
        editorRef.current?.focus({ preventScroll: true });
      },
    );
  };

  return (
    <article
      className={props.articleClassName ?? "review-comment diff-review-card"}
      data-comment-id={comment.id}
      aria-current={props.isSelected ? "true" : undefined}
    >
      <header className="review-comment__header">
        <button
          ref={props.selectionRef}
          type="button"
          className={
            props.selectClassName ??
            "review-comment__select diff-review-card__select"
          }
          data-comment-id={comment.id}
          aria-label={props.selectionLabel}
          aria-current={props.isSelected ? "true" : undefined}
          onClick={() => props.onSelect(comment.id)}
          onKeyDown={props.onSelectionKeyDown}
        >
          <strong className="review-comment__title">{comment.title}</strong>
          <span className="review-comment__status" data-status={comment.status}>
            {comment.status === "open" ? "未解決" : "解決済み"}
          </span>
        </button>
        {props.isCollapsible === true ? (
          <button
            type="button"
            className="review-comment__toggle"
            aria-label={`${isCollapsed ? "コメントを展開" : "コメントを折りたたむ"} ${comment.id}`}
            aria-expanded={!isCollapsed}
            aria-controls={contentId}
            onClick={() => setCollapsed((current) => !current)}
          >
            {isCollapsed ? (
              <ChevronRight aria-hidden="true" size={18} />
            ) : (
              <ChevronDown aria-hidden="true" size={18} />
            )}
          </button>
        ) : null}
      </header>
      <div
        id={contentId}
        className="review-comment__content"
        hidden={props.isCollapsible === true && isCollapsed}
      >
        {props.anchorDetails}
        {isEditing ? (
          <form className="review-comment__edit" onSubmit={submitEdit}>
            <label>
              コメント本文
              <textarea
                aria-label={`コメント本文 ${comment.id}`}
                ref={editorRef}
                value={draftBody}
                disabled={props.isMutating || isSubmittingEdit}
                onInput={(event) => setDraftBody(event.currentTarget.value)}
              />
            </label>
            {validationMessage === null ? null : (
              <p role="alert">{validationMessage}</p>
            )}
            <button
              type="submit"
              aria-label={`${labels.save} ${comment.id}`}
              disabled={props.isMutating || isSubmittingEdit}
            >
              {labels.save}
            </button>
            <button
              type="button"
              aria-label={`${labels.cancel} ${comment.id}`}
              disabled={props.isMutating || isSubmittingEdit}
              onClick={() => setEditing(false)}
            >
              {labels.cancel}
            </button>
          </form>
        ) : (
          <p className="review-comment__body">
            <HighlightedText
              text={comment.body}
              searchQuery={props.searchQuery ?? ""}
            />
          </p>
        )}
        {props.anchorDetails === undefined ? (
          <blockquote className="review-comment__snippet">
            {comment.snippet}
          </blockquote>
        ) : null}
        {comment.resolutionLabel.length === 0 ? null : (
          <p className="review-comment__resolution">
            {comment.resolutionLabel}
          </p>
        )}
        {isConfirmingDelete ? null : (
          <div className="diff-review-card__actions">
            {props.showJump === false ? null : (
              <button
                type="button"
                aria-label={`${String(comment.title)}へ移動`}
                disabled={!comment.canJump}
                onClick={() => {
                  props.onSelect(comment.id);
                  props.onJump(comment.id);
                }}
              >
                行へ移動
              </button>
            )}
            <button
              type="button"
              aria-label={`${labels.edit} ${comment.id}`}
              disabled={props.isMutating || isEditing}
              onClick={() => setEditing(true)}
            >
              編集
            </button>
            {comment.status === "open" ? (
              <button
                type="button"
                aria-label={`${labels.resolve} ${comment.id}`}
                disabled={props.isMutating}
                onClick={() => props.onResolve(comment.id)}
              >
                {labels.resolve}
              </button>
            ) : (
              <button
                type="button"
                aria-label={`${labels.reopen} ${comment.id}`}
                disabled={props.isMutating}
                onClick={() => props.onReopen(comment.id)}
              >
                {labels.reopen}
              </button>
            )}
            {props.onDelete === undefined ? null : (
              <button
                type="button"
                aria-label={`${labels.delete} ${comment.id}`}
                disabled={props.isMutating || isConfirmingDelete}
                onClick={() => {
                  setEditing(false);
                  setConfirmingDelete(true);
                }}
              >
                {labels.delete}
              </button>
            )}
          </div>
        )}
        {isConfirmingDelete && props.onDelete !== undefined ? (
          <div className="review-comment__delete-confirmation" role="alert">
            <p>{labels.confirmDelete}</p>
            <button
              type="button"
              aria-label={`削除をキャンセル ${comment.id}`}
              className="review-comment__delete-cancel"
              disabled={props.isMutating}
              onClick={() => setConfirmingDelete(false)}
            >
              {labels.cancel}
            </button>
            <button
              className="review-comment__delete-confirm"
              type="button"
              aria-label={`${labels.confirmDeleteAction} ${comment.id}`}
              disabled={props.isMutating}
              onClick={() => props.onDelete?.(comment.id)}
            >
              {labels.delete}
            </button>
          </div>
        ) : null}
        {props.footer}
      </div>
    </article>
  );
}

/** Converts an opaque comment id into a stable HTML id fragment. */
function toHtmlId(commentId: string): string {
  return encodeURIComponent(commentId);
}

function HighlightedText(
  props: Readonly<{ text: string; searchQuery: string }>,
): ReactNode {
  const query = props.searchQuery.toLocaleLowerCase();
  if (query.length === 0) {
    return props.text;
  }
  const lowerText = props.text.toLocaleLowerCase();
  const segments: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = lowerText.indexOf(query);
  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      segments.push(props.text.slice(cursor, matchIndex));
    }
    const matchEnd = matchIndex + query.length;
    segments.push(
      <mark className="comment-thread__search-match" key={matchIndex}>
        {props.text.slice(matchIndex, matchEnd)}
      </mark>,
    );
    cursor = matchEnd;
    matchIndex = lowerText.indexOf(query, cursor);
  }
  if (cursor < props.text.length) {
    segments.push(props.text.slice(cursor));
  }
  return segments;
}
