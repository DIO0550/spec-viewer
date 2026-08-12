import {
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";

export type DiffLineCommentTarget = Readonly<{
  key: string;
  side: "base" | "current";
  sidePath: string;
  oldPath?: string;
  newPath?: string;
  line: number;
}>;

export type DiffLineCommentSummary = Readonly<{
  id: string;
  createdAt: string;
  label: string;
}>;

export type DiffLineCommentControlProps = Readonly<{
  target: DiffLineCommentTarget;
  comments: readonly DiffLineCommentSummary[];
  activeCommentId: string | null;
  onStartDraft: (
    target: DiffLineCommentTarget,
    origin: HTMLButtonElement,
  ) => void;
  onSelectComment: (commentId: string) => void;
}>;

/**
 * Renders an accessible line add control or occupied-location indicator.
 *
 * @param props - Semantic target, comments at that target, and controlled actions.
 * @returns A plus button, a single indicator, or a deterministic convergence picker.
 */
export function DiffLineCommentControl(
  props: DiffLineCommentControlProps,
): ReactElement {
  const [isPickerOpen, setPickerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const label = `${props.target.sidePath} ${props.target.side} ${props.target.line}行目`;
  const orderedComments = [...props.comments].sort(compareComments);

  useEffect(() => {
    if (isPickerOpen) {
      itemRefs.current[0]?.focus({ preventScroll: true });
    }
  }, [isPickerOpen]);

  const handlePickerKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setPickerOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      (index + direction + orderedComments.length) % orderedComments.length;
    itemRefs.current[nextIndex]?.focus({ preventScroll: true });
  };

  if (orderedComments.length === 0) {
    return (
      <button
        type="button"
        className="diff-line-comment-control diff-line-comment-control--add"
        aria-label={`${label}にコメントを追加`}
        onClick={(event) =>
          props.onStartDraft(props.target, event.currentTarget)
        }
      >
        <span aria-hidden="true">+</span>
      </button>
    );
  }

  const firstComment = orderedComments[0];
  if (orderedComments.length === 1 && firstComment !== undefined) {
    return (
      <button
        type="button"
        className="diff-line-comment-control diff-line-comment-control--indicator"
        aria-label={`${label}のコメント1件を表示`}
        aria-current={
          firstComment.id === props.activeCommentId ? "true" : undefined
        }
        onClick={() => props.onSelectComment(firstComment.id)}
      >
        <span aria-hidden="true">1</span>
      </button>
    );
  }

  return (
    <span className="diff-line-comment-picker">
      <button
        ref={triggerRef}
        type="button"
        className="diff-line-comment-control diff-line-comment-control--indicator"
        aria-label={`${label}のコメント${orderedComments.length}件を選択`}
        aria-expanded={isPickerOpen}
        aria-controls={`${createControlId(props.target.key)}-picker`}
        aria-haspopup="menu"
        aria-current={
          orderedComments.some(
            (comment) => comment.id === props.activeCommentId,
          )
            ? "true"
            : undefined
        }
        onClick={() => setPickerOpen((current) => !current)}
      >
        <span aria-hidden="true">{orderedComments.length}</span>
      </button>
      {isPickerOpen ? (
        <span
          id={`${createControlId(props.target.key)}-picker`}
          className="diff-line-comment-picker__menu"
          role="menu"
          aria-label={`${label}のコメント`}
        >
          {orderedComments.map((comment, index) => (
            <button
              key={comment.id}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              aria-current={
                comment.id === props.activeCommentId ? "true" : undefined
              }
              onClick={() => {
                props.onSelectComment(comment.id);
                setPickerOpen(false);
              }}
              onKeyDown={(event) => handlePickerKeyDown(event, index)}
            >
              {comment.label}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}

function compareComments(
  left: DiffLineCommentSummary,
  right: DiffLineCommentSummary,
): number {
  const createdAtOrder = left.createdAt.localeCompare(right.createdAt);
  return createdAtOrder === 0
    ? left.id.localeCompare(right.id)
    : createdAtOrder;
}

function createControlId(targetKey: string): string {
  return `diff-line-comment-${targetKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
