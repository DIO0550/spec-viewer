import { RefreshCcw } from "lucide-react";
import { useMemo, useRef } from "react";

import {
  CommentOperationIdleState,
  type CommentOperationState,
} from "@/features/comments/domain/commentOperation";
import { useMarkdownTextSelection } from "@/features/comments/hooks/useMarkdownTextSelection";
import type {
  AddCommentSubmitInput,
  Comment,
  CommentAnchorDisplayState,
  CommentId,
} from "@/features/comments/types/comment";
import { CommentAnchorDraftPopover } from "@/features/specs/components/CommentAnchorDraftPopover";
import { CommentEditPopover } from "@/features/specs/components/CommentEditPopover";
import { DocumentSearchControl } from "@/features/specs/components/DocumentSearchControl";
import {
  HtmlDocument,
  HtmlZoomControl,
} from "@/features/specs/components/HtmlDocument";
import { MarkdownDocument } from "@/features/specs/components/MarkdownDocument";
import { TextSelectionCommentButton } from "@/features/specs/components/TextSelectionCommentButton";
import { useActiveCommentScroll } from "@/features/specs/hooks/useActiveCommentScroll";
import { useCommentAnchorDisplayStates } from "@/features/specs/hooks/useCommentAnchorDisplayStates";
import { useCommentDrafts } from "@/features/specs/hooks/useCommentDrafts";
import { useDocumentSearch } from "@/features/specs/hooks/useDocumentSearch";
import { useFirstReadable } from "@/features/specs/hooks/useFirstReadable";
import { useHtmlZoom } from "@/features/specs/hooks/useHtmlZoom";
import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";
import {
  createViewerResetKey,
  useViewerReset,
} from "@/features/specs/hooks/useViewerReset";
import { uiText } from "@/shared/lib/uiText";

import { MarkdownViewerFallback } from "./MarkdownViewerFallback";

const emptyComments: readonly Comment[] = [];
const SYNTAX_HIGHLIGHT_MAX_BYTES = 200_000;
const idleCommentOperationState = CommentOperationIdleState.create();

/**
 * @param comment - Comment to evaluate
 * @returns Whether the comment should be rendered in the left Markdown viewer.
 */
function isVisibleInMarkdownViewer(comment: Comment): boolean {
  return !comment.resolved;
}

type Props = Readonly<{
  state: SpecDocumentState;
  selectedSpecLabel: string | null;
  selectedFileLabel: string | null;
  comments?: readonly Comment[];
  activeCommentId?: CommentId | null;
  isAddingComment?: boolean;
  addCommentErrorMessage?: string | null;
  isUpdatingComment?: boolean;
  operationState?: CommentOperationState;
  isCommentScopeReady?: boolean;
  /** Reloads the current document. */
  onReload: () => void;
  /**
   * @param input - Comment body and anchor submitted from the form
   * @returns Whether the comment was persisted.
   */
  onAddComment?: (input: AddCommentSubmitInput) => Promise<boolean>;
  /**
   * @param commentId - Comment being edited
   * @param body - Replacement body text
   * @returns Whether the update was persisted.
   */
  onUpdateComment?: (commentId: CommentId, body: string) => Promise<boolean>;
  /** @param commentId - Comment to resolve */
  onResolveComment?: (commentId: CommentId) => Promise<boolean>;
  /** @param commentId - Comment to reopen */
  onReopenComment?: (commentId: CommentId) => Promise<boolean>;
  /** @param commentId - Comment to delete */
  onDeleteComment?: (commentId: CommentId) => Promise<boolean>;
  /** @param commentId - Comment selected in the rendered document */
  onSelectComment?: (commentId: CommentId) => void;
  /** @param states - Anchor display states derived from the rendered DOM */
  onAnchorDisplayStatesChange?: (
    states: readonly CommentAnchorDisplayState[],
  ) => void;
  /** Notifies once per document when contents become readable. */
  onFirstReadable?: () => void;
}>;

/** @returns The Markdown viewer shell with document loading states. */
export function MarkdownViewer({
  state,
  selectedSpecLabel,
  selectedFileLabel,
  comments = emptyComments,
  activeCommentId = null,
  isAddingComment = false,
  addCommentErrorMessage = null,
  isUpdatingComment = false,
  operationState = idleCommentOperationState,
  isCommentScopeReady = true,
  onReload,
  onAddComment,
  onUpdateComment,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
  onSelectComment,
  onAnchorDisplayStatesChange,
  onFirstReadable,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const renderedRootRef = useRef<HTMLDivElement>(null);
  const resetKey = createViewerResetKey(state);
  const isHtmlDocument =
    state.status === "ready" && state.document.format === "html";
  const selectionFileKey =
    state.status === "ready" && !isHtmlDocument ? state.fileKey : null;
  const readyContents =
    state.status === "ready" ? state.document.contents : null;
  const correlationId =
    state.status === "ready" || state.status === "missing"
      ? state.correlationId
      : undefined;
  const { selectionDraft, clearSelectionDraft } = useMarkdownTextSelection({
    renderedRootRef,
    fileKey: selectionFileKey,
  });
  const visibleViewerComments = useMemo(
    () => comments.filter(isVisibleInMarkdownViewer),
    [comments],
  );
  useViewerReset(panelRef, resetKey, state.status !== "idle");
  useFirstReadable({
    status: state.status,
    readyContents,
    resetKey,
    correlationId,
    syntaxHighlightMaxBytes: SYNTAX_HIGHLIGHT_MAX_BYTES,
    onFirstReadable,
  });
  const drafts = useCommentDrafts({
    fileKey: selectionFileKey,
    resetKey,
    visibleComments: visibleViewerComments,
    clearSelectionDraft,
    onAddComment,
    onUpdateComment,
    onResolveComment,
    onReopenComment,
    onDeleteComment,
  });
  const anchorDisplayStates = useCommentAnchorDisplayStates({
    comments,
    renderedRootRef,
    status: state.status,
    readyContents,
    isHtmlDocument,
    resetKey,
    onChange: onAnchorDisplayStatesChange,
  });
  useActiveCommentScroll({
    activeCommentId,
    comments: visibleViewerComments,
    anchorDisplayStates,
    renderedRootRef,
  });
  const documentSearch = useDocumentSearch({
    renderedRootRef,
    readyContents,
    resetKey,
  });
  const htmlZoom = useHtmlZoom({ resetKey });

  if (state.status !== "ready") {
    return (
      <MarkdownViewerFallback
        panelRef={panelRef}
        state={state}
        selectedSpecLabel={selectedSpecLabel}
        onReload={onReload}
      />
    );
  }

  const contents = state.document.contents;

  if (contents === null || contents.trim().length === 0) {
    return (
      <MarkdownViewerFallback
        panelRef={panelRef}
        state={state}
        selectedSpecLabel={selectedSpecLabel}
        onReload={onReload}
      />
    );
  }

  return (
    <article
      ref={panelRef}
      id="markdown-viewer-panel"
      className={
        state.document.format === "html"
          ? "markdown-viewer markdown-viewer--html"
          : "markdown-viewer"
      }
      data-comment-dialog-open={
        drafts.activeAnchorDraft !== null || drafts.visibleEditDraft !== null
          ? "true"
          : undefined
      }
      role="tabpanel"
      tabIndex={-1}
    >
      <header className="markdown-viewer__header">
        <div>
          <p className="markdown-viewer__eyebrow">{selectedSpecLabel}</p>
          <h1>{selectedFileLabel ?? state.fileKey}</h1>
          <p className="markdown-viewer__path">{state.document.path}</p>
        </div>
        <div className="markdown-viewer__actions">
          {isHtmlDocument ? (
            <HtmlZoomControl
              zoomPercent={htmlZoom.zoomPercent}
              onDecrease={htmlZoom.decrease}
              onIncrease={htmlZoom.increase}
            />
          ) : (
            <DocumentSearchControl
              query={documentSearch.query}
              matchCount={documentSearch.matchCount}
              activeMatchIndex={documentSearch.activeMatchIndex}
              disabled={false}
              onQueryChange={documentSearch.changeQuery}
              onPrevious={documentSearch.goToPrevious}
              onNext={documentSearch.goToNext}
              onClear={documentSearch.clear}
            />
          )}
          <button
            className="icon-button"
            type="button"
            aria-label={uiText.markdown.reload}
            title={uiText.markdown.reload}
            onClick={onReload}
          >
            <RefreshCcw aria-hidden="true" size={16} />
          </button>
        </div>
      </header>
      {state.document.format === "html" ? (
        <HtmlDocument
          contents={contents}
          path={state.document.path}
          zoomPercent={htmlZoom.zoomPercent}
        />
      ) : (
        <>
          <MarkdownDocument
            contents={contents}
            blocks={state.document.blocks}
            renderedRootRef={renderedRootRef}
            comments={visibleViewerComments}
            activeCommentId={activeCommentId}
            anchorDisplayStates={anchorDisplayStates}
            documentSearchQuery={documentSearch.normalizedQuery}
            activeDocumentSearchIndex={documentSearch.activeMatchIndex}
            syntaxHighlightMaxBytes={SYNTAX_HIGHLIGHT_MAX_BYTES}
            onSelectComment={onSelectComment}
            onRequestCommentEdit={drafts.requestCommentEdit}
            onCreateBlockDraft={drafts.createBlockDraft}
          />
          <TextSelectionCommentButton
            draft={selectionDraft}
            onCreateDraft={drafts.openSelectionDraft}
          />
          <CommentAnchorDraftPopover
            draft={drafts.activeAnchorDraft}
            isSaving={isAddingComment}
            errorMessage={addCommentErrorMessage}
            isScopeReady={isCommentScopeReady}
            onSubmit={drafts.addComment}
            onCancel={drafts.closeAnchorDraft}
          />
          <CommentEditPopover
            draft={drafts.visibleEditDraft}
            isSaving={isUpdatingComment}
            operationState={operationState}
            onSubmit={drafts.updateComment}
            onResolveComment={drafts.resolveComment}
            onReopenComment={drafts.reopenComment}
            onDeleteComment={drafts.deleteComment}
            onCancel={drafts.closeEditDraft}
          />
        </>
      )}
    </article>
  );
}
