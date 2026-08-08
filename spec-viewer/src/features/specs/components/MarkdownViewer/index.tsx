import {
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  type AriaRole,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  cloneElement,
  type FormEvent,
  isValidElement,
  type KeyboardEvent,
  type KeyboardEventHandler,
  type MouseEvent,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { AddCommentPopover } from "@/features/comments/components/AddCommentPopover";
import type { Comment } from "@/features/comments/domain/comment";
import type {
  CommentAnchor,
  CommentBlockType,
} from "@/features/comments/domain/commentAnchor";
import type { CommentId } from "@/features/comments/domain/commentId";
import {
  CommentOperationIdleState,
  type CommentOperationKind,
  CommentOperationSavingState,
  type CommentOperationState,
} from "@/features/comments/domain/commentOperation";
import { useMarkdownTextSelection } from "@/features/comments/hooks/useMarkdownTextSelection";
import { createCommentAnchorDraftFromBlock } from "@/features/comments/lib/comment-anchor-draft";
import type {
  AddCommentSubmitInput,
  CommentAnchorDisplayState,
  CommentAnchorDisplayStatus,
  CommentAnchorDraft,
  CommentSelectionBounds,
} from "@/features/comments/types/comment";
import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";
import {
  createViewerResetKey,
  useViewerReset,
} from "@/features/specs/hooks/useViewerReset";
import type {
  MarkdownBlockMetadata,
  MarkdownBlockType,
} from "@/features/specs/types/spec";
import {
  createHtmlSearchIndex,
  findHtmlSearchMatches,
} from "@/lib/htmlDocumentSearch";
import { recordPerformancePoint } from "@/lib/performance";
import { uiText } from "@/utils/uiText";
import { HtmlDocument } from "./HtmlDocument";
import {
  clampHtmlZoomPercent,
  formatHtmlZoomPercent,
  HTML_ZOOM_DEFAULT_PERCENT,
  HTML_ZOOM_MAX_PERCENT,
  HTML_ZOOM_MIN_PERCENT,
  HTML_ZOOM_STEP_PERCENT,
} from "./HtmlDocument/htmlPreviewDocument";
import { MarkdownViewerHeader } from "./MarkdownViewerHeader";
import { MarkdownViewerPanel } from "./MarkdownViewerPanel";
import { MarkdownViewerStatusPanel } from "./MarkdownViewerStatusPanel";

type BlockType = "heading" | "paragraph" | "list-item" | "table" | "code";

type BlockMetadata = Readonly<{
  "data-block-type": BlockType;
  "data-block-index": number;
  "data-comment-block-type"?: CommentBlockType;
  "data-text-hash"?: string;
  "data-text-snippet"?: string;
  "data-source-start-byte-offset"?: number;
  "data-source-end-byte-offset"?: number;
  "data-comment-highlight"?: "true";
  "data-comment-highlight-count"?: number;
  "data-comment-highlight-mode"?: CommentHighlightMode;
  "data-comment-highlight-state"?: CommentHighlightState;
  "data-comment-ids"?: string;
  "aria-label"?: string;
  role?: AriaRole;
  tabIndex?: number;
  onClick?: MouseEventHandler<Element>;
  onKeyDown?: KeyboardEventHandler<Element>;
}>;

type BlockIndexer = Readonly<{
  /**
   * Returns the next indexed block for the given block type.
   * @param blockType - The Markdown block type being indexed.
   */
  next: (blockType: BlockType) => IndexedBlock;
}>;

type CreateBlockCommentDraft = (block: HTMLElement) => void;

type RequestCommentEdit = (input: CommentEditDraft) => void;

type CommentHighlightState =
  | "open"
  | "resolved"
  | "active"
  | "stale"
  | "moved"
  | "fuzzy";

type CommentHighlightMode = "block" | "range";

type IndexedBlock = Readonly<{
  metadata: BlockMetadata;
  rangeHighlights: readonly CommentRangeHighlight[];
  commentAnnotations: readonly CommentBlockAnnotation[];
}>;

type BackendBlockMatch = Readonly<{
  block: MarkdownBlockMetadata;
  index: number;
}>;

type CommentBlockAnnotation = Readonly<{
  comment: Comment;
  anchorDisplayStatus: CommentAnchorDisplayStatus;
  isActive: boolean;
}>;

type CommentRangeHighlight = Readonly<{
  commentIds: readonly CommentId[];
  selectCommentId: CommentId;
  state: CommentHighlightState;
  start: number;
  end: number;
}>;

type DocumentSearchCursor = {
  query: string;
  activeIndex: number;
  matchIndex: number;
};

type CommentEditDraft = Readonly<{
  comment: Comment;
  selectionBounds: CommentSelectionBounds;
}>;

type CommentBlockHighlight = Readonly<{
  commentIds: readonly CommentId[];
  selectCommentId: CommentId;
  state: CommentHighlightState;
  rangeHighlights: readonly CommentRangeHighlight[];
  annotations: readonly CommentBlockAnnotation[];
}>;

type CommentBlockHighlights = ReadonlyMap<string, CommentBlockHighlight>;

const emptyComments: readonly Comment[] = [];
const SYNTAX_HIGHLIGHT_MAX_BYTES = 200_000;
const idleCommentOperationState = CommentOperationIdleState.create();

type Props = Readonly<{
  state: SpecDocumentState;
  selectedSpecLabel: string | null;
  selectedFileLabel: string | null;
  selectedFileTypeLabel?: string;
  comments?: readonly Comment[];
  activeCommentId?: CommentId | null;
  isAddingComment?: boolean;
  addCommentErrorMessage?: string | null;
  isUpdatingComment?: boolean;
  operationState?: CommentOperationState;
  isCommentScopeReady?: boolean;
  /**
   * Enables inline comment affordances. Set to `false` for read-only artifacts
   * (e.g. direct Markdown) so no block/selection comment UI is shown and no
   * comment anchor can be created against a non-commentable file.
   */
  commentsEnabled?: boolean;
  /** Reloads the current spec document. */
  onReload: () => void;
  onAddComment?: (input: AddCommentSubmitInput) => Promise<boolean>;
  onUpdateComment?: (commentId: CommentId, body: string) => Promise<boolean>;
  onResolveComment?: (commentId: CommentId) => Promise<boolean>;
  onReopenComment?: (commentId: CommentId) => Promise<boolean>;
  onDeleteComment?: (commentId: CommentId) => Promise<boolean>;
  onSelectComment?: (commentId: CommentId) => void;
  onAnchorDisplayStatesChange?: (
    states: readonly CommentAnchorDisplayState[],
  ) => void;
  onFirstReadable?: () => void;
}>;

/** @returns The Markdown viewer shell with document loading states. */
export function MarkdownViewer({
  state,
  selectedSpecLabel,
  selectedFileLabel,
  selectedFileTypeLabel,
  comments = emptyComments,
  activeCommentId = null,
  isAddingComment = false,
  addCommentErrorMessage = null,
  isUpdatingComment = false,
  operationState = idleCommentOperationState,
  isCommentScopeReady = true,
  commentsEnabled = true,
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
  const [activeAnchorDraft, setActiveAnchorDraft] =
    useState<CommentAnchorDraft | null>(null);
  const [activeEditDraft, setActiveEditDraft] =
    useState<CommentEditDraft | null>(null);
  const [anchorDisplayStates, setAnchorDisplayStates] = useState<
    readonly CommentAnchorDisplayState[]
  >([]);
  const [documentSearchQuery, setDocumentSearchQuery] = useState("");
  const [activeDocumentSearchIndex, setActiveDocumentSearchIndex] = useState(0);
  const [documentSearchMatchCount, setDocumentSearchMatchCount] = useState(0);
  const [htmlZoomPercent, setHtmlZoomPercent] = useState(
    HTML_ZOOM_DEFAULT_PERCENT,
  );
  const resetKey = createViewerResetKey(state);
  const isHtmlDocument =
    state.status === "ready" && state.document.format === "html";
  const normalizedDocumentSearchQuery =
    normalizeDocumentSearchQuery(documentSearchQuery);
  const selectionFileKey =
    state.status === "ready" && !isHtmlDocument && commentsEnabled
      ? state.fileKey
      : null;
  const readyContents =
    state.status === "ready" ? state.document.contents : null;
  const htmlSearchIndex = useMemo(() => {
    if (!isHtmlDocument || readyContents === null) {
      return null;
    }

    return createHtmlSearchIndex(readyContents);
  }, [isHtmlDocument, readyContents]);
  const htmlDocumentSearchMatches = useMemo(() => {
    if (htmlSearchIndex === null) {
      return [];
    }

    return findHtmlSearchMatches(
      htmlSearchIndex,
      normalizedDocumentSearchQuery,
    );
  }, [htmlSearchIndex, normalizedDocumentSearchQuery]);
  const correlationId =
    state.status === "ready" || state.status === "missing"
      ? state.correlationId
      : undefined;
  const firstReadableResetKeyRef = useRef<string | null>(null);
  const { selectionDraft, clearSelectionDraft } = useMarkdownTextSelection({
    renderedRootRef,
    fileKey: selectionFileKey,
  });
  const visibleViewerComments = useMemo(
    () => comments.filter(isVisibleInMarkdownViewer),
    [comments],
  );
  useViewerReset(panelRef, resetKey, state.status !== "idle");
  useEffect(() => {
    setActiveAnchorDraft(null);
    setActiveEditDraft(null);
    setAnchorDisplayStates([]);
    onAnchorDisplayStatesChange?.([]);
    setDocumentSearchQuery("");
    setActiveDocumentSearchIndex(0);
    setDocumentSearchMatchCount(0);
    setHtmlZoomPercent(HTML_ZOOM_DEFAULT_PERCENT);
  }, [onAnchorDisplayStatesChange, resetKey]);
  useLayoutEffect(() => {
    if (state.status !== "ready" || readyContents === null) {
      firstReadableResetKeyRef.current = null;
      return;
    }

    if (firstReadableResetKeyRef.current === resetKey) {
      return;
    }

    firstReadableResetKeyRef.current = resetKey;
    const byteLength = getUtf8ByteLength(readyContents);
    recordPerformancePoint(
      correlationId ?? resetKey,
      "document.firstReadable",
      {
        bytes: byteLength,
        syntaxHighlight: byteLength <= SYNTAX_HIGHLIGHT_MAX_BYTES,
      },
    );
    onFirstReadable?.();
  }, [correlationId, onFirstReadable, readyContents, resetKey, state.status]);
  useEffect(() => {
    setActiveDocumentSearchIndex(0);
  }, [normalizedDocumentSearchQuery]);
  useEffect(() => {
    if (state.status !== "ready" || readyContents === null || isHtmlDocument) {
      setAnchorDisplayStates([]);
      onAnchorDisplayStatesChange?.([]);
      return;
    }

    if (renderedRootRef.current === null) {
      return;
    }

    const nextStates = createCommentAnchorDisplayStates({
      comments,
      renderedRoot: renderedRootRef.current,
    });

    setAnchorDisplayStates(nextStates);
    onAnchorDisplayStatesChange?.(nextStates);
  }, [
    comments,
    isHtmlDocument,
    onAnchorDisplayStatesChange,
    readyContents,
    state.status,
  ]);
  useEffect(() => {
    scrollActiveCommentIntoView({
      activeCommentId,
      comments: visibleViewerComments,
      renderedRoot: renderedRootRef.current,
    });
  }, [activeCommentId, anchorDisplayStates, visibleViewerComments]);
  useEffect(() => {
    const nextMatchCount = isHtmlDocument
      ? htmlDocumentSearchMatches.length
      : countRenderedDocumentSearchMatches({
          renderedRoot: renderedRootRef.current,
          searchQuery: normalizedDocumentSearchQuery,
        });

    setDocumentSearchMatchCount(nextMatchCount);
    setActiveDocumentSearchIndex((currentIndex) =>
      clampDocumentSearchIndex(currentIndex, nextMatchCount),
    );
  }, [
    htmlDocumentSearchMatches.length,
    isHtmlDocument,
    normalizedDocumentSearchQuery,
    readyContents,
  ]);
  useEffect(() => {
    scrollActiveDocumentSearchMatchIntoView({
      renderedRoot: renderedRootRef.current,
      searchQuery: normalizedDocumentSearchQuery,
      matchCount: documentSearchMatchCount,
    });
  }, [
    normalizedDocumentSearchQuery,
    documentSearchMatchCount,
    activeDocumentSearchIndex,
  ]);
  useEffect(() => {
    if (activeEditDraft === null) {
      return;
    }

    const isCommentStillVisible = visibleViewerComments.some(
      (comment) => comment.id === activeEditDraft.comment.id,
    );

    if (!isCommentStillVisible) {
      setActiveEditDraft(null);
    }
  }, [activeEditDraft, visibleViewerComments]);

  const closeAnchorDraft = (): void => {
    setActiveAnchorDraft(null);
    clearBrowserSelection();
  };

  const closeEditDraft = (): void => {
    setActiveEditDraft(null);
  };

  const requestCommentEdit = (draft: CommentEditDraft): void => {
    setActiveAnchorDraft(null);
    clearSelectionDraft();
    clearBrowserSelection();
    setActiveEditDraft(draft);
  };

  /**
   * Starts a new comment anchor draft from a rendered Markdown block.
   * @param block - The block element the draft should anchor to.
   */
  const createBlockDraft = (block: HTMLElement): void => {
    if (state.status !== "ready" || state.document.format === "html") {
      return;
    }

    const draft = createCommentAnchorDraftFromBlock({
      block,
      fileKey: state.fileKey,
    });

    if (draft === null) {
      return;
    }

    setActiveAnchorDraft(draft);
    clearSelectionDraft();
    clearBrowserSelection();
  };

  /**
   * Submits a new comment and closes the anchor draft when it is saved.
   * @param input - The comment submission payload.
   * @returns Whether the comment was saved.
   */
  const addComment = async (input: AddCommentSubmitInput): Promise<boolean> => {
    if (onAddComment === undefined) {
      return false;
    }

    const wasSaved = await onAddComment(input);

    if (wasSaved) {
      closeAnchorDraft();
    }

    return wasSaved;
  };

  /**
   * Updates an existing comment body and closes the edit draft on success.
   * @param commentId - The identifier of the comment to update.
   * @param body - The new comment body text.
   * @returns Whether the comment was saved.
   */
  const updateComment = async (
    commentId: CommentId,
    body: string,
  ): Promise<boolean> => {
    if (onUpdateComment === undefined) {
      return false;
    }

    const wasSaved = await onUpdateComment(commentId, body);

    if (wasSaved) {
      closeEditDraft();
    }

    return wasSaved;
  };

  /**
   * Resolves the given comment through the resolve handler.
   * @param commentId - The identifier of the comment to resolve.
   * @returns Whether the comment was resolved.
   */
  const resolveComment = async (commentId: CommentId): Promise<boolean> => {
    if (onResolveComment === undefined) {
      return false;
    }

    return onResolveComment(commentId);
  };

  /**
   * Reopens the given comment through the reopen handler.
   * @param commentId - The identifier of the comment to reopen.
   * @returns Whether the comment was reopened.
   */
  const reopenComment = async (commentId: CommentId): Promise<boolean> => {
    if (onReopenComment === undefined) {
      return false;
    }

    return onReopenComment(commentId);
  };

  /**
   * Deletes the given comment and closes the edit draft on success.
   * @param commentId - The identifier of the comment to delete.
   * @returns Whether the comment was deleted.
   */
  const deleteComment = async (commentId: CommentId): Promise<boolean> => {
    if (onDeleteComment === undefined) {
      return false;
    }

    const wasDeleted = await onDeleteComment(commentId);

    if (wasDeleted) {
      closeEditDraft();
    }

    return wasDeleted;
  };

  /** Moves the active document search selection to the previous match. */
  const goToPreviousDocumentSearchMatch = (): void => {
    setActiveDocumentSearchIndex((currentIndex) =>
      getPreviousDocumentSearchIndex(currentIndex, documentSearchMatchCount),
    );
  };

  /** Moves the active document search selection to the next match. */
  const goToNextDocumentSearchMatch = (): void => {
    setActiveDocumentSearchIndex((currentIndex) =>
      getNextDocumentSearchIndex(currentIndex, documentSearchMatchCount),
    );
  };

  /** Clears the active document search query. */
  const clearDocumentSearch = (): void => {
    setDocumentSearchQuery("");
  };

  /** Decreases the HTML preview zoom by one step. */
  const decreaseHtmlZoom = (): void => {
    setHtmlZoomPercent((currentZoomPercent) =>
      clampHtmlZoomPercent(currentZoomPercent - HTML_ZOOM_STEP_PERCENT),
    );
  };

  /** Increases the HTML preview zoom by one step. */
  const increaseHtmlZoom = (): void => {
    setHtmlZoomPercent((currentZoomPercent) =>
      clampHtmlZoomPercent(currentZoomPercent + HTML_ZOOM_STEP_PERCENT),
    );
  };

  const visibleEditDraft = useMemo(
    () => createVisibleCommentEditDraft(activeEditDraft, visibleViewerComments),
    [activeEditDraft, visibleViewerComments],
  );

  if (
    state.status !== "ready" ||
    state.document.contents === null ||
    state.document.contents.trim().length === 0
  ) {
    return (
      <MarkdownViewerStatusPanel
        state={state}
        selectedSpecLabel={selectedSpecLabel}
        panelRef={panelRef}
        onReload={onReload}
      />
    );
  }

  const contents = state.document.contents;

  return (
    <MarkdownViewerPanel
      as="article"
      panelRef={panelRef}
      variant={state.document.format === "html" ? "html" : "default"}
      dataCommentDialogOpen={
        activeAnchorDraft !== null || activeEditDraft !== null
          ? "true"
          : undefined
      }
    >
      <MarkdownViewerHeader
        selectedSpecLabel={selectedSpecLabel}
        selectedFileLabel={selectedFileLabel}
        fileTypeLabel={selectedFileTypeLabel}
        fileKey={state.fileKey}
        path={state.document.path}
        htmlZoom={
          isHtmlDocument
            ? {
                zoomPercentLabel: formatHtmlZoomPercent(htmlZoomPercent),
                canDecrease: htmlZoomPercent > HTML_ZOOM_MIN_PERCENT,
                canIncrease: htmlZoomPercent < HTML_ZOOM_MAX_PERCENT,
                onDecrease: decreaseHtmlZoom,
                onIncrease: increaseHtmlZoom,
              }
            : null
        }
        documentSearch={{
          query: documentSearchQuery,
          statusText: formatDocumentSearchStatus({
            hasQuery: normalizedDocumentSearchQuery.length > 0,
            matchCount: documentSearchMatchCount,
            activeMatchIndex: activeDocumentSearchIndex,
          }),
          hasMatches: documentSearchMatchCount > 0,
          disabled: false,
          onQueryChange: setDocumentSearchQuery,
          onPrevious: goToPreviousDocumentSearchMatch,
          onNext: goToNextDocumentSearchMatch,
          onClear: clearDocumentSearch,
        }}
        onReload={onReload}
      />
      {state.document.format === "html" ? (
        <HtmlDocument
          contents={contents}
          path={state.document.path}
          zoomPercent={htmlZoomPercent}
          searchQuery={normalizedDocumentSearchQuery}
          activeSearchMatchIndex={activeDocumentSearchIndex}
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
            documentSearchQuery={normalizedDocumentSearchQuery}
            activeDocumentSearchIndex={activeDocumentSearchIndex}
            syntaxHighlightMaxBytes={SYNTAX_HIGHLIGHT_MAX_BYTES}
            onSelectComment={onSelectComment}
            onRequestCommentEdit={
              commentsEnabled ? requestCommentEdit : undefined
            }
            onCreateBlockDraft={commentsEnabled ? createBlockDraft : undefined}
          />
          {commentsEnabled ? (
            <>
              <TextSelectionCommentButton
                draft={selectionDraft}
                onCreateDraft={(draft) => {
                  setActiveAnchorDraft(draft);
                  clearSelectionDraft();
                }}
              />
              <CommentAnchorDraftPopover
                draft={activeAnchorDraft}
                isSaving={isAddingComment}
                errorMessage={addCommentErrorMessage}
                isScopeReady={isCommentScopeReady}
                onSubmit={addComment}
                onCancel={closeAnchorDraft}
              />
              <CommentEditPopover
                draft={visibleEditDraft}
                isSaving={isUpdatingComment}
                operationState={operationState}
                onSubmit={updateComment}
                onResolveComment={resolveComment}
                onReopenComment={reopenComment}
                onDeleteComment={deleteComment}
                onCancel={closeEditDraft}
              />
            </>
          ) : null}
        </>
      )}
    </MarkdownViewerPanel>
  );
}

/**
 * @param query - The raw search query text.
 * @returns Normalized document search query used for matching.
 */
function normalizeDocumentSearchQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

/** @returns Search status text shown next to document search controls. */
function formatDocumentSearchStatus({
  hasQuery,
  matchCount,
  activeMatchIndex,
}: Readonly<{
  hasQuery: boolean;
  matchCount: number;
  activeMatchIndex: number;
}>): string {
  if (!hasQuery || matchCount === 0) {
    return "0件";
  }

  return `${activeMatchIndex + 1}/${matchCount}`;
}

/** @returns Number of rendered search matches currently in the document. */
function countRenderedDocumentSearchMatches({
  renderedRoot,
  searchQuery,
}: Readonly<{
  renderedRoot: HTMLElement | null;
  searchQuery: string;
}>): number {
  if (renderedRoot === null || searchQuery.length === 0) {
    return 0;
  }

  return renderedRoot.querySelectorAll("[data-document-search-match]").length;
}

/**
 * @param index - The desired search match index.
 * @param matchCount - The total number of available matches.
 * @returns Active search index constrained to the available match count.
 */
function clampDocumentSearchIndex(index: number, matchCount: number): number {
  if (matchCount <= 0) {
    return 0;
  }

  return Math.min(index, matchCount - 1);
}

/** @returns Previous wrapped document search index. */
function getPreviousDocumentSearchIndex(
  currentIndex: number,
  matchCount: number,
): number {
  if (matchCount <= 0) {
    return 0;
  }

  return (currentIndex + matchCount - 1) % matchCount;
}

/** @returns Next wrapped document search index. */
function getNextDocumentSearchIndex(
  currentIndex: number,
  matchCount: number,
): number {
  if (matchCount <= 0) {
    return 0;
  }

  return (currentIndex + 1) % matchCount;
}

/** Scrolls the active document search match into view when available. */
function scrollActiveDocumentSearchMatchIntoView({
  renderedRoot,
  searchQuery,
  matchCount,
}: Readonly<{
  renderedRoot: HTMLElement | null;
  searchQuery: string;
  matchCount: number;
}>): void {
  if (renderedRoot === null || searchQuery.length === 0 || matchCount === 0) {
    return;
  }

  const activeMatch = renderedRoot.querySelector<HTMLElement>(
    '[data-document-search-match-active="true"]',
  );
  activeMatch?.scrollIntoView?.({ block: "center", inline: "nearest" });
}

type MarkdownDocumentProps = Readonly<{
  contents: string;
  blocks: readonly MarkdownBlockMetadata[];
  renderedRootRef: RefObject<HTMLDivElement | null>;
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  anchorDisplayStates: readonly CommentAnchorDisplayState[];
  documentSearchQuery: string;
  activeDocumentSearchIndex: number;
  syntaxHighlightMaxBytes: number;
  onSelectComment?: (commentId: CommentId) => void;
  onRequestCommentEdit?: RequestCommentEdit;
  onCreateBlockDraft?: CreateBlockCommentDraft;
}>;

/** @returns Rendered Markdown with stable block metadata for comments. */
function MarkdownDocument({
  contents,
  blocks,
  renderedRootRef,
  comments,
  activeCommentId,
  anchorDisplayStates,
  documentSearchQuery,
  activeDocumentSearchIndex,
  syntaxHighlightMaxBytes,
  onSelectComment,
  onRequestCommentEdit,
  onCreateBlockDraft,
}: MarkdownDocumentProps) {
  const anchorDisplayStateByCommentId =
    createAnchorDisplayStateByCommentId(anchorDisplayStates);
  const highlights = createCommentBlockHighlights({
    comments,
    activeCommentId,
    anchorDisplayStateByCommentId,
  });
  const blockIndexer = createBlockIndexer({
    blocks,
    highlights,
  });
  const documentSearchCursor = createDocumentSearchCursor({
    query: documentSearchQuery,
    activeIndex: activeDocumentSearchIndex,
  });
  const components = createMarkdownComponents({
    blockIndexer,
    documentSearchCursor,
    onCreateBlockDraft,
    onSelectComment,
    onRequestCommentEdit,
  });
  const shouldHighlightSyntax =
    getUtf8ByteLength(contents) <= syntaxHighlightMaxBytes;
  const rehypePlugins = shouldHighlightSyntax ? [rehypeHighlight] : [];

  return (
    <div
      ref={renderedRootRef}
      className="markdown-rendered"
      aria-label={uiText.markdown.renderedDocument}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {contents}
      </ReactMarkdown>
    </div>
  );
}

/**
 * @returns A sequential block indexer scoped to one Markdown render.
 * @throws {Error} When a rendered Markdown block has no matching backend block metadata.
 */
function createBlockIndexer({
  blocks,
  highlights,
}: Readonly<{
  blocks: readonly MarkdownBlockMetadata[];
  highlights: CommentBlockHighlights;
}>): BlockIndexer {
  let backendBlockCursor = 0;

  return {
    next: (blockType: BlockType): IndexedBlock => {
      const backendBlockMatch = findNextBackendBlockWithIndex({
        blocks,
        blockType,
        startIndex: backendBlockCursor,
      });
      if (backendBlockMatch === null) {
        throw new Error(
          "Markdown block metadata contract violation: missing backend metadata for " +
            blockType,
        );
      }

      const backendBlock = backendBlockMatch.block;
      const currentBlockIndex = backendBlock.blockIndex;
      const metadata: BlockMetadata = {
        "data-block-type": blockType,
        "data-block-index": currentBlockIndex,
      };
      const highlight = highlights.get(
        createBlockKey(blockType, currentBlockIndex),
      );

      backendBlockCursor = backendBlockMatch.index + 1;

      return {
        metadata: createHighlightedBlockMetadata({
          metadata: attachBackendBlockMetadata(metadata, backendBlock),
          highlight,
        }),
        rangeHighlights: highlight?.rangeHighlights ?? [],
        commentAnnotations: highlight?.annotations ?? [],
      };
    },
  };
}

/** @returns The next backend block and index that can describe this rendered block. */
function findNextBackendBlockWithIndex({
  blocks,
  blockType,
  startIndex,
}: Readonly<{
  blocks: readonly MarkdownBlockMetadata[];
  blockType: BlockType;
  startIndex: number;
}>): BackendBlockMatch | null {
  for (let index = startIndex; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (mapMarkdownBlockTypeToBlockType(block.blockType) === blockType) {
      return { block, index };
    }
  }

  return null;
}

/** @returns Rendered block attributes enriched with backend anchor metadata. */
function attachBackendBlockMetadata(
  metadata: BlockMetadata,
  block: MarkdownBlockMetadata,
): BlockMetadata {
  const sourceRange = block.sourceRange;
  const backendMetadata: BlockMetadata = {
    ...metadata,
    "data-block-index": block.blockIndex,
    "data-comment-block-type": block.blockType,
    "data-text-hash": block.textHash,
    "data-text-snippet": block.textSnippet,
  };

  if (sourceRange === null) {
    return backendMetadata;
  }

  return {
    ...backendMetadata,
    "data-source-start-byte-offset": sourceRange.startByteOffset,
    "data-source-end-byte-offset": sourceRange.endByteOffset,
  };
}

/** @returns Comment anchor states based on the currently rendered Markdown DOM. */
function createCommentAnchorDisplayStates({
  comments,
  renderedRoot,
}: Readonly<{
  comments: readonly Comment[];
  renderedRoot: HTMLElement | null;
}>): readonly CommentAnchorDisplayState[] {
  if (renderedRoot === null) {
    return [];
  }

  return comments.map((comment) => {
    const resolvedStatus = createResolvedAnchorDisplayStatus({
      comment,
      renderedRoot,
    });

    if (resolvedStatus !== null) {
      return {
        commentId: comment.id,
        status: resolvedStatus,
      };
    }

    const block = findCommentAnchorBlock({
      anchor: comment.anchor,
      renderedRoot,
    });

    if (block === null) {
      return {
        commentId: comment.id,
        status: "orphaned",
      };
    }

    const blockTextHash = readRenderedBlockTextHash(block);
    const status: CommentAnchorDisplayStatus =
      blockTextHash === comment.anchor.textHash ? "exact" : "stale";

    return {
      commentId: comment.id,
      status,
    };
  });
}

/** @returns The backend-resolved display status when command metadata is present. */
function createResolvedAnchorDisplayStatus({
  comment,
  renderedRoot,
}: Readonly<{
  comment: Comment;
  renderedRoot: HTMLElement;
}>): CommentAnchorDisplayStatus | null {
  const resolution = comment.anchorResolution;

  if (resolution === undefined || resolution === null) {
    return null;
  }

  if (resolution.status === "orphaned") {
    return "orphaned";
  }

  const targetBlock = findCommentResolutionTargetBlock({
    comment,
    renderedRoot,
  });

  if (targetBlock === null) {
    return "stale";
  }

  if (resolution.status === "resolved") {
    return "exact";
  }

  return resolution.status;
}

/**
 * @param block - The rendered block element to read the hash from.
 * @returns The required backend text hash for a rendered block.
 * @throws {Error} When the rendered block is missing its backend text hash.
 */
function readRenderedBlockTextHash(block: HTMLElement): string {
  const textHash = block.dataset.textHash;

  if (textHash !== undefined && textHash.trim().length > 0) {
    return textHash;
  }

  throw new Error(
    "Markdown block metadata contract violation: missing backend textHash",
  );
}

/** Scrolls the active comment's Markdown block into view when it exists. */
function scrollActiveCommentIntoView({
  activeCommentId,
  comments,
  renderedRoot,
}: Readonly<{
  activeCommentId: CommentId | null;
  comments: readonly Comment[];
  renderedRoot: HTMLElement | null;
}>): void {
  if (activeCommentId === null || renderedRoot === null) {
    return;
  }

  const activeComment = comments.find(
    (comment) => comment.id === activeCommentId,
  );

  if (activeComment === undefined) {
    return;
  }

  const block = findCommentBlockForScroll({
    comment: activeComment,
    renderedRoot,
  });

  if (block === null) {
    return;
  }

  if (typeof block.scrollIntoView === "function") {
    block.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  block.focus({ preventScroll: true });
}

/** @returns A lookup of display status by comment id. */
function createAnchorDisplayStateByCommentId(
  states: readonly CommentAnchorDisplayState[],
): ReadonlyMap<CommentId, CommentAnchorDisplayStatus> {
  return new Map(
    states.map((state) => [state.commentId, state.status] as const),
  );
}

/** @returns Markdown blocks grouped with comments that target each block. */
function createCommentBlockHighlights({
  comments,
  activeCommentId,
  anchorDisplayStateByCommentId,
}: Readonly<{
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  anchorDisplayStateByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >;
}>): CommentBlockHighlights {
  const commentsByBlock = new Map<string, Comment[]>();

  for (const comment of comments) {
    const key = createCommentHighlightBlockKey(comment);

    if (key === null) {
      continue;
    }

    const blockComments = commentsByBlock.get(key) ?? [];

    blockComments.push(comment);
    commentsByBlock.set(key, blockComments);
  }

  return new Map(
    Array.from(commentsByBlock.entries()).map(([key, blockComments]) => [
      key,
      createCommentBlockHighlight({
        comments: blockComments,
        activeCommentId,
        anchorDisplayStateByCommentId,
      }),
    ]),
  );
}

/** @returns Highlight metadata for all comments attached to one block. */
function createCommentBlockHighlight({
  comments,
  activeCommentId,
  anchorDisplayStateByCommentId,
}: Readonly<{
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  anchorDisplayStateByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >;
}>): CommentBlockHighlight {
  const state = selectCommentHighlightState({
    comments,
    activeCommentId,
    anchorDisplayStateByCommentId,
  });

  return {
    commentIds: comments.map((comment) => comment.id),
    selectCommentId: selectCommentIdForHighlight(comments, activeCommentId),
    state,
    rangeHighlights: createCommentRangeHighlights({
      comments,
      activeCommentId,
      anchorDisplayStateByCommentId,
    }),
    annotations: createCommentBlockAnnotations({
      comments,
      activeCommentId,
      anchorDisplayStateByCommentId,
    }),
  };
}

/** @returns Right-side annotation card models for comments attached to one block. */
function createCommentBlockAnnotations({
  comments,
  activeCommentId,
  anchorDisplayStateByCommentId,
}: Readonly<{
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  anchorDisplayStateByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >;
}>): readonly CommentBlockAnnotation[] {
  return comments.map((comment) => ({
    comment,
    anchorDisplayStatus:
      anchorDisplayStateByCommentId.get(comment.id) ?? "exact",
    isActive: comment.id === activeCommentId,
  }));
}

/**
 * @param comment - The comment whose anchor determines the highlight target.
 * @returns The rendered block key that should receive a comment highlight.
 */
function createCommentHighlightBlockKey(comment: Comment): string | null {
  const target = comment.anchorResolution?.target;

  if (comment.anchorResolution?.status === "orphaned") {
    return null;
  }

  if (target !== undefined && target !== null) {
    const blockType = mapCommentBlockTypeToBlockType(target.blockType);

    if (blockType === null) {
      return null;
    }

    return createBlockKey(blockType, target.blockIndex);
  }

  const blockType = mapCommentBlockTypeToBlockType(comment.anchor.blockType);

  if (blockType === null) {
    return null;
  }

  return createBlockKey(blockType, comment.anchor.blockIndex);
}

/** @returns The comment id to select when a highlighted block is activated. */
function selectCommentIdForHighlight(
  comments: readonly Comment[],
  activeCommentId: CommentId | null,
): CommentId {
  const activeComment = comments.find(
    (comment) => comment.id === activeCommentId,
  );

  if (activeComment !== undefined) {
    return activeComment.id;
  }

  const openComment = comments.find((comment) => comment.status !== "resolved");

  return openComment?.id ?? comments[0].id;
}

/** @returns The visual highlight state with active and stale states taking precedence. */
function selectCommentHighlightState({
  comments,
  activeCommentId,
  anchorDisplayStateByCommentId,
}: Readonly<{
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  anchorDisplayStateByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >;
}>): CommentHighlightState {
  const hasActiveComment = comments.some(
    (comment) => comment.id === activeCommentId,
  );

  if (hasActiveComment) {
    return "active";
  }

  const hasStaleComment = comments.some(
    (comment) => anchorDisplayStateByCommentId.get(comment.id) === "stale",
  );

  if (hasStaleComment) {
    return "stale";
  }

  const hasMovedComment = comments.some(
    (comment) => anchorDisplayStateByCommentId.get(comment.id) === "moved",
  );

  if (hasMovedComment) {
    return "moved";
  }

  const hasFuzzyComment = comments.some(
    (comment) => anchorDisplayStateByCommentId.get(comment.id) === "fuzzy",
  );

  if (hasFuzzyComment) {
    return "fuzzy";
  }

  const hasOpenComment = comments.some(
    (comment) => comment.status !== "resolved",
  );

  return hasOpenComment ? "open" : "resolved";
}

/** @returns Range-level highlights for exact anchors with a usable character range. */
function createCommentRangeHighlights({
  comments,
  activeCommentId,
  anchorDisplayStateByCommentId,
}: Readonly<{
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  anchorDisplayStateByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >;
}>): readonly CommentRangeHighlight[] {
  return comments.flatMap((comment) => {
    if (!isReliableRangeHighlight({ comment, anchorDisplayStateByCommentId })) {
      return [];
    }

    return [
      {
        commentIds: [comment.id],
        selectCommentId: comment.id,
        state:
          comment.id === activeCommentId
            ? "active"
            : selectExactRangeState(comment),
        start: comment.anchor.charRange.start,
        end: comment.anchor.charRange.end,
      },
    ];
  });
}

/** @returns true when the original selected text range is safe to emphasize. */
function isReliableRangeHighlight({
  comment,
  anchorDisplayStateByCommentId,
}: Readonly<{
  comment: Comment;
  anchorDisplayStateByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >;
}>): boolean {
  if (anchorDisplayStateByCommentId.get(comment.id) !== "exact") {
    return false;
  }

  if (comment.anchor.blockType === "code_block") {
    return false;
  }

  return comment.anchor.charRange.end > comment.anchor.charRange.start;
}

/**
 * @param comment - The comment backing the range highlight.
 * @returns The subdued or prominent state for an exact range highlight.
 */
function selectExactRangeState(comment: Comment): CommentHighlightState {
  return comment.status === "resolved" ? "resolved" : "open";
}

/** @returns Block metadata with highlight attributes and selection handlers. */
function createHighlightedBlockMetadata({
  metadata,
  highlight,
}: Readonly<{
  metadata: BlockMetadata;
  highlight: CommentBlockHighlight | undefined;
}>): BlockMetadata {
  if (highlight === undefined) {
    return metadata;
  }

  const highlightedMetadata: BlockMetadata = {
    ...metadata,
    "aria-label": createHighlightAriaLabel(highlight),
    "data-comment-highlight": "true",
    "data-comment-highlight-count": highlight.commentIds.length,
    "data-comment-highlight-mode":
      highlight.rangeHighlights.length > 0 ? "range" : "block",
    "data-comment-highlight-state": highlight.state,
    "data-comment-ids": highlight.commentIds.join(" "),
  };

  return highlightedMetadata;
}

/** @returns An accessible description for a highlighted Markdown block. */
function createHighlightAriaLabel(
  highlight: Pick<CommentBlockHighlight, "commentIds">,
): string {
  const countLabel =
    highlight.commentIds.length === 1
      ? "1件のコメント"
      : `${highlight.commentIds.length}件のコメント`;

  return `${countLabel}があるMarkdownブロック`;
}

/** @returns The rendered Markdown block for a persisted comment anchor. */
function findCommentAnchorBlock({
  anchor,
  renderedRoot,
}: Readonly<{
  anchor: CommentAnchor;
  renderedRoot: HTMLElement;
}>): HTMLElement | null {
  const blockType = mapCommentBlockTypeToBlockType(anchor.blockType);

  if (blockType === null) {
    return null;
  }

  return renderedRoot.querySelector<HTMLElement>(
    `[data-block-type="${blockType}"][data-block-index="${anchor.blockIndex}"]`,
  );
}

/** @returns The rendered Markdown block for a backend-resolved target. */
function findCommentResolutionTargetBlock({
  comment,
  renderedRoot,
}: Readonly<{
  comment: Comment;
  renderedRoot: HTMLElement;
}>): HTMLElement | null {
  const target = comment.anchorResolution?.target;

  if (target === undefined || target === null) {
    return findCommentAnchorBlock({
      anchor: comment.anchor,
      renderedRoot,
    });
  }

  const blockType = mapCommentBlockTypeToBlockType(target.blockType);

  if (blockType === null) {
    return null;
  }

  return renderedRoot.querySelector<HTMLElement>(
    `[data-block-type="${blockType}"][data-block-index="${target.blockIndex}"]`,
  );
}

/** @returns The best block to scroll for a selected comment. */
function findCommentBlockForScroll({
  comment,
  renderedRoot,
}: Readonly<{
  comment: Comment;
  renderedRoot: HTMLElement;
}>): HTMLElement | null {
  if (comment.anchorResolution?.status === "orphaned") {
    return null;
  }

  return findCommentResolutionTargetBlock({ comment, renderedRoot });
}

/** @returns The rendered Markdown block type corresponding to a persisted anchor. */
function mapCommentBlockTypeToBlockType(
  blockType: CommentBlockType,
): BlockType | null {
  const blockTypeMap: Partial<Record<CommentBlockType, BlockType>> = {
    heading: "heading",
    paragraph: "paragraph",
    block_quote: "paragraph",
    list_item: "list-item",
    table: "table",
    code_block: "code",
  };

  return blockTypeMap[blockType] ?? null;
}

/** @returns The rendered block type corresponding to backend Markdown metadata. */
function mapMarkdownBlockTypeToBlockType(
  blockType: MarkdownBlockType,
): BlockType | null {
  const blockTypeMap: Partial<Record<MarkdownBlockType, BlockType>> = {
    heading: "heading",
    paragraph: "paragraph",
    block_quote: "paragraph",
    list_item: "list-item",
    table: "table",
    code_block: "code",
  };

  return blockTypeMap[blockType] ?? null;
}

/**
 * @param blockType - The Markdown block type.
 * @param blockIndex - The zero-based index of the block within the render.
 * @returns A stable key for one rendered Markdown block.
 */
function createBlockKey(blockType: BlockType, blockIndex: number): string {
  return `${blockType}:${blockIndex}`;
}

/** @returns React Markdown component overrides with comment anchor metadata. */
function createMarkdownComponents({
  blockIndexer,
  documentSearchCursor,
  onCreateBlockDraft,
  onSelectComment,
  onRequestCommentEdit,
}: Readonly<{
  blockIndexer: BlockIndexer;
  documentSearchCursor: DocumentSearchCursor | null;
  onCreateBlockDraft?: CreateBlockCommentDraft;
  onSelectComment?: (commentId: CommentId) => void;
  onRequestCommentEdit?: RequestCommentEdit;
}>): Components {
  return {
    h1: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("heading");

      return (
        <MarkdownCommentableBlock
          commentAnnotations={block.commentAnnotations}
          onCreateBlockDraft={onCreateBlockDraft}
          onSelectComment={onSelectComment}
          onRequestCommentEdit={onRequestCommentEdit}
        >
          <h1 {...props} {...block.metadata}>
            {renderMarkdownTextChildren({
              children,
              rangeHighlights: block.rangeHighlights,
              documentSearchCursor,
            })}
          </h1>
        </MarkdownCommentableBlock>
      );
    },
    h2: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("heading");

      return (
        <MarkdownCommentableBlock
          commentAnnotations={block.commentAnnotations}
          onCreateBlockDraft={onCreateBlockDraft}
          onSelectComment={onSelectComment}
          onRequestCommentEdit={onRequestCommentEdit}
        >
          <h2 {...props} {...block.metadata}>
            {renderMarkdownTextChildren({
              children,
              rangeHighlights: block.rangeHighlights,
              documentSearchCursor,
            })}
          </h2>
        </MarkdownCommentableBlock>
      );
    },
    h3: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("heading");

      return (
        <MarkdownCommentableBlock
          commentAnnotations={block.commentAnnotations}
          onCreateBlockDraft={onCreateBlockDraft}
          onSelectComment={onSelectComment}
          onRequestCommentEdit={onRequestCommentEdit}
        >
          <h3 {...props} {...block.metadata}>
            {renderMarkdownTextChildren({
              children,
              rangeHighlights: block.rangeHighlights,
              documentSearchCursor,
            })}
          </h3>
        </MarkdownCommentableBlock>
      );
    },
    h4: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("heading");

      return (
        <MarkdownCommentableBlock
          commentAnnotations={block.commentAnnotations}
          onCreateBlockDraft={onCreateBlockDraft}
          onSelectComment={onSelectComment}
          onRequestCommentEdit={onRequestCommentEdit}
        >
          <h4 {...props} {...block.metadata}>
            {renderMarkdownTextChildren({
              children,
              rangeHighlights: block.rangeHighlights,
              documentSearchCursor,
            })}
          </h4>
        </MarkdownCommentableBlock>
      );
    },
    h5: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("heading");

      return (
        <MarkdownCommentableBlock
          commentAnnotations={block.commentAnnotations}
          onCreateBlockDraft={onCreateBlockDraft}
          onSelectComment={onSelectComment}
          onRequestCommentEdit={onRequestCommentEdit}
        >
          <h5 {...props} {...block.metadata}>
            {renderMarkdownTextChildren({
              children,
              rangeHighlights: block.rangeHighlights,
              documentSearchCursor,
            })}
          </h5>
        </MarkdownCommentableBlock>
      );
    },
    h6: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("heading");

      return (
        <MarkdownCommentableBlock
          commentAnnotations={block.commentAnnotations}
          onCreateBlockDraft={onCreateBlockDraft}
          onSelectComment={onSelectComment}
          onRequestCommentEdit={onRequestCommentEdit}
        >
          <h6 {...props} {...block.metadata}>
            {renderMarkdownTextChildren({
              children,
              rangeHighlights: block.rangeHighlights,
              documentSearchCursor,
            })}
          </h6>
        </MarkdownCommentableBlock>
      );
    },
    p: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("paragraph");

      return (
        <MarkdownCommentableBlock
          commentAnnotations={block.commentAnnotations}
          onCreateBlockDraft={onCreateBlockDraft}
          onSelectComment={onSelectComment}
          onRequestCommentEdit={onRequestCommentEdit}
        >
          <p {...props} {...block.metadata}>
            {renderMarkdownTextChildren({
              children,
              rangeHighlights: block.rangeHighlights,
              documentSearchCursor,
            })}
          </p>
        </MarkdownCommentableBlock>
      );
    },
    li: ({ children, ...props }) => {
      const block = blockIndexer.next("list-item");

      return (
        <MarkdownListItem
          {...props}
          {...block.metadata}
          commentAnnotations={block.commentAnnotations}
          onCreateBlockDraft={onCreateBlockDraft}
          onSelectComment={onSelectComment}
          onRequestCommentEdit={onRequestCommentEdit}
        >
          {renderMarkdownTextChildren({
            children,
            rangeHighlights: block.rangeHighlights,
            documentSearchCursor,
          })}
        </MarkdownListItem>
      );
    },
    pre: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("code");

      return (
        <MarkdownCommentableBlock
          commentAnnotations={block.commentAnnotations}
          onCreateBlockDraft={onCreateBlockDraft}
          onSelectComment={onSelectComment}
          onRequestCommentEdit={onRequestCommentEdit}
        >
          <pre {...props} {...block.metadata}>
            {renderMarkdownTextChildren({
              children,
              rangeHighlights: block.rangeHighlights,
              documentSearchCursor,
            })}
          </pre>
        </MarkdownCommentableBlock>
      );
    },
    table: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("table");

      return (
        <MarkdownCommentableBlock
          commentAnnotations={block.commentAnnotations}
          onCreateBlockDraft={onCreateBlockDraft}
          onSelectComment={onSelectComment}
          onRequestCommentEdit={onRequestCommentEdit}
        >
          <div className="markdown-rendered__table-scroll" {...block.metadata}>
            <table {...props}>
              {renderMarkdownTextChildren({
                children,
                rangeHighlights: block.rangeHighlights,
                documentSearchCursor,
              })}
            </table>
          </div>
        </MarkdownCommentableBlock>
      );
    },
    /**
     * Renders anchors with safe external navigation defaults.
     * @param props - React Markdown props for the anchor element.
     */
    a: ({ node: _node, ...props }) => <SafeMarkdownLink {...props} />,
    /**
     * Renders task-list inputs as read-only controls.
     * @param props - React Markdown props for the input element.
     */
    input: ({ node: _node, ...props }) => <ReadOnlyMarkdownInput {...props} />,
  };
}

type MarkdownCommentableBlockProps = Readonly<{
  children: ReactElement;
  commentAnnotations: readonly CommentBlockAnnotation[];
  onCreateBlockDraft?: CreateBlockCommentDraft;
  onSelectComment?: (commentId: CommentId) => void;
  onRequestCommentEdit?: RequestCommentEdit;
}>;

/** @returns A rendered Markdown block with a gutter comment affordance. */
function MarkdownCommentableBlock({
  children,
  commentAnnotations,
  onCreateBlockDraft,
  onSelectComment,
  onRequestCommentEdit,
}: MarkdownCommentableBlockProps) {
  const createDraftFromRenderedBlock = (
    event: MouseEvent<HTMLButtonElement>,
  ): void => {
    const block = event.currentTarget.parentElement?.querySelector<HTMLElement>(
      "[data-block-type][data-block-index]",
    );

    if (block === undefined || block === null) {
      return;
    }

    onCreateBlockDraft?.(block);
  };

  return (
    <div
      className="markdown-comment-target"
      data-has-comment-annotations={
        commentAnnotations.length > 0 ? "true" : undefined
      }
    >
      {children}
      {onCreateBlockDraft !== undefined ? (
        <button
          className="markdown-block-comment-button"
          type="button"
          aria-label="コメント追加"
          title="コメント追加"
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={createDraftFromRenderedBlock}
        >
          <MessageSquarePlus aria-hidden="true" size={14} />
          <span>コメント追加</span>
        </button>
      ) : null}
      <CommentAnnotationStack
        annotations={commentAnnotations}
        onSelectComment={onSelectComment}
        onRequestCommentEdit={onRequestCommentEdit}
      />
    </div>
  );
}

type CommentAnnotationStackProps = Readonly<{
  annotations: readonly CommentBlockAnnotation[];
  onSelectComment?: (commentId: CommentId) => void;
  onRequestCommentEdit?: RequestCommentEdit;
}>;

/** @returns Right-side existing comment cards for one rendered Markdown block. */
function CommentAnnotationStack({
  annotations,
  onSelectComment,
  onRequestCommentEdit,
}: CommentAnnotationStackProps) {
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

type CommentAnnotationCardProps = Readonly<{
  annotation: CommentBlockAnnotation;
  onSelectComment?: (commentId: CommentId) => void;
  onRequestCommentEdit?: RequestCommentEdit;
}>;

/** @returns A compact selectable preview for one existing comment. */
function CommentAnnotationCard({
  annotation,
  onSelectComment,
  onRequestCommentEdit,
}: CommentAnnotationCardProps) {
  const { comment, anchorDisplayStatus, isActive } = annotation;
  const [isExpanded, setIsExpanded] = useState(false);
  const previewId = useId();
  const statusLabel = formatCommentAnnotationStatus(
    comment,
    anchorDisplayStatus,
  );
  const preview = createCommentPreview(comment.body);
  const toggleExpanded = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    setIsExpanded((current) => !current);
  };
  const selectComment = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();

    if (onRequestCommentEdit !== undefined) {
      onRequestCommentEdit({
        comment,
        selectionBounds: createSelectionBoundsFromElement(event.currentTarget),
      });
      return;
    }

    onSelectComment?.(comment.id);
  };

  return (
    <article
      className="markdown-comment-annotation"
      data-active={isActive ? "true" : "false"}
      data-anchor-display-status={anchorDisplayStatus}
      data-expanded={isExpanded ? "true" : "false"}
      data-resolved={comment.status === "resolved" ? "true" : "false"}
      aria-current={isActive ? "true" : undefined}
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
          title={isExpanded ? "コメントを閉じる" : "コメントを開く"}
          onClick={toggleExpanded}
        >
          {isExpanded ? (
            <ChevronDown aria-hidden="true" size={14} />
          ) : comment.status === "resolved" ? (
            <CheckCircle2 aria-hidden="true" size={14} />
          ) : (
            <MessageSquare aria-hidden="true" size={14} />
          )}
        </button>
        <span className="markdown-comment-annotation__status">
          {comment.status === "resolved" ? (
            <CheckCircle2 aria-hidden="true" size={13} />
          ) : (
            <MessageSquare aria-hidden="true" size={13} />
          )}
          {statusLabel}
        </span>
        {isExpanded ? (
          <button
            className="markdown-comment-annotation__select"
            type="button"
            aria-label={`コメント編集を開く ${preview}`}
            title="コメント編集を開く"
            onClick={selectComment}
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

/** @returns The status label shown inside a block-level annotation card. */
function formatCommentAnnotationStatus(
  comment: Comment,
  anchorDisplayStatus: CommentAnchorDisplayStatus,
): string {
  if (anchorDisplayStatus === "moved") {
    return uiText.sidebar.moved;
  }

  if (anchorDisplayStatus === "fuzzy") {
    return uiText.sidebar.fuzzy;
  }

  if (anchorDisplayStatus === "stale") {
    return uiText.sidebar.stale;
  }

  if (anchorDisplayStatus === "orphaned") {
    return uiText.sidebar.orphaned;
  }

  return comment.status === "resolved"
    ? uiText.sidebar.resolved
    : uiText.sidebar.openFilter;
}

const COMMENT_PREVIEW_MAX_LENGTH = 84;

/**
 * @param body - The full comment body text.
 * @returns A compact single-line preview for a comment body.
 */
function createCommentPreview(body: string): string {
  const normalizedBody = body.replace(/\s+/g, " ").trim();

  if (normalizedBody.length === 0) {
    return uiText.commentThread.emptyBody;
  }

  if (normalizedBody.length <= COMMENT_PREVIEW_MAX_LENGTH) {
    return normalizedBody;
  }

  return `${normalizedBody.slice(0, COMMENT_PREVIEW_MAX_LENGTH - 1)}...`;
}

/** @returns A render-scoped cursor for document search matches. */
function createDocumentSearchCursor({
  query,
  activeIndex,
}: Readonly<{
  query: string;
  activeIndex: number;
}>): DocumentSearchCursor | null {
  if (query.length === 0) {
    return null;
  }

  return {
    query,
    activeIndex,
    matchIndex: 0,
  };
}

/** @returns Markdown children with comment and document search highlights. */
function renderMarkdownTextChildren({
  children,
  rangeHighlights,
  documentSearchCursor,
}: Readonly<{
  children: ReactNode;
  rangeHighlights: readonly CommentRangeHighlight[];
  documentSearchCursor: DocumentSearchCursor | null;
}>): ReactNode {
  const commentHighlightedChildren = renderRangeHighlightedChildren(
    children,
    rangeHighlights,
  );

  if (documentSearchCursor === null) {
    return commentHighlightedChildren;
  }

  return renderDocumentSearchHighlightedNode(
    commentHighlightedChildren,
    documentSearchCursor,
  );
}

type RangeRenderCursor = {
  position: number;
  keyIndex: number;
};

/** @returns Markdown children with exact comment ranges wrapped for emphasis. */
function renderRangeHighlightedChildren(
  children: ReactNode,
  rangeHighlights: readonly CommentRangeHighlight[],
): ReactNode {
  if (rangeHighlights.length === 0) {
    return children;
  }

  const cursor: RangeRenderCursor = {
    position: 0,
    keyIndex: 0,
  };
  const sortedHighlights = [...rangeHighlights].sort(
    (left, right) => left.start - right.start,
  );

  return renderRangeHighlightedNode(children, sortedHighlights, cursor);
}

/** @returns One React node with range highlight spans inserted into text descendants. */
function renderRangeHighlightedNode(
  node: ReactNode,
  rangeHighlights: readonly CommentRangeHighlight[],
  cursor: RangeRenderCursor,
): ReactNode {
  if (typeof node === "string" || typeof node === "number") {
    return renderRangeHighlightedText(String(node), rangeHighlights, cursor);
  }

  if (Array.isArray(node)) {
    return node.map((child) =>
      renderRangeHighlightedNode(child, rangeHighlights, cursor),
    );
  }

  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return node;
  }

  const childElement = node as ReactElement<{ children?: ReactNode }>;

  if (childElement.props.children === undefined) {
    return childElement;
  }

  if (isCodeElement(childElement)) {
    advanceRangeCursorByNodeText(childElement.props.children, cursor);

    return childElement;
  }

  return cloneElement(
    childElement,
    undefined,
    renderRangeHighlightedNode(
      childElement.props.children,
      rangeHighlights,
      cursor,
    ),
  );
}

/** @returns True when a Markdown descendant should keep its code styling intact. */
function isCodeElement(
  element: ReactElement<{ children?: ReactNode }>,
): boolean {
  return element.type === "code" || element.type === "pre";
}

/** Advances the range cursor over unhighlighted descendants. */
function advanceRangeCursorByNodeText(
  node: ReactNode,
  cursor: RangeRenderCursor,
): void {
  if (typeof node === "string" || typeof node === "number") {
    cursor.position += String(node).length;

    return;
  }

  if (Array.isArray(node)) {
    node.forEach((child) => {
      advanceRangeCursorByNodeText(child, cursor);
    });

    return;
  }

  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return;
  }

  advanceRangeCursorByNodeText(node.props.children, cursor);
}

/** @returns Text split into plain and highlighted range segments. */
function renderRangeHighlightedText(
  text: string,
  rangeHighlights: readonly CommentRangeHighlight[],
  cursor: RangeRenderCursor,
): ReactNode {
  const absoluteStart = cursor.position;
  const absoluteEnd = absoluteStart + text.length;
  const parts: ReactNode[] = [];
  let localOffset = 0;

  for (const highlight of rangeHighlights) {
    if (highlight.end <= absoluteStart) {
      continue;
    }

    if (highlight.start >= absoluteEnd) {
      break;
    }

    const rangeStart = Math.max(highlight.start - absoluteStart, localOffset);
    const rangeEnd = Math.min(highlight.end - absoluteStart, text.length);

    if (rangeEnd <= rangeStart) {
      continue;
    }

    if (rangeStart > localOffset) {
      parts.push(text.slice(localOffset, rangeStart));
    }

    parts.push(
      <CommentRangeHighlightSpan
        key={`comment-range-${cursor.keyIndex}`}
        highlight={highlight}
      >
        {text.slice(rangeStart, rangeEnd)}
      </CommentRangeHighlightSpan>,
    );
    cursor.keyIndex += 1;
    localOffset = rangeEnd;
  }

  if (localOffset < text.length) {
    parts.push(text.slice(localOffset));
  }

  cursor.position = absoluteEnd;

  if (parts.length === 0) {
    return text;
  }

  return parts;
}

/** @returns One React node with document search mark elements inserted. */
function renderDocumentSearchHighlightedNode(
  node: ReactNode,
  cursor: DocumentSearchCursor,
): ReactNode {
  if (typeof node === "string" || typeof node === "number") {
    return renderDocumentSearchHighlightedText(String(node), cursor);
  }

  if (Array.isArray(node)) {
    return node.map((child) =>
      renderDocumentSearchHighlightedNode(child, cursor),
    );
  }

  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return node;
  }

  const childElement = node as ReactElement<{ children?: ReactNode }>;

  if (childElement.props.children === undefined) {
    return childElement;
  }

  return cloneElement(
    childElement,
    undefined,
    renderDocumentSearchHighlightedNode(childElement.props.children, cursor),
  );
}

/** @returns Text split into plain and document search match segments. */
function renderDocumentSearchHighlightedText(
  text: string,
  cursor: DocumentSearchCursor,
): ReactNode {
  const parts: ReactNode[] = [];
  const lowerText = text.toLocaleLowerCase();
  let localOffset = 0;
  let matchStart = lowerText.indexOf(cursor.query);

  while (matchStart >= 0) {
    const matchEnd = matchStart + cursor.query.length;

    if (matchStart > localOffset) {
      parts.push(text.slice(localOffset, matchStart));
    }

    const isActive = cursor.matchIndex === cursor.activeIndex;
    parts.push(
      <mark
        className="markdown-document-search__match"
        key={`document-search-${cursor.matchIndex}`}
        data-document-search-match="true"
        data-document-search-match-active={isActive ? "true" : undefined}
      >
        {text.slice(matchStart, matchEnd)}
      </mark>,
    );
    cursor.matchIndex += 1;
    localOffset = matchEnd;
    matchStart = lowerText.indexOf(cursor.query, localOffset);
  }

  if (localOffset < text.length) {
    parts.push(text.slice(localOffset));
  }

  if (parts.length === 0) {
    return text;
  }

  return parts;
}

type CommentRangeHighlightSpanProps = Readonly<{
  highlight: CommentRangeHighlight;
  children: ReactNode;
}>;

/** @returns An inline exact-range comment highlight with its own activation target. */
function CommentRangeHighlightSpan({
  highlight,
  children,
}: CommentRangeHighlightSpanProps) {
  return (
    <span
      data-comment-highlight-range="true"
      data-comment-highlight-count={highlight.commentIds.length}
      data-comment-highlight-state={highlight.state}
      data-comment-ids={highlight.commentIds.join(" ")}
      aria-label={createHighlightAriaLabel(highlight)}
    >
      {children}
    </span>
  );
}

type TextSelectionCommentButtonProps = Readonly<{
  draft: CommentAnchorDraft | null;
  /**
   * Creates a comment draft from the current text selection.
   * @param draft - The anchor draft derived from the selection.
   */
  onCreateDraft: (draft: CommentAnchorDraft) => void;
}>;

/** @returns A floating command for turning the current text selection into a draft. */
function TextSelectionCommentButton({
  draft,
  onCreateDraft,
}: TextSelectionCommentButtonProps) {
  if (draft === null) {
    return null;
  }

  const style = createFloatingStyle(draft, "button");

  return (
    <button
      className="text-selection-comment-button"
      type="button"
      style={style}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={() => {
        onCreateDraft(draft);
      }}
    >
      <MessageSquarePlus aria-hidden="true" size={16} />
      <span>コメント追加</span>
    </button>
  );
}

type CommentAnchorDraftPopoverProps = Readonly<{
  draft: CommentAnchorDraft | null;
  isSaving: boolean;
  errorMessage: string | null;
  isScopeReady: boolean;
  /**
   * Submits the pending comment anchor draft.
   * @param input - The comment submission payload.
   */
  onSubmit: (input: AddCommentSubmitInput) => Promise<boolean>;
  /** Cancels the pending comment anchor draft. */
  onCancel: () => void;
}>;

/** @returns The pending comment anchor form, or null when no draft exists. */
function CommentAnchorDraftPopover({
  draft,
  isSaving,
  errorMessage,
  isScopeReady,
  onSubmit,
  onCancel,
}: CommentAnchorDraftPopoverProps) {
  if (draft === null) {
    return null;
  }

  const style = createFloatingStyle(draft, "popover");
  const draftKey = createCommentAnchorDraftKey(draft);

  return (
    <AddCommentPopover
      key={draftKey}
      draft={draft}
      style={style}
      isSaving={isSaving}
      errorMessage={errorMessage}
      isScopeReady={isScopeReady}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}

/**
 * @param draft - The comment anchor draft to derive the key from.
 * @returns Stable identity for remounting the add-comment form when target changes.
 */
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

/**
 * @param comment - The comment to evaluate for viewer visibility.
 * @returns Whether the comment should be rendered in the left Markdown viewer.
 */
function isVisibleInMarkdownViewer(comment: Comment): boolean {
  return comment.status !== "resolved";
}

/** @returns The latest editable draft for a still-visible comment. */
function createVisibleCommentEditDraft(
  draft: CommentEditDraft | null,
  comments: readonly Comment[],
): CommentEditDraft | null {
  if (draft === null) {
    return null;
  }

  const currentComment = comments.find(
    (comment) => comment.id === draft.comment.id,
  );

  if (currentComment === undefined) {
    return null;
  }

  return {
    ...draft,
    comment: currentComment,
  };
}

type CommentEditPopoverProps = Readonly<{
  draft: CommentEditDraft | null;
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
function CommentEditPopover({
  draft,
  isSaving,
  operationState,
  onSubmit,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
  onCancel,
}: CommentEditPopoverProps) {
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

  const submitStatusChange = async (): Promise<void> => {
    setValidationMessage(null);
    const wasChanged =
      draft.comment.status === "resolved"
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

  const statusActionLabel =
    draft.comment.status === "resolved"
      ? uiText.commentThread.reopen
      : uiText.commentThread.resolve;

  return (
    <aside
      ref={popoverRef}
      className="add-comment-popover add-comment-popover--edit"
      style={createFloatingPopoverStyle(draft.selectionBounds)}
      role="dialog"
      aria-labelledby={titleId}
      onKeyDown={handleDialogKeyDown}
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
              void submitStatusChange();
            }}
          >
            {draft.comment.status === "resolved" ? (
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
    </aside>
  );
}

type FloatingKind = "button" | "popover";
const FLOATING_VIEWPORT_MARGIN = 8;
const COMMENT_POPOVER_ESTIMATED_HEIGHT = 360;
const COMMENT_POPOVER_ESTIMATED_WIDTH = 382;

/** @returns Fixed-position style for selection-adjacent UI. */
function createFloatingStyle(
  draft: CommentAnchorDraft,
  kind: FloatingKind,
): CSSProperties {
  const bounds = draft.selectionBounds;

  if (kind === "button") {
    const usesCommentLane = bounds.commentLaneLeft !== undefined;

    return {
      top: Math.max(FLOATING_VIEWPORT_MARGIN, bounds.top - 44),
      left: Math.max(
        FLOATING_VIEWPORT_MARGIN,
        bounds.commentLaneLeft ?? bounds.left + bounds.width / 2,
      ),
      transform: usesCommentLane ? "none" : undefined,
    };
  }

  if (bounds.commentLaneLeft !== undefined) {
    return createFloatingPopoverStyle({
      ...bounds,
      left: bounds.commentLaneLeft,
      width: 0,
    });
  }

  return createFloatingPopoverStyle(bounds);
}

/** @returns Fixed-position style for a floating comment dialog. */
function createFloatingPopoverStyle(
  bounds: CommentSelectionBounds,
): CSSProperties {
  return {
    top: createPopoverTop(bounds),
    left: createPopoverLeft(bounds),
  };
}

/**
 * @param bounds - The selection bounds the dialog anchors to.
 * @returns Viewport-clamped top offset for the comment dialog.
 */
function createPopoverTop(bounds: CommentSelectionBounds): number {
  const preferredBelow = bounds.top + bounds.height + 10;
  const availableBelow =
    window.innerHeight - preferredBelow - FLOATING_VIEWPORT_MARGIN;

  if (availableBelow >= COMMENT_POPOVER_ESTIMATED_HEIGHT) {
    return Math.max(FLOATING_VIEWPORT_MARGIN, preferredBelow);
  }

  const preferredAbove = bounds.top - COMMENT_POPOVER_ESTIMATED_HEIGHT - 10;

  return Math.max(FLOATING_VIEWPORT_MARGIN, preferredAbove);
}

/**
 * @param bounds - The selection bounds the dialog anchors to.
 * @returns Viewport-clamped left offset for the comment dialog.
 */
function createPopoverLeft(bounds: CommentSelectionBounds): number {
  const maxLeft =
    window.innerWidth -
    COMMENT_POPOVER_ESTIMATED_WIDTH -
    FLOATING_VIEWPORT_MARGIN;

  return Math.max(
    FLOATING_VIEWPORT_MARGIN,
    Math.min(bounds.left, Math.max(FLOATING_VIEWPORT_MARGIN, maxLeft)),
  );
}

/** @returns Viewport bounds for anchoring an edit dialog to a clicked control. */
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

/** Clears the browser selection once a draft has been handled. */
function clearBrowserSelection(): void {
  document.getSelection()?.removeAllRanges();
}

/**
 * @param value - The string to measure.
 * @returns The UTF-8 byte length matching persisted Markdown file size semantics.
 */
function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

type LinkProps = ComponentPropsWithoutRef<"a">;

/**
 * @param props - Anchor element props, including the optional href.
 * @returns A Markdown link with safe external navigation defaults.
 */
function SafeMarkdownLink({ href, ...props }: LinkProps) {
  const isExternalLink =
    typeof href === "string" &&
    (href.startsWith("http://") || href.startsWith("https://"));

  if (!isExternalLink) {
    return <a href={href} {...props} />;
  }

  return <a href={href} rel="noreferrer" target="_blank" {...props} />;
}

type ListItemProps = Omit<ComponentPropsWithoutRef<"li">, keyof BlockMetadata> &
  Readonly<{
    checked?: boolean | null;
    node?: unknown;
    commentAnnotations: readonly CommentBlockAnnotation[];
    onCreateBlockDraft?: CreateBlockCommentDraft;
    onSelectComment?: (commentId: CommentId) => void;
    onRequestCommentEdit?: RequestCommentEdit;
  }> &
  BlockMetadata;

/** @returns A rendered Markdown list item without parser-only props. */
function MarkdownListItem({
  checked: _checked,
  node: _node,
  commentAnnotations,
  onCreateBlockDraft,
  onSelectComment,
  onRequestCommentEdit,
  children,
  ...props
}: ListItemProps) {
  const createDraftFromListItem = (
    event: MouseEvent<HTMLButtonElement>,
  ): void => {
    const block = event.currentTarget.closest<HTMLElement>(
      "[data-block-type][data-block-index]",
    );

    if (block === null) {
      return;
    }

    onCreateBlockDraft?.(block);
  };

  return (
    <li {...props}>
      {children}
      {onCreateBlockDraft !== undefined ? (
        <button
          className="markdown-block-comment-button markdown-block-comment-button--inline"
          type="button"
          aria-label="コメント追加"
          title="コメント追加"
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={createDraftFromListItem}
        >
          <MessageSquarePlus aria-hidden="true" size={14} />
        </button>
      ) : null}
      <CommentAnnotationStack
        annotations={commentAnnotations}
        onSelectComment={onSelectComment}
        onRequestCommentEdit={onRequestCommentEdit}
      />
    </li>
  );
}

type InputProps = ComponentPropsWithoutRef<"input">;

/**
 * @param props - Input element props, including the optional type.
 * @returns A read-only input for rendered Markdown task list items.
 */
function ReadOnlyMarkdownInput({ type, ...props }: InputProps) {
  if (type !== "checkbox") {
    return <input type={type} {...props} />;
  }

  return <input type={type} {...props} disabled={true} readOnly={true} />;
}
