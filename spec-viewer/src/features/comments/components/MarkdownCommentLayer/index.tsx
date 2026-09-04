import {
  CheckCircle2,
  ChevronDown,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  cloneElement,
  type FormEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { AddCommentPopover } from "@/features/comments/components/AddCommentPopover";
import type { Comment } from "@/features/comments/domain/comment";
import type { CommentId } from "@/features/comments/domain/commentId";
import {
  type CommentOperationKind,
  CommentOperationSavingState,
  type CommentOperationState,
} from "@/features/comments/domain/commentOperation";
import {
  type MarkdownViewerCommentActions,
  type MarkdownViewerCommentEditDraft,
  useMarkdownViewerComments,
} from "@/features/comments/hooks/useMarkdownViewerComments";
import { useMarkdownTextSelection } from "@/features/comments/hooks/useMarkdownTextSelection";
import { createCommentAnchorDraftFromBlock } from "@/features/comments/lib/comment-anchor-draft";
import {
  createCommentAnchorDisplayStates,
  findCommentScrollTarget,
  type MarkdownCommentAnnotationProjection,
  type MarkdownCommentProjection,
  type MarkdownCommentRangeProjection,
} from "@/features/comments/lib/markdown-comment-projection";
import type {
  CommentAnchorDraft,
  CommentSelectionBounds,
} from "@/features/comments/types/comment";
import type {
  RenderedBlockModel,
  RenderedBlockProjection,
  RenderedDocumentPort,
  RenderedTextDecoration,
  SpecFileKey,
} from "@/features/specs";
import { uiText } from "@/utils/uiText";

export type MarkdownCommentLayerProps = Readonly<{
  fileKey: SpecFileKey;
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  addState: Readonly<{
    isSaving: boolean;
    errorMessage: string | null;
    isScopeReady: boolean;
  }>;
  editState: Readonly<{
    isSaving: boolean;
    operationState: CommentOperationState;
  }>;
  actions: MarkdownViewerCommentActions;
  children: (port: RenderedDocumentPort) => ReactNode;
}>;

/**
 * Adapts comment state and UI to the specs-owned rendered document port.
 * @param props - Comment data, grouped actions, and the pure viewer render slot.
 * @returns The caller-owned viewer decorated with comment interactions.
 */
export function MarkdownCommentLayer({
  fileKey,
  comments,
  activeCommentId,
  addState,
  editState,
  actions,
  children,
}: MarkdownCommentLayerProps) {
  const renderedRootRef = useRef<HTMLDivElement>(null);
  const readAnchorDisplayStates = useCallback(
    () =>
      createCommentAnchorDisplayStates({
        comments,
        renderedRoot: renderedRootRef.current,
      }),
    [comments],
  );
  const scrollActiveComment = useCallback((comment: Comment): void => {
    const target = findCommentScrollTarget({
      comment,
      renderedRoot: renderedRootRef.current,
    });

    if (target === null) {
      return;
    }

    target.scrollIntoView?.({ block: "center", behavior: "smooth" });
    target.focus({ preventScroll: true });
  }, []);
  const controller = useMarkdownViewerComments({
    fileKey,
    comments,
    activeCommentId,
    actions,
    readAnchorDisplayStates,
    scrollActiveComment,
  });
  const { selectionDraft, clearSelectionDraft } = useMarkdownTextSelection({
    renderedRootRef,
    fileKey,
  });

  const clearDraftSelection = useCallback((): void => {
    clearSelectionDraft();
    document.getSelection()?.removeAllRanges();
  }, [clearSelectionDraft]);

  const beginAnchorDraft = useCallback(
    (draft: CommentAnchorDraft): void => {
      controller.beginAnchorDraft(draft);
      clearDraftSelection();
    },
    [clearDraftSelection, controller.beginAnchorDraft],
  );

  const beginBlockDraft = useCallback(
    (block: HTMLElement): void => {
      const draft = createCommentAnchorDraftFromBlock({ block, fileKey });

      if (draft === null) {
        return;
      }

      beginAnchorDraft(draft);
    },
    [beginAnchorDraft, fileKey],
  );

  const projectBlock = useCallback(
    (block: RenderedBlockModel): RenderedBlockProjection =>
      createRenderedBlockProjection({
        block,
        projection: controller.projections.get(block.key) ?? null,
        beginBlockDraft,
        beginEditDraft: controller.beginEditDraft,
        selectComment: actions.select,
      }),
    [
      actions.select,
      beginBlockDraft,
      controller.beginEditDraft,
      controller.projections,
    ],
  );

  const overlay = useMemo(
    () => (
      <>
        <TextSelectionCommentButton
          draft={selectionDraft}
          onCreateDraft={beginAnchorDraft}
        />
        <CommentAnchorDraftPopover
          draft={controller.anchorDraft}
          addState={addState}
          onSubmit={controller.submitAdd}
          onCancel={controller.closeAnchorDraft}
        />
        <CommentEditPopover
          draft={controller.editDraft}
          editState={editState}
          onSubmit={controller.submitUpdate}
          onResolve={controller.submitResolve}
          onDelete={controller.submitDelete}
          onCancel={controller.closeEditDraft}
        />
      </>
    ),
    [
      addState,
      beginAnchorDraft,
      controller.anchorDraft,
      controller.closeAnchorDraft,
      controller.closeEditDraft,
      controller.editDraft,
      controller.submitAdd,
      controller.submitDelete,
      controller.submitResolve,
      controller.submitUpdate,
      editState,
      selectionDraft,
    ],
  );
  const renderOverlay = useCallback((): ReactNode => overlay, [overlay]);
  const port = useMemo<RenderedDocumentPort>(
    () => ({
      rootRef: renderedRootRef,
      isOverlayOpen:
        controller.anchorDraft !== null || controller.editDraft !== null,
      projectBlock,
      onRenderedDocumentCommit: controller.reconcileRenderedDocument,
      renderOverlay,
    }),
    [
      controller.anchorDraft,
      controller.editDraft,
      controller.reconcileRenderedDocument,
      projectBlock,
      renderOverlay,
    ],
  );

  return <>{children(port)}</>;
}

/** @returns One generic block projection backed by comment-specific UI. */
function createRenderedBlockProjection({
  block: _block,
  projection,
  beginBlockDraft,
  beginEditDraft,
  selectComment,
}: Readonly<{
  block: RenderedBlockModel;
  projection: MarkdownCommentProjection | null;
  beginBlockDraft: (block: HTMLElement) => void;
  beginEditDraft: (draft: MarkdownViewerCommentEditDraft) => void;
  selectComment: (commentId: CommentId) => void;
}>): RenderedBlockProjection {
  return {
    attributes: createProjectionAttributes(projection),
    textDecorations: createTextDecorations(projection?.ranges ?? []),
    renderContainer: (block, children) =>
      block.renderedType === "list-item" ? (
        <MarkdownCommentableListItem
          annotations={projection?.annotations ?? []}
          onCreateBlockDraft={beginBlockDraft}
          onRequestCommentEdit={beginEditDraft}
          onSelectComment={selectComment}
        >
          {children}
        </MarkdownCommentableListItem>
      ) : (
        <MarkdownCommentableBlock
          block={block}
          annotations={projection?.annotations ?? []}
          onCreateBlockDraft={beginBlockDraft}
          onRequestCommentEdit={beginEditDraft}
          onSelectComment={selectComment}
        >
          {children}
        </MarkdownCommentableBlock>
      ),
  };
}

/** @returns Generic DOM attributes representing one block comment projection. */
function createProjectionAttributes(
  projection: MarkdownCommentProjection | null,
): RenderedBlockProjection["attributes"] {
  if (projection === null) {
    return {};
  }

  return {
    "aria-label": createHighlightAriaLabel(projection.commentIds.length),
    "data-comment-highlight": "true",
    "data-comment-highlight-count": projection.commentIds.length,
    "data-comment-highlight-mode":
      projection.ranges.length > 0 ? "range" : "block",
    "data-comment-highlight-state": projection.state,
    "data-comment-ids": projection.commentIds.join(" "),
    tabIndex: -1,
  };
}

/** @returns Generic text decorations for exact comment ranges. */
function createTextDecorations(
  ranges: readonly MarkdownCommentRangeProjection[],
): readonly RenderedTextDecoration[] {
  return ranges.map((range) => ({
    key: `${range.commentId}:${range.start}:${range.end}`,
    start: range.start,
    end: range.end,
    render: (children) => (
      <span
        data-comment-highlight-range="true"
        data-comment-highlight-count={1}
        data-comment-highlight-state={range.state}
        data-comment-ids={range.commentId}
        aria-label={createHighlightAriaLabel(1)}
      >
        {children}
      </span>
    ),
  }));
}

/** @returns An accessible highlighted block label for a comment count. */
function createHighlightAriaLabel(count: number): string {
  const countLabel = count === 1 ? "1件のコメント" : `${count}件のコメント`;
  return `${countLabel}があるMarkdownブロック`;
}

type MarkdownCommentableBlockProps = Readonly<{
  block: RenderedBlockModel;
  annotations: readonly MarkdownCommentAnnotationProjection[];
  onCreateBlockDraft: (block: HTMLElement) => void;
  onRequestCommentEdit: (draft: MarkdownViewerCommentEditDraft) => void;
  onSelectComment: (commentId: CommentId) => void;
  children: ReactElement;
}>;

/** @returns A rendered block with comment affordance and annotation lane. */
function MarkdownCommentableBlock({
  block: _block,
  annotations,
  onCreateBlockDraft,
  onRequestCommentEdit,
  onSelectComment,
  children,
}: MarkdownCommentableBlockProps) {
  const createDraft = (event: MouseEvent<HTMLButtonElement>): void => {
    const blockElement =
      event.currentTarget.parentElement?.querySelector<HTMLElement>(
        "[data-block-type][data-block-index]",
      );

    if (blockElement === undefined || blockElement === null) {
      return;
    }

    onCreateBlockDraft(blockElement);
  };

  return (
    <div
      className="markdown-comment-target"
      data-has-comment-annotations={annotations.length > 0 ? "true" : undefined}
    >
      {children}
      <button
        className="markdown-block-comment-button"
        type="button"
        aria-label="コメント追加"
        title="コメント追加"
        onMouseDown={(event) => event.preventDefault()}
        onClick={createDraft}
      >
        <MessageSquarePlus aria-hidden="true" size={14} />
        <span>コメント追加</span>
      </button>
      <CommentAnnotationStack
        annotations={annotations}
        onSelectComment={onSelectComment}
        onRequestCommentEdit={onRequestCommentEdit}
      />
    </div>
  );
}

type MarkdownCommentableListItemProps = Omit<
  MarkdownCommentableBlockProps,
  "block"
>;

/** @returns A list item whose comment UI remains a valid direct li child. */
function MarkdownCommentableListItem({
  annotations,
  onCreateBlockDraft,
  onRequestCommentEdit,
  onSelectComment,
  children,
}: MarkdownCommentableListItemProps) {
  const listItem = children as ReactElement<{ children?: ReactNode }>;
  const createDraft = (event: MouseEvent<HTMLButtonElement>): void => {
    const blockElement = event.currentTarget.closest<HTMLElement>(
      "[data-block-type][data-block-index]",
    );

    if (blockElement === null) {
      return;
    }

    onCreateBlockDraft(blockElement);
  };

  return cloneElement(
    listItem,
    undefined,
    <>
      {listItem.props.children}
      <button
        className="markdown-block-comment-button markdown-block-comment-button--inline"
        type="button"
        aria-label="コメント追加"
        title="コメント追加"
        onMouseDown={(event) => event.preventDefault()}
        onClick={createDraft}
      >
        <MessageSquarePlus aria-hidden="true" size={14} />
      </button>
      <CommentAnnotationStack
        annotations={annotations}
        onSelectComment={onSelectComment}
        onRequestCommentEdit={onRequestCommentEdit}
      />
    </>,
  );
}

/** @returns Existing comment annotations for a rendered block. */
function CommentAnnotationStack({
  annotations,
  onSelectComment,
  onRequestCommentEdit,
}: Readonly<{
  annotations: readonly MarkdownCommentAnnotationProjection[];
  onSelectComment: (commentId: CommentId) => void;
  onRequestCommentEdit: (draft: MarkdownViewerCommentEditDraft) => void;
}>) {
  if (annotations.length === 0) {
    return null;
  }

  return (
    <aside className="markdown-comment-annotations" aria-label="既存コメント">
      {annotations.map((annotation) => (
        <CommentAnnotationCard
          key={annotation.comment.id}
          annotation={annotation}
          onSelectComment={onSelectComment}
          onRequestCommentEdit={onRequestCommentEdit}
        />
      ))}
    </aside>
  );
}

/** @returns A compact expandable annotation card for one comment. */
function CommentAnnotationCard({
  annotation,
  onSelectComment,
  onRequestCommentEdit,
}: Readonly<{
  annotation: MarkdownCommentAnnotationProjection;
  onSelectComment: (commentId: CommentId) => void;
  onRequestCommentEdit: (draft: MarkdownViewerCommentEditDraft) => void;
}>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const previewId = useId();
  const preview = createCommentPreview(annotation.comment.body);
  const statusLabel = formatAnnotationStatus(annotation);

  return (
    <article
      className="markdown-comment-annotation"
      data-active={annotation.isActive ? "true" : "false"}
      data-anchor-display-status={annotation.anchorDisplayStatus}
      data-expanded={isExpanded ? "true" : "false"}
      aria-current={annotation.isActive ? "true" : undefined}
    >
      <div className="markdown-comment-annotation__header">
        <button
          className="markdown-comment-annotation__toggle"
          type="button"
          aria-controls={previewId}
          aria-expanded={isExpanded}
          aria-label={
            isExpanded
              ? `コメントを閉じる ${statusLabel}`
              : `コメントを開く ${statusLabel}`
          }
          onClick={(event) => {
            event.stopPropagation();
            setIsExpanded((current) => !current);
          }}
        >
          {isExpanded ? (
            <ChevronDown aria-hidden="true" size={14} />
          ) : (
            <MessageSquare aria-hidden="true" size={14} />
          )}
        </button>
        <span className="markdown-comment-annotation__status">
          <MessageSquare aria-hidden="true" size={13} />
          {statusLabel}
        </span>
        {isExpanded ? (
          <button
            className="markdown-comment-annotation__select"
            type="button"
            aria-label={`コメント編集を開く ${preview}`}
            onClick={(event) => {
              event.stopPropagation();
              onSelectComment(annotation.comment.id);
              onRequestCommentEdit({
                comment: annotation.comment,
                selectionBounds: createSelectionBoundsFromElement(
                  event.currentTarget,
                ),
              });
            }}
          >
            <Pencil aria-hidden="true" size={13} />
          </button>
        ) : null}
      </div>
      {isExpanded ? (
        <p className="markdown-comment-annotation__preview" id={previewId}>
          {preview}
        </p>
      ) : null}
    </article>
  );
}

/** @returns The annotation status label for its anchor reconciliation state. */
function formatAnnotationStatus(
  annotation: MarkdownCommentAnnotationProjection,
): string {
  const labels = {
    moved: uiText.sidebar.moved,
    fuzzy: uiText.sidebar.fuzzy,
    stale: uiText.sidebar.stale,
    orphaned: uiText.sidebar.orphaned,
    exact: uiText.sidebar.openFilter,
  } as const;

  return labels[annotation.anchorDisplayStatus];
}

/** @returns A compact one-line preview of a comment body. */
function createCommentPreview(body: string): string {
  const maxLength = 84;
  const normalizedBody = body.replace(/\s+/g, " ").trim();

  if (normalizedBody.length === 0) {
    return uiText.commentThread.emptyBody;
  }

  if (normalizedBody.length <= maxLength) {
    return normalizedBody;
  }

  return `${normalizedBody.slice(0, maxLength - 1)}...`;
}

/** @returns A selection action adjacent to the selected Markdown text. */
function TextSelectionCommentButton({
  draft,
  onCreateDraft,
}: Readonly<{
  draft: CommentAnchorDraft | null;
  onCreateDraft: (draft: CommentAnchorDraft) => void;
}>) {
  if (draft === null) {
    return null;
  }

  return (
    <button
      className="text-selection-comment-button"
      type="button"
      style={createFloatingStyle(draft, "button")}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onCreateDraft(draft)}
    >
      <MessageSquarePlus aria-hidden="true" size={16} />
      <span>コメント追加</span>
    </button>
  );
}

/** @returns The add-comment popover for an active anchor draft. */
function CommentAnchorDraftPopover({
  draft,
  addState,
  onSubmit,
  onCancel,
}: Readonly<{
  draft: CommentAnchorDraft | null;
  addState: MarkdownCommentLayerProps["addState"];
  onSubmit: MarkdownViewerCommentActions["add"];
  onCancel: () => void;
}>) {
  if (draft === null) {
    return null;
  }

  return (
    <AddCommentPopover
      key={createCommentAnchorDraftKey(draft)}
      draft={draft}
      style={createFloatingStyle(draft, "popover")}
      isSaving={addState.isSaving}
      errorMessage={addState.errorMessage}
      isScopeReady={addState.isScopeReady}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}

/** @returns Stable identity for remounting an add form when its target changes. */
function createCommentAnchorDraftKey(draft: CommentAnchorDraft): string {
  const { anchor } = draft;
  return [
    anchor.fileKey,
    anchor.blockType,
    anchor.blockIndex,
    anchor.textHash,
    anchor.charRange.start,
    anchor.charRange.end,
  ].join(":");
}

/** @returns The edit/resolve/delete form for an active annotation. */
function CommentEditPopover({
  draft,
  editState,
  onSubmit,
  onResolve,
  onDelete,
  onCancel,
}: Readonly<{
  draft: MarkdownViewerCommentEditDraft | null;
  editState: MarkdownCommentLayerProps["editState"];
  onSubmit: MarkdownViewerCommentActions["update"];
  onResolve: MarkdownViewerCommentActions["resolve"];
  onDelete: MarkdownViewerCommentActions["delete"];
  onCancel: () => void;
}>) {
  const titleId = useId();
  const popoverRef = useRef<HTMLElement>(null);
  const [body, setBody] = useState(draft?.comment.body ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const commentId = draft?.comment.id ?? null;
  const isOperating =
    commentId !== null &&
    CommentOperationSavingState.isForComment(
      editState.operationState,
      commentId,
    );
  const isBusy = editState.isSaving || isOperating;
  const operationError = getCommentOperationErrorMessage(
    editState.operationState,
    commentId,
    ["update", "resolve", "delete"],
  );

  useEffect(() => {
    setBody(draft?.comment.body ?? "");
    setErrorMessage(null);
    setIsConfirmingDelete(false);
  }, [draft?.comment.id, draft?.comment.body]);

  useEffect(() => {
    const closeOnOutsideMouseDown = (event: globalThis.MouseEvent): void => {
      if (
        draft === null ||
        isBusy ||
        !(event.target instanceof Node) ||
        popoverRef.current?.contains(event.target)
      ) {
        return;
      }

      onCancel();
    };
    document.addEventListener("mousedown", closeOnOutsideMouseDown);
    return () =>
      document.removeEventListener("mousedown", closeOnOutsideMouseDown);
  }, [draft, isBusy, onCancel]);

  if (draft === null) {
    return null;
  }

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const nextBody = body.trim();

    if (nextBody.length === 0) {
      setErrorMessage(uiText.commentThread.emptyBody);
      return;
    }

    setErrorMessage(null);
    const wasSaved = await onSubmit(draft.comment.id, nextBody);

    if (!wasSaved) {
      setErrorMessage("コメントを更新できませんでした。再試行してください。");
    }
  };

  return (
    <aside
      ref={popoverRef}
      className="add-comment-popover add-comment-popover--edit"
      style={createFloatingPopoverStyle(draft.selectionBounds)}
      role="dialog"
      aria-labelledby={titleId}
    >
      <header className="add-comment-popover__header">
        <h2 id={titleId} className="add-comment-popover__title">
          コメント編集
        </h2>
        <button
          className="icon-button add-comment-popover__close-button"
          type="button"
          aria-label="コメント編集をキャンセル"
          disabled={isBusy}
          onClick={onCancel}
        >
          <X aria-hidden="true" size={14} />
        </button>
      </header>
      <form
        className="add-comment-popover__form"
        onSubmit={(event) => void submit(event)}
      >
        <div className="add-comment-popover__body">
          <blockquote>{draft.comment.anchor.textSnippet}</blockquote>
          <label htmlFor={`${titleId}-body`}>{uiText.sidebar.comments}</label>
          <textarea
            id={`${titleId}-body`}
            value={body}
            rows={4}
            disabled={isBusy}
            onInput={(event) => {
              setBody(event.currentTarget.value);
              setErrorMessage(null);
            }}
          />
          {(errorMessage ?? operationError) ? (
            <p className="add-comment-popover__error" role="alert">
              {errorMessage ?? operationError}
            </p>
          ) : null}
          {isConfirmingDelete ? (
            <div className="add-comment-popover__confirm" role="alert">
              <p>{uiText.commentThread.confirmDelete}</p>
              <button
                className="button button--danger"
                type="button"
                disabled={isBusy}
                onClick={() => void onDelete(draft.comment.id)}
              >
                {uiText.commentThread.delete}
              </button>
              <button
                className="button button--secondary"
                type="button"
                disabled={isBusy}
                onClick={() => setIsConfirmingDelete(false)}
              >
                {uiText.commentThread.cancel}
              </button>
            </div>
          ) : null}
        </div>
        <div className="add-comment-popover__status-actions">
          <button
            className="button button--secondary"
            type="button"
            disabled={isBusy}
            onClick={() => void onResolve(draft.comment.id)}
          >
            <CheckCircle2 aria-hidden="true" size={15} />
            {uiText.commentThread.resolve}
          </button>
          <button
            className="button button--danger"
            type="button"
            disabled={isBusy || isConfirmingDelete}
            onClick={() => setIsConfirmingDelete(true)}
          >
            <Trash2 aria-hidden="true" size={15} />
            {uiText.commentThread.delete}
          </button>
        </div>
        <div className="add-comment-popover__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
            disabled={isBusy}
          >
            {uiText.commentThread.cancel}
          </button>
          <button
            type="submit"
            className="button button--primary"
            disabled={isBusy || body.trim().length === 0}
          >
            {uiText.commentThread.save}
          </button>
        </div>
      </form>
    </aside>
  );
}

/** @returns An operation error scoped to the active comment and operations. */
function getCommentOperationErrorMessage(
  operationState: CommentOperationState,
  commentId: CommentId | null,
  operations: readonly CommentOperationKind[],
): string | null {
  if (
    commentId === null ||
    operationState.status !== "error" ||
    operationState.commentId !== commentId ||
    !operations.includes(operationState.operation)
  ) {
    return null;
  }

  return operationState.error.message;
}

type FloatingKind = "button" | "popover";
const floatingViewportMargin = 8;
const commentPopoverEstimatedHeight = 360;
const commentPopoverEstimatedWidth = 382;

/** @returns Viewport-clamped fixed positioning for selection UI. */
function createFloatingStyle(
  draft: CommentAnchorDraft,
  kind: FloatingKind,
): CSSProperties {
  const bounds = draft.selectionBounds;

  if (kind === "button") {
    return {
      top: Math.max(floatingViewportMargin, bounds.top - 44),
      left: Math.max(
        floatingViewportMargin,
        bounds.commentLaneLeft ?? bounds.left + bounds.width / 2,
      ),
      transform: bounds.commentLaneLeft === undefined ? undefined : "none",
    };
  }

  return createFloatingPopoverStyle(
    bounds.commentLaneLeft === undefined
      ? bounds
      : { ...bounds, left: bounds.commentLaneLeft, width: 0 },
  );
}

/** @returns Viewport-clamped fixed positioning for a comment popover. */
function createFloatingPopoverStyle(
  bounds: CommentSelectionBounds,
): CSSProperties {
  const preferredBelow = bounds.top + bounds.height + 10;
  const availableBelow =
    window.innerHeight - preferredBelow - floatingViewportMargin;
  const top =
    availableBelow >= commentPopoverEstimatedHeight
      ? Math.max(floatingViewportMargin, preferredBelow)
      : Math.max(
          floatingViewportMargin,
          bounds.top - commentPopoverEstimatedHeight - 10,
        );
  const maxLeft =
    window.innerWidth - commentPopoverEstimatedWidth - floatingViewportMargin;

  return {
    top,
    left: Math.max(
      floatingViewportMargin,
      Math.min(bounds.left, Math.max(floatingViewportMargin, maxLeft)),
    ),
  };
}

/** @returns Viewport coordinates used to anchor an edit dialog. */
function createSelectionBoundsFromElement(
  element: HTMLElement,
): CommentSelectionBounds {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}
