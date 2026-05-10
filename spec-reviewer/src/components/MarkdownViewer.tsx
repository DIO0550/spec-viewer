import {
  type ComponentPropsWithoutRef,
  type AriaRole,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type KeyboardEventHandler,
  type MouseEvent,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
  type RefObject,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  RefreshCcw,
  Send,
  X,
} from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { useMarkdownTextSelection } from "../hooks/useMarkdownTextSelection";
import type { SpecDocumentState } from "../hooks/useSpecs";
import {
  createCommentAnchorDraftFromBlock,
  createTextHash,
} from "../lib/comment-anchor-draft";
import { uiText } from "../lib/uiText";
import type {
  Comment,
  CommentAnchor,
  CommentAnchorDisplayState,
  CommentAnchorDisplayStatus,
  CommentAnchorDraft,
  CommentBlockType,
  CommentId,
  CommentSelectionBounds,
} from "../types/comment";
import type { MarkdownBlockMetadata, MarkdownBlockType } from "../types/spec";
import {
  AddCommentPopover,
  type AddCommentSubmitInput,
} from "./AddCommentPopover";
import { CommandErrorDisplay } from "./CommandErrorDisplay";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";

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

type Props = Readonly<{
  state: SpecDocumentState;
  selectedSpecLabel: string | null;
  selectedFileLabel: string | null;
  comments?: readonly Comment[];
  activeCommentId?: CommentId | null;
  isAddingComment?: boolean;
  addCommentErrorMessage?: string | null;
  isUpdatingComment?: boolean;
  updateCommentErrorMessage?: string | null;
  isCommentScopeReady?: boolean;
  onReload: () => void;
  onAddComment?: (input: AddCommentSubmitInput) => Promise<boolean>;
  onUpdateComment?: (commentId: CommentId, body: string) => Promise<boolean>;
  onSelectComment?: (commentId: CommentId) => void;
  onAnchorDisplayStatesChange?: (
    states: readonly CommentAnchorDisplayState[],
  ) => void;
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
  updateCommentErrorMessage = null,
  isCommentScopeReady = true,
  onReload,
  onAddComment,
  onUpdateComment,
  onSelectComment,
  onAnchorDisplayStatesChange,
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
  const resetKey = createViewerResetKey(state);
  const isHtmlDocument =
    state.status === "ready" && state.document.format === "html";
  const selectionFileKey =
    state.status === "ready" && !isHtmlDocument ? state.fileKey : null;
  const readyContents =
    state.status === "ready" ? state.document.contents : null;
  const { selectionDraft, clearSelectionDraft } = useMarkdownTextSelection({
    renderedRootRef,
    fileKey: selectionFileKey,
  });
  useViewerReset(panelRef, resetKey, state.status !== "idle");
  useEffect(() => {
    setActiveAnchorDraft(null);
    setActiveEditDraft(null);
  }, [resetKey]);
  useEffect(() => {
    if (state.status !== "ready" || readyContents === null || isHtmlDocument) {
      setAnchorDisplayStates([]);
      onAnchorDisplayStatesChange?.([]);
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
      comments,
      renderedRoot: renderedRootRef.current,
    });
  }, [activeCommentId, anchorDisplayStates, comments]);

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

  if (state.status === "idle") {
    return (
      <section
        ref={panelRef}
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
        tabIndex={-1}
      >
        <EmptyState
          title={
            selectedSpecLabel === null
              ? uiText.markdown.chooseSpec
              : uiText.markdown.chooseFile
          }
          description={uiText.markdown.idleDescription}
        />
      </section>
    );
  }

  if (state.status === "loading") {
    return (
      <section
        ref={panelRef}
        id="markdown-viewer-panel"
        className="markdown-viewer"
        role="tabpanel"
        aria-live="polite"
        tabIndex={-1}
      >
        <LoadingSkeleton
          className="markdown-loading-skeleton"
          label={uiText.markdown.loading}
          rows={[
            { width: "short" },
            { width: "long" },
            { width: "medium" },
            { width: "full" },
            { width: "full" },
            { width: "medium" },
            { width: "long" },
          ]}
        />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section
        ref={panelRef}
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
        tabIndex={-1}
      >
        <CommandErrorDisplay
          title={uiText.markdown.loadError}
          error={state.error}
          actionLabel={uiText.sidebar.retry}
          onAction={onReload}
        />
      </section>
    );
  }

  if (state.status === "missing") {
    return (
      <section
        ref={panelRef}
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
        tabIndex={-1}
      >
        <EmptyState
          title={uiText.markdown.missingTitle}
          description={`${state.document.path} ${uiText.markdown.missingDescription}`}
        />
      </section>
    );
  }

  const contents = state.document.contents;

  if (contents === null || contents.trim().length === 0) {
    return (
      <section
        ref={panelRef}
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
        tabIndex={-1}
      >
        <EmptyState
          title={uiText.markdown.emptyTitle}
          description={state.document.path}
        />
      </section>
    );
  }

  return (
    <article
      ref={panelRef}
      id="markdown-viewer-panel"
      className="markdown-viewer"
      data-comment-dialog-open={
        activeAnchorDraft !== null || activeEditDraft !== null
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
        <button
          className="icon-button"
          type="button"
          aria-label={uiText.markdown.reload}
          title={uiText.markdown.reload}
          onClick={onReload}
        >
          <RefreshCcw aria-hidden="true" size={16} />
        </button>
      </header>
      {state.document.format === "html" ? (
        <HtmlDocument contents={contents} />
      ) : (
        <>
          <MarkdownDocument
            contents={contents}
            blocks={state.document.blocks}
            renderedRootRef={renderedRootRef}
            comments={comments}
            activeCommentId={activeCommentId}
            anchorDisplayStates={anchorDisplayStates}
            onSelectComment={onSelectComment}
            onRequestCommentEdit={requestCommentEdit}
            onCreateBlockDraft={createBlockDraft}
          />
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
            draft={activeEditDraft}
            isSaving={isUpdatingComment}
            errorMessage={updateCommentErrorMessage}
            onSubmit={updateComment}
            onCancel={closeEditDraft}
          />
        </>
      )}
    </article>
  );
}

/** Resets the viewer scroll position and focus whenever loaded content changes. */
function useViewerReset(
  panelRef: RefObject<HTMLElement | null>,
  resetKey: string,
  shouldFocus: boolean,
): void {
  const previousResetKeyRef = useRef(resetKey);

  useEffect(() => {
    if (previousResetKeyRef.current === resetKey) {
      return;
    }

    previousResetKeyRef.current = resetKey;
    const panel = panelRef.current;

    if (panel === null) {
      return;
    }

    panel.parentElement?.scrollTo({ top: 0, left: 0, behavior: "auto" });

    if (shouldFocus) {
      panel.focus({ preventScroll: true });
    }
  }, [panelRef, resetKey, shouldFocus]);
}

/** @returns A stable key for viewer content state transitions. */
function createViewerResetKey(state: SpecDocumentState): string {
  const path = state.document?.path ?? "";

  return [
    state.status,
    state.workspacePath ?? "",
    state.specId ?? "",
    state.fileKey ?? "",
    path,
  ].join(":");
}

type MarkdownDocumentProps = Readonly<{
  contents: string;
  blocks: readonly MarkdownBlockMetadata[];
  renderedRootRef: RefObject<HTMLDivElement | null>;
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  anchorDisplayStates: readonly CommentAnchorDisplayState[];
  onSelectComment?: (commentId: CommentId) => void;
  onRequestCommentEdit?: RequestCommentEdit;
  onCreateBlockDraft: CreateBlockCommentDraft;
}>;

/** @returns Rendered Markdown with stable block metadata for comments. */
function MarkdownDocument({
  contents,
  blocks,
  renderedRootRef,
  comments,
  activeCommentId,
  anchorDisplayStates,
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
    onSelectComment,
  });
  const components = createMarkdownComponents({
    blockIndexer,
    onCreateBlockDraft,
    onSelectComment,
    onRequestCommentEdit,
  });

  return (
    <div
      ref={renderedRootRef}
      className="markdown-rendered"
      aria-label={uiText.markdown.renderedDocument}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {contents}
      </ReactMarkdown>
    </div>
  );
}

type HtmlDocumentProps = Readonly<{
  contents: string;
}>;

/** @returns Sandboxed HTML preview for non-Markdown spec files. */
function HtmlDocument({ contents }: HtmlDocumentProps) {
  return (
    <iframe
      className="html-rendered"
      title={uiText.markdown.renderedHtmlDocument}
      sandbox=""
      srcDoc={contents}
    />
  );
}

/** @returns A sequential block indexer scoped to one Markdown render. */
function createBlockIndexer({
  blocks,
  highlights,
  onSelectComment,
}: Readonly<{
  blocks: readonly MarkdownBlockMetadata[];
  highlights: CommentBlockHighlights;
  onSelectComment?: (commentId: CommentId) => void;
}>): BlockIndexer {
  let fallbackBlockIndex = 0;
  let backendBlockCursor = 0;

  return {
    next: (blockType: BlockType): IndexedBlock => {
      const backendBlock = findNextBackendBlock({
        blocks,
        blockType,
        startIndex: backendBlockCursor,
      });
      const currentBlockIndex = backendBlock?.blockIndex ?? fallbackBlockIndex;
      const metadata: BlockMetadata = {
        "data-block-type": blockType,
        "data-block-index": currentBlockIndex,
      };
      const highlight = highlights.get(
        createBlockKey(blockType, currentBlockIndex),
      );

      fallbackBlockIndex += 1;

      if (backendBlock !== null) {
        backendBlockCursor = blocks.indexOf(backendBlock) + 1;
      }

      return {
        metadata: createHighlightedBlockMetadata({
          metadata: attachBackendBlockMetadata(metadata, backendBlock),
          highlight,
          onSelectComment,
        }),
        rangeHighlights: highlight?.rangeHighlights ?? [],
        commentAnnotations: highlight?.annotations ?? [],
      };
    },
  };
}

/** @returns The next backend block that can describe this rendered block. */
function findNextBackendBlock({
  blocks,
  blockType,
  startIndex,
}: Readonly<{
  blocks: readonly MarkdownBlockMetadata[];
  blockType: BlockType;
  startIndex: number;
}>): MarkdownBlockMetadata | null {
  for (let index = startIndex; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (mapMarkdownBlockTypeToBlockType(block.blockType) === blockType) {
      return block;
    }
  }

  return null;
}

/** @returns Rendered block attributes enriched with backend anchor metadata. */
function attachBackendBlockMetadata(
  metadata: BlockMetadata,
  block: MarkdownBlockMetadata | null,
): BlockMetadata {
  if (block === null) {
    return metadata;
  }

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
    return comments.map((comment) => ({
      commentId: comment.id,
      status: "orphaned",
    }));
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

/** @returns The backend text hash for a rendered block, or a legacy fallback hash. */
function readRenderedBlockTextHash(block: HTMLElement): string {
  const textHash = block.dataset.textHash;

  if (textHash !== undefined && textHash.trim().length > 0) {
    return textHash;
  }

  return createTextHash(block.textContent ?? "");
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

/** @returns The rendered block key that should receive a comment highlight. */
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

  const openComment = comments.find((comment) => !comment.resolved);

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

  const hasOpenComment = comments.some((comment) => !comment.resolved);

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

  return comment.anchor.charRange.end > comment.anchor.charRange.start;
}

/** @returns The subdued or prominent state for an exact range highlight. */
function selectExactRangeState(comment: Comment): CommentHighlightState {
  return comment.resolved ? "resolved" : "open";
}

/** @returns Block metadata with highlight attributes and selection handlers. */
function createHighlightedBlockMetadata({
  metadata,
  highlight,
  onSelectComment,
}: Readonly<{
  metadata: BlockMetadata;
  highlight: CommentBlockHighlight | undefined;
  onSelectComment?: (commentId: CommentId) => void;
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

  if (onSelectComment === undefined) {
    return highlightedMetadata;
  }

  return {
    ...highlightedMetadata,
    role: "button",
    tabIndex: 0,
    onClick: (event) => {
      if (
        !(event.currentTarget instanceof HTMLElement) ||
        isInteractiveHighlightTarget(event.target, event.currentTarget) ||
        hasActiveTextSelectionInside(event.currentTarget)
      ) {
        return;
      }

      onSelectComment(highlight.selectCommentId);
    },
    onKeyDown: (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      onSelectComment(highlight.selectCommentId);
    },
  };
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

/** @returns true when a click originated from an interactive child element. */
function isInteractiveHighlightTarget(
  target: EventTarget,
  currentTarget: HTMLElement,
): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  const interactiveElement = target.closest(
    'a, button, input, textarea, select, summary, [contenteditable="true"]',
  );

  return interactiveElement !== null && interactiveElement !== currentTarget;
}

/** @returns true when a click follows text selection inside the highlighted block. */
function hasActiveTextSelectionInside(element: HTMLElement): boolean {
  const selection = document.getSelection();

  if (
    selection === null ||
    selection.rangeCount === 0 ||
    selection.isCollapsed
  ) {
    return false;
  }

  const range = selection.getRangeAt(0);

  return (
    containsSelectionNode(element, range.startContainer) &&
    containsSelectionNode(element, range.endContainer)
  );
}

/** @returns true when a selection endpoint belongs to the target element. */
function containsSelectionNode(element: HTMLElement, node: Node): boolean {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return element.contains(node);
  }

  return node.parentElement !== null && element.contains(node.parentElement);
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
    list_item: "list-item",
    table: "table",
    code_block: "code",
  };

  return blockTypeMap[blockType] ?? null;
}

/** @returns A stable key for one rendered Markdown block. */
function createBlockKey(blockType: BlockType, blockIndex: number): string {
  return `${blockType}:${blockIndex}`;
}

/** @returns React Markdown component overrides with comment anchor metadata. */
function createMarkdownComponents({
  blockIndexer,
  onCreateBlockDraft,
  onSelectComment,
  onRequestCommentEdit,
}: Readonly<{
  blockIndexer: BlockIndexer;
  onCreateBlockDraft: CreateBlockCommentDraft;
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
            {renderRangeHighlightedChildren(children, block.rangeHighlights)}
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
            {renderRangeHighlightedChildren(children, block.rangeHighlights)}
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
            {renderRangeHighlightedChildren(children, block.rangeHighlights)}
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
            {renderRangeHighlightedChildren(children, block.rangeHighlights)}
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
            {renderRangeHighlightedChildren(children, block.rangeHighlights)}
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
            {renderRangeHighlightedChildren(children, block.rangeHighlights)}
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
            {renderRangeHighlightedChildren(children, block.rangeHighlights)}
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
          {renderRangeHighlightedChildren(children, block.rangeHighlights)}
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
            {renderRangeHighlightedChildren(children, block.rangeHighlights)}
          </pre>
        </MarkdownCommentableBlock>
      );
    },
    table: ({ node: _node, ...props }) => {
      const block = blockIndexer.next("table");

      return (
        <MarkdownCommentableBlock
          commentAnnotations={block.commentAnnotations}
          onCreateBlockDraft={onCreateBlockDraft}
          onSelectComment={onSelectComment}
          onRequestCommentEdit={onRequestCommentEdit}
        >
          <div className="markdown-rendered__table-scroll" {...block.metadata}>
            <table {...props} />
          </div>
        </MarkdownCommentableBlock>
      );
    },
    a: ({ node: _node, ...props }) => <SafeMarkdownLink {...props} />,
    input: ({ node: _node, ...props }) => <ReadOnlyMarkdownInput {...props} />,
  };
}

type MarkdownCommentableBlockProps = Readonly<{
  children: ReactElement;
  commentAnnotations: readonly CommentBlockAnnotation[];
  onCreateBlockDraft: CreateBlockCommentDraft;
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

    onCreateBlockDraft(block);
  };

  return (
    <div
      className="markdown-comment-target"
      data-has-comment-annotations={
        commentAnnotations.length > 0 ? "true" : undefined
      }
    >
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
      {children}
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
      data-resolved={comment.resolved ? "true" : "false"}
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
          ) : comment.resolved ? (
            <CheckCircle2 aria-hidden="true" size={14} />
          ) : (
            <MessageSquare aria-hidden="true" size={14} />
          )}
        </button>
        <span className="markdown-comment-annotation__status">
          {comment.resolved ? (
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

  return comment.resolved ? uiText.sidebar.resolved : uiText.sidebar.openFilter;
}

const COMMENT_PREVIEW_MAX_LENGTH = 84;

/** @returns A compact single-line preview for a comment body. */
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
  onSubmit: (input: AddCommentSubmitInput) => Promise<boolean>;
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

  return (
    <AddCommentPopover
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

type CommentEditPopoverProps = Readonly<{
  draft: CommentEditDraft | null;
  isSaving: boolean;
  errorMessage: string | null;
  onSubmit: (commentId: CommentId, body: string) => Promise<boolean>;
  onCancel: () => void;
}>;

const emptyEditBodyMessage = uiText.commentThread.emptyBody;
const failedUpdateMessage =
  "コメントを更新できませんでした。再試行してください。";

/** @returns Human-readable block type text for the edit anchor preview. */
function formatEditBlockType(blockType: string): string {
  return blockType.replace(/_/g, " ");
}

/** @returns A floating form for editing an existing Markdown comment. */
function CommentEditPopover({
  draft,
  isSaving,
  errorMessage,
  onSubmit,
  onCancel,
}: CommentEditPopoverProps) {
  const titleId = useId();
  const textareaId = useId();
  const hintId = useId();
  const errorId = useId();
  const popoverRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState(draft?.comment.body ?? "");
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const trimmedBody = body.trim();
  const isSubmitDisabled = isSaving || trimmedBody.length === 0;
  const visibleErrorMessage = validationMessage ?? errorMessage;
  const describedBy =
    visibleErrorMessage === null ? hintId : `${hintId} ${errorId}`;

  useEffect(() => {
    setBody(draft?.comment.body ?? "");
    setValidationMessage(null);
    textareaRef.current?.focus();
  }, [draft]);

  useEffect(() => {
    const closeWhenClickingOutside = (event: globalThis.MouseEvent): void => {
      if (draft === null) {
        return;
      }

      if (isSaving) {
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
  }, [draft, isSaving, onCancel]);

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

  const submitForm = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void submitComment();
  };

  const handleTextareaKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ): void => {
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
    if (event.defaultPrevented || event.key !== "Escape" || isSaving) {
      return;
    }

    event.preventDefault();
    onCancel();
  };

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
          disabled={isSaving}
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
            disabled={isSaving}
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
        </div>
        <div className="add-comment-popover__actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onCancel}
            disabled={isSaving}
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

/** @returns Viewport-clamped top offset for the comment dialog. */
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

/** @returns Viewport-clamped left offset for the comment dialog. */
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

type LinkProps = ComponentPropsWithoutRef<"a">;

/** @returns A Markdown link with safe external navigation defaults. */
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
    onCreateBlockDraft: CreateBlockCommentDraft;
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

    onCreateBlockDraft(block);
  };

  return (
    <li {...props}>
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
      {children}
      <CommentAnnotationStack
        annotations={commentAnnotations}
        onSelectComment={onSelectComment}
        onRequestCommentEdit={onRequestCommentEdit}
      />
    </li>
  );
}

type InputProps = ComponentPropsWithoutRef<"input">;

/** @returns A read-only input for rendered Markdown task list items. */
function ReadOnlyMarkdownInput({ type, ...props }: InputProps) {
  if (type !== "checkbox") {
    return <input type={type} {...props} />;
  }

  return <input type={type} {...props} disabled={true} readOnly={true} />;
}
