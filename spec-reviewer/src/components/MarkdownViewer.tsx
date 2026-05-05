import {
  type ComponentPropsWithoutRef,
  type AriaRole,
  type CSSProperties,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { MessageSquarePlus, RefreshCcw } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { useMarkdownTextSelection } from "../hooks/useMarkdownTextSelection";
import type { SpecDocumentState } from "../hooks/useSpecs";
import { createTextHash } from "../lib/comment-anchor-draft";
import type {
  Comment,
  CommentAnchor,
  CommentAnchorDisplayState,
  CommentAnchorDisplayStatus,
  CommentAnchorDraft,
  CommentBlockType,
  CommentId,
} from "../types/comment";
import {
  AddCommentPopover,
  type AddCommentSubmitInput,
} from "./AddCommentPopover";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

type BlockType = "heading" | "paragraph" | "list-item" | "table" | "code";

type BlockMetadata = Readonly<{
  "data-block-type": BlockType;
  "data-block-index": number;
  "data-comment-highlight"?: "true";
  "data-comment-highlight-count"?: number;
  "data-comment-highlight-state"?: CommentHighlightState;
  "data-comment-ids"?: string;
  "aria-label"?: string;
  role?: AriaRole;
  tabIndex?: number;
  onClick?: MouseEventHandler<Element>;
  onKeyDown?: KeyboardEventHandler<Element>;
}>;

type BlockIndexer = Readonly<{
  next: (blockType: BlockType) => BlockMetadata;
}>;

type CommentHighlightState = "open" | "resolved" | "active" | "stale";

type CommentBlockHighlight = Readonly<{
  commentIds: readonly CommentId[];
  selectCommentId: CommentId;
  state: CommentHighlightState;
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
  isCommentScopeReady?: boolean;
  onReload: () => void;
  onAddComment?: (input: AddCommentSubmitInput) => Promise<boolean>;
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
  isCommentScopeReady = true,
  onReload,
  onAddComment,
  onSelectComment,
  onAnchorDisplayStatesChange,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const renderedRootRef = useRef<HTMLDivElement>(null);
  const [activeAnchorDraft, setActiveAnchorDraft] =
    useState<CommentAnchorDraft | null>(null);
  const [anchorDisplayStates, setAnchorDisplayStates] = useState<
    readonly CommentAnchorDisplayState[]
  >([]);
  const resetKey = createViewerResetKey(state);
  const selectionFileKey = state.status === "ready" ? state.fileKey : null;
  const readyContents =
    state.status === "ready" ? state.document.contents : null;
  const { selectionDraft, clearSelectionDraft } = useMarkdownTextSelection({
    renderedRootRef,
    fileKey: selectionFileKey,
  });
  useViewerReset(panelRef, resetKey, state.status !== "idle");
  useEffect(() => {
    setActiveAnchorDraft(null);
  }, [resetKey]);
  useEffect(() => {
    if (state.status !== "ready" || readyContents === null) {
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
  }, [comments, onAnchorDisplayStatesChange, readyContents, state.status]);
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
          title={selectedSpecLabel === null ? "Choose a spec" : "Choose a file"}
          description="Open a workspace and choose a Markdown file to start reading."
        />
      </section>
    );
  }

  if (state.status === "loading") {
    return (
      <section
        ref={panelRef}
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
        aria-live="polite"
        tabIndex={-1}
      >
        <div className="viewer-loading" role="status">
          <span className="viewer-loading__indicator" aria-hidden="true" />
          <span>Loading Markdown...</span>
        </div>
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
        <ErrorState
          title="Could not load Markdown"
          message={state.error.message}
          actionLabel="Retry"
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
          title="File missing"
          description={`${state.document.path} is not available in this workspace.`}
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
        <EmptyState title="File is empty" description={state.document.path} />
      </section>
    );
  }

  return (
    <article
      ref={panelRef}
      id="markdown-viewer-panel"
      className="markdown-viewer"
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
          aria-label="Reload Markdown"
          title="Reload Markdown"
          onClick={onReload}
        >
          <RefreshCcw aria-hidden="true" size={16} />
        </button>
      </header>
      <MarkdownDocument
        contents={contents}
        renderedRootRef={renderedRootRef}
        comments={comments}
        activeCommentId={activeCommentId}
        anchorDisplayStates={anchorDisplayStates}
        onSelectComment={onSelectComment}
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
  renderedRootRef: RefObject<HTMLDivElement | null>;
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  anchorDisplayStates: readonly CommentAnchorDisplayState[];
  onSelectComment?: (commentId: CommentId) => void;
}>;

/** @returns Rendered Markdown with stable block metadata for comments. */
function MarkdownDocument({
  contents,
  renderedRootRef,
  comments,
  activeCommentId,
  anchorDisplayStates,
  onSelectComment,
}: MarkdownDocumentProps) {
  const anchorDisplayStateByCommentId =
    createAnchorDisplayStateByCommentId(anchorDisplayStates);
  const highlights = createCommentBlockHighlights({
    comments,
    activeCommentId,
    anchorDisplayStateByCommentId,
  });
  const blockIndexer = createBlockIndexer({
    highlights,
    onSelectComment,
  });
  const components = createMarkdownComponents(blockIndexer);

  return (
    <div
      ref={renderedRootRef}
      className="markdown-rendered"
      aria-label="Rendered Markdown document"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {contents}
      </ReactMarkdown>
    </div>
  );
}

/** @returns A sequential block indexer scoped to one Markdown render. */
function createBlockIndexer({
  highlights,
  onSelectComment,
}: Readonly<{
  highlights: CommentBlockHighlights;
  onSelectComment?: (commentId: CommentId) => void;
}>): BlockIndexer {
  let blockIndex = 0;

  return {
    next: (blockType: BlockType): BlockMetadata => {
      const currentBlockIndex = blockIndex;
      const metadata = {
        "data-block-type": blockType,
        "data-block-index": currentBlockIndex,
      };
      const highlight = highlights.get(
        createBlockKey(blockType, currentBlockIndex),
      );

      blockIndex += 1;
      return createHighlightedBlockMetadata({
        metadata,
        highlight,
        onSelectComment,
      });
    },
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
      status: "missing",
    }));
  }

  return comments.map((comment) => {
    const block = findCommentAnchorBlock(comment.anchor, renderedRoot);

    if (block === null) {
      return {
        commentId: comment.id,
        status: "missing",
      };
    }

    const blockTextHash = createTextHash(block.textContent ?? "");
    const status: CommentAnchorDisplayStatus =
      blockTextHash === comment.anchor.textHash ? "current" : "stale";

    return {
      commentId: comment.id,
      status,
    };
  });
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

  const block = findCommentAnchorBlock(activeComment.anchor, renderedRoot);

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
    const blockType = mapCommentBlockTypeToBlockType(comment.anchor.blockType);

    if (blockType === null) {
      continue;
    }

    const key = createBlockKey(blockType, comment.anchor.blockIndex);
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
  return {
    commentIds: comments.map((comment) => comment.id),
    selectCommentId: selectCommentIdForHighlight(comments, activeCommentId),
    state: selectCommentHighlightState({
      comments,
      activeCommentId,
      anchorDisplayStateByCommentId,
    }),
  };
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

  const hasOpenComment = comments.some((comment) => !comment.resolved);

  return hasOpenComment ? "open" : "resolved";
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
        isInteractiveHighlightTarget(event.target, event.currentTarget)
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
function createHighlightAriaLabel(highlight: CommentBlockHighlight): string {
  const countLabel =
    highlight.commentIds.length === 1
      ? "1 comment"
      : `${highlight.commentIds.length} comments`;

  return `Markdown block with ${countLabel}`;
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

/** @returns The rendered Markdown block for a persisted comment anchor. */
function findCommentAnchorBlock(
  anchor: CommentAnchor,
  renderedRoot: HTMLElement,
): HTMLElement | null {
  const blockType = mapCommentBlockTypeToBlockType(anchor.blockType);

  if (blockType === null) {
    return null;
  }

  return renderedRoot.querySelector<HTMLElement>(
    `[data-block-type="${blockType}"][data-block-index="${anchor.blockIndex}"]`,
  );
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

/** @returns A stable key for one rendered Markdown block. */
function createBlockKey(blockType: BlockType, blockIndex: number): string {
  return `${blockType}:${blockIndex}`;
}

/** @returns React Markdown component overrides with comment anchor metadata. */
function createMarkdownComponents(blockIndexer: BlockIndexer): Components {
  return {
    h1: ({ node: _node, ...props }) => (
      <h1 {...props} {...blockIndexer.next("heading")} />
    ),
    h2: ({ node: _node, ...props }) => (
      <h2 {...props} {...blockIndexer.next("heading")} />
    ),
    h3: ({ node: _node, ...props }) => (
      <h3 {...props} {...blockIndexer.next("heading")} />
    ),
    h4: ({ node: _node, ...props }) => (
      <h4 {...props} {...blockIndexer.next("heading")} />
    ),
    h5: ({ node: _node, ...props }) => (
      <h5 {...props} {...blockIndexer.next("heading")} />
    ),
    h6: ({ node: _node, ...props }) => (
      <h6 {...props} {...blockIndexer.next("heading")} />
    ),
    p: ({ node: _node, ...props }) => (
      <p {...props} {...blockIndexer.next("paragraph")} />
    ),
    li: (props) => (
      <MarkdownListItem {...props} {...blockIndexer.next("list-item")} />
    ),
    pre: ({ node: _node, ...props }) => (
      <pre {...props} {...blockIndexer.next("code")} />
    ),
    table: ({ node: _node, ...props }) => (
      <div
        className="markdown-rendered__table-scroll"
        {...blockIndexer.next("table")}
      >
        <table {...props} />
      </div>
    ),
    a: ({ node: _node, ...props }) => <SafeMarkdownLink {...props} />,
    input: ({ node: _node, ...props }) => <ReadOnlyMarkdownInput {...props} />,
  };
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
      <span>Add comment</span>
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

type FloatingKind = "button" | "popover";

/** @returns Fixed-position style for selection-adjacent UI. */
function createFloatingStyle(
  draft: CommentAnchorDraft,
  kind: FloatingKind,
): CSSProperties {
  const bounds = draft.selectionBounds;

  if (kind === "button") {
    return {
      top: Math.max(8, bounds.top - 44),
      left: Math.max(8, bounds.left + bounds.width / 2),
    };
  }

  return {
    top: Math.max(8, bounds.top + bounds.height + 10),
    left: Math.max(8, bounds.left),
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
  }> &
  BlockMetadata;

/** @returns A rendered Markdown list item without parser-only props. */
function MarkdownListItem({
  checked: _checked,
  node: _node,
  ...props
}: ListItemProps) {
  return <li {...props} />;
}

type InputProps = ComponentPropsWithoutRef<"input">;

/** @returns A read-only input for rendered Markdown task list items. */
function ReadOnlyMarkdownInput({ type, ...props }: InputProps) {
  if (type !== "checkbox") {
    return <input type={type} {...props} />;
  }

  return <input type={type} {...props} disabled={true} readOnly={true} />;
}
