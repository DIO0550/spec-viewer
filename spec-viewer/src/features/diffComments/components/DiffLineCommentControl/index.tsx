import { MessageSquare, MessageSquarePlus } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createRangeCommentTarget,
  createRangeCommentTargetFromNode,
  findRangeCommentPreviewElements,
} from "@/features/diffComments/lib/createRangeCommentTarget";

export type DiffLineCommentTarget = Readonly<{
  key: string;
  side: "base" | "current";
  sidePath: string;
  oldPath?: string;
  newPath?: string;
  line: number;
  endLine?: number;
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
 * Renders accessible comment navigation and addition controls for one line.
 *
 * @param props - Semantic target, comments at that target, and controlled actions.
 * @returns A standalone add button or a grouped indicator and add action.
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
      <DiffLineCommentAddControl
        target={props.target}
        label={label}
        variant="standalone"
        onStartDraft={props.onStartDraft}
      />
    );
  }

  const firstComment = orderedComments[0];
  if (orderedComments.length === 1 && firstComment !== undefined) {
    return (
      <span className="diff-line-comment-control-group">
        <button
          type="button"
          className="diff-line-comment-control diff-line-comment-control--indicator"
          data-comment-count={orderedComments.length}
          title={`${label}・未解決コメント1件`}
          aria-label={`${label}のコメント1件を表示`}
          aria-current={
            firstComment.id === props.activeCommentId ? "true" : undefined
          }
          onClick={() => props.onSelectComment(firstComment.id)}
        >
          <MessageSquare
            className="diff-line-comment-control__icon"
            aria-hidden="true"
            size={13}
          />
          <span className="diff-line-comment-control__count" aria-hidden="true">
            1
          </span>
        </button>
        <DiffLineCommentAddControl
          target={props.target}
          label={label}
          variant="grouped"
          onStartDraft={props.onStartDraft}
        />
      </span>
    );
  }

  return (
    <span className="diff-line-comment-control-group">
      <span className="diff-line-comment-picker">
        <button
          ref={triggerRef}
          type="button"
          className="diff-line-comment-control diff-line-comment-control--indicator"
          data-comment-count={orderedComments.length}
          title={`${label}・未解決コメント${orderedComments.length}件`}
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
          <MessageSquare
            className="diff-line-comment-control__icon"
            aria-hidden="true"
            size={13}
          />
          <span className="diff-line-comment-control__count" aria-hidden="true">
            {orderedComments.length}
          </span>
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
      <DiffLineCommentAddControl
        target={props.target}
        label={label}
        variant="grouped"
        onStartDraft={props.onStartDraft}
      />
    </span>
  );
}

type DiffLineCommentAddControlProps = Readonly<{
  target: DiffLineCommentTarget;
  label: string;
  variant: "standalone" | "grouped";
  onStartDraft: DiffLineCommentControlProps["onStartDraft"];
}>;

/**
 * Renders the pointer-draggable add action for an empty or occupied line.
 *
 * @param props - Target, accessible label, visual variant, and draft callback.
 * @returns An add-comment button that supports click and vertical range drag.
 */
function DiffLineCommentAddControl(
  props: DiffLineCommentAddControlProps,
): ReactElement {
  const activePointerIdRef = useRef<number | null>(null);
  const dragSelection = useDiffCommentDragSelection(props.onStartDraft);
  const className =
    props.variant === "grouped"
      ? "diff-line-comment-control diff-line-comment-control--add diff-line-comment-control--grouped"
      : "diff-line-comment-control diff-line-comment-control--add";

  return (
    <button
      type="button"
      className={className}
      aria-label={`${props.label}にコメントを追加`}
      title="コメントを追加（押したまま上下へドラッグして複数行を選択）"
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        activePointerIdRef.current = event.pointerId;
        if (isNativePointerEvent(event.nativeEvent)) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        dragSelection.begin(props.target, event.currentTarget);
      }}
      onPointerMove={(event) => {
        if (activePointerIdRef.current !== event.pointerId) {
          return;
        }
        dragSelection.update(
          document.elementFromPoint(event.clientX, event.clientY),
        );
      }}
      onPointerUp={(event) => {
        if (activePointerIdRef.current !== event.pointerId) {
          return;
        }
        if (
          isNativePointerEvent(event.nativeEvent) &&
          event.currentTarget.hasPointerCapture(event.pointerId)
        ) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        activePointerIdRef.current = null;
        dragSelection.commit();
      }}
      onPointerCancel={(event) => {
        if (activePointerIdRef.current !== event.pointerId) {
          return;
        }
        activePointerIdRef.current = null;
        dragSelection.cancel();
      }}
      onClick={(event) => {
        if (event.detail > 0) {
          return;
        }
        const target = createRangeCommentTarget(
          window.getSelection(),
          props.target,
        );
        props.onStartDraft(target, event.currentTarget);
      }}
    >
      <MessageSquarePlus
        className="diff-line-comment-control__icon"
        aria-hidden="true"
        size={props.variant === "grouped" ? 13 : 15}
      />
    </button>
  );
}

type DiffCommentDragSelection = Readonly<{
  begin: (target: DiffLineCommentTarget, origin: HTMLButtonElement) => void;
  update: (node: Node | null) => void;
  commit: () => void;
  cancel: () => void;
}>;

/**
 * Keeps pointer-driven line-range preview state outside React rendering.
 * This avoids remounting virtualized diff rows while the user drags.
 */
function useDiffCommentDragSelection(
  onCommit: DiffLineCommentControlProps["onStartDraft"],
): DiffCommentDragSelection {
  const originTargetRef = useRef<DiffLineCommentTarget | null>(null);
  const currentTargetRef = useRef<DiffLineCommentTarget | null>(null);
  const originRef = useRef<HTMLButtonElement | null>(null);
  const previewElementsRef = useRef<readonly HTMLElement[]>([]);

  const clearPreview = useCallback((): void => {
    for (const element of previewElementsRef.current) {
      delete element.dataset.diffCommentRangePreview;
    }
    previewElementsRef.current = [];
  }, []);

  const showPreview = useCallback(
    (target: DiffLineCommentTarget): void => {
      clearPreview();
      const elements = findRangeCommentPreviewElements(document, target);
      for (const element of elements) {
        element.dataset.diffCommentRangePreview = "true";
      }
      previewElementsRef.current = elements;
    },
    [clearPreview],
  );

  const reset = useCallback((): void => {
    clearPreview();
    if (originRef.current !== null) {
      delete originRef.current.dataset.diffCommentDragging;
    }
    originTargetRef.current = null;
    currentTargetRef.current = null;
    originRef.current = null;
  }, [clearPreview]);

  const begin = useCallback(
    (target: DiffLineCommentTarget, origin: HTMLButtonElement): void => {
      originTargetRef.current = target;
      currentTargetRef.current = target;
      originRef.current = origin;
      origin.dataset.diffCommentDragging = "true";
      showPreview(target);
    },
    [showPreview],
  );

  const update = useCallback(
    (node: Node | null): void => {
      const originTarget = originTargetRef.current;
      if (originTarget === null) {
        return;
      }
      const target = createRangeCommentTargetFromNode(node, originTarget);
      if (target === null) {
        return;
      }
      currentTargetRef.current = target;
      showPreview(target);
    },
    [showPreview],
  );

  const commit = useCallback((): void => {
    const target = currentTargetRef.current;
    const origin = originRef.current;
    reset();
    if (target !== null && origin !== null) {
      onCommit(target, origin);
    }
  }, [onCommit, reset]);

  const cancel = useCallback((): void => {
    reset();
  }, [reset]);

  useEffect(() => cancel, [cancel]);

  return { begin, update, commit, cancel };
}

function isNativePointerEvent(event: Event): event is PointerEvent {
  return (
    typeof globalThis.PointerEvent !== "undefined" &&
    event instanceof globalThis.PointerEvent
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
