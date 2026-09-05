import {
  type ComponentPropsWithoutRef,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
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
import { MermaidDiagram } from "../MermaidDiagram";
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

import {
  createRenderedBlockKey,
  type RenderedBlockModel,
  type RenderedBlockProjection,
  type RenderedBlockType,
  type RenderedDocumentPort,
  type RenderedTextDecoration,
} from "./renderedDocument";

type BlockMetadata = Readonly<{
  "data-block-type": RenderedBlockType;
  "data-block-index": number;
  "data-rendered-block-type": MarkdownBlockType;
  "data-text-hash"?: string;
  "data-text-snippet"?: string;
  "data-source-start-byte-offset"?: number;
  "data-source-end-byte-offset"?: number;
}>;

type BlockIndexer = Readonly<{
  /**
   * Returns the next indexed block for the given block type.
   * @param blockType - The Markdown block type being indexed.
   */
  next: (blockType: RenderedBlockType) => IndexedBlock;
}>;

type IndexedBlock = Readonly<{
  model: RenderedBlockModel;
  metadata: BlockMetadata;
  projection: RenderedBlockProjection | null;
}>;

type BackendBlockMatch = Readonly<{
  block: MarkdownBlockMetadata;
  index: number;
}>;

type DocumentSearchCursor = {
  query: string;
  activeIndex: number;
  matchIndex: number;
};

const SYNTAX_HIGHLIGHT_MAX_BYTES = 200_000;

export type MarkdownViewerProps = Readonly<{
  state: SpecDocumentState;
  selectedSpecLabel: string | null;
  selectedFileLabel: string | null;
  selectedFileTypeLabel?: string;
  renderedDocumentPort?: RenderedDocumentPort;
  /** Reloads the current spec document. */
  onReload: () => void;
  onFirstReadable?: () => void;
}>;

/** @returns The Markdown viewer shell with document loading states. */
export function MarkdownViewer({
  state,
  selectedSpecLabel,
  selectedFileLabel,
  selectedFileTypeLabel,
  renderedDocumentPort,
  onReload,
  onFirstReadable,
}: MarkdownViewerProps) {
  const panelRef = useRef<HTMLElement>(null);
  const internalRenderedRootRef = useRef<HTMLDivElement>(null);
  const renderedRootRef =
    renderedDocumentPort?.rootRef ?? internalRenderedRootRef;
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
  const readyContents =
    state.status === "ready" ? state.document.contents : null;
  const readyBlocks = state.status === "ready" ? state.document.blocks : null;
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
  useViewerReset(panelRef, resetKey, state.status !== "idle");
  useEffect(() => {
    setDocumentSearchQuery("");
    setActiveDocumentSearchIndex(0);
    setDocumentSearchMatchCount(0);
    setHtmlZoomPercent(HTML_ZOOM_DEFAULT_PERCENT);
  }, [resetKey]);
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
  useLayoutEffect(() => {
    if (
      state.status !== "ready" ||
      isHtmlDocument ||
      readyContents === null ||
      readyContents.trim().length === 0
    ) {
      return;
    }

    renderedDocumentPort?.onRenderedDocumentCommit();
  }, [
    isHtmlDocument,
    readyBlocks,
    readyContents,
    renderedDocumentPort?.onRenderedDocumentCommit,
    state.status,
  ]);
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
      interactionOverlayOpen={renderedDocumentPort?.isOverlayOpen ?? false}
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
        <MarkdownDocument
          contents={contents}
          blocks={state.document.blocks}
          renderedRootRef={renderedRootRef}
          renderedDocumentPort={renderedDocumentPort}
          documentSearchQuery={normalizedDocumentSearchQuery}
          activeDocumentSearchIndex={activeDocumentSearchIndex}
          syntaxHighlightMaxBytes={SYNTAX_HIGHLIGHT_MAX_BYTES}
        />
      )}
      {renderedDocumentPort?.renderOverlay() ?? null}
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
  renderedDocumentPort?: RenderedDocumentPort;
  documentSearchQuery: string;
  activeDocumentSearchIndex: number;
  syntaxHighlightMaxBytes: number;
}>;

/** @returns Rendered Markdown with stable block metadata and optional projections. */
function MarkdownDocument({
  contents,
  blocks,
  renderedRootRef,
  renderedDocumentPort,
  documentSearchQuery,
  activeDocumentSearchIndex,
  syntaxHighlightMaxBytes,
}: MarkdownDocumentProps) {
  const blockIndexer = createBlockIndexer({
    blocks,
    renderedDocumentPort,
  });
  const documentSearchCursor = createDocumentSearchCursor({
    query: documentSearchQuery,
    activeIndex: activeDocumentSearchIndex,
  });
  const components = createMarkdownComponents({
    blockIndexer,
    documentSearchCursor,
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
  renderedDocumentPort,
}: Readonly<{
  blocks: readonly MarkdownBlockMetadata[];
  renderedDocumentPort?: RenderedDocumentPort;
}>): BlockIndexer {
  let backendBlockCursor = 0;

  return {
    next: (blockType: RenderedBlockType): IndexedBlock => {
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
      const model: RenderedBlockModel = {
        key: createRenderedBlockKey(blockType, currentBlockIndex),
        renderedType: blockType,
        metadata: backendBlock,
      };
      const metadata = attachBackendBlockMetadata(
        {
          "data-block-type": blockType,
          "data-block-index": currentBlockIndex,
          "data-rendered-block-type": backendBlock.blockType,
        },
        backendBlock,
      );

      backendBlockCursor = backendBlockMatch.index + 1;

      return {
        model,
        metadata,
        projection: renderedDocumentPort?.projectBlock(model) ?? null,
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
  blockType: RenderedBlockType;
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

/** @returns The rendered block type corresponding to backend Markdown metadata. */
function mapMarkdownBlockTypeToBlockType(
  blockType: MarkdownBlockType,
): RenderedBlockType | null {
  const blockTypeMap: Partial<Record<MarkdownBlockType, RenderedBlockType>> = {
    heading: "heading",
    paragraph: "paragraph",
    block_quote: "paragraph",
    list_item: "list-item",
    table: "table",
    code_block: "code",
  };

  return blockTypeMap[blockType] ?? null;
}

/** @returns React Markdown component overrides with generic block projections. */
function createMarkdownComponents({
  blockIndexer,
  documentSearchCursor,
}: Readonly<{
  blockIndexer: BlockIndexer;
  documentSearchCursor: DocumentSearchCursor | null;
}>): Components {
  return {
    h1: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("heading");

      return renderProjectedBlock(
        block,
        <h1 {...props}>
          {renderMarkdownTextChildren({
            children,
            decorations: block.projection?.textDecorations ?? [],
            documentSearchCursor,
          })}
        </h1>,
      );
    },
    h2: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("heading");

      return renderProjectedBlock(
        block,
        <h2 {...props}>
          {renderMarkdownTextChildren({
            children,
            decorations: block.projection?.textDecorations ?? [],
            documentSearchCursor,
          })}
        </h2>,
      );
    },
    h3: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("heading");

      return renderProjectedBlock(
        block,
        <h3 {...props}>
          {renderMarkdownTextChildren({
            children,
            decorations: block.projection?.textDecorations ?? [],
            documentSearchCursor,
          })}
        </h3>,
      );
    },
    h4: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("heading");

      return renderProjectedBlock(
        block,
        <h4 {...props}>
          {renderMarkdownTextChildren({
            children,
            decorations: block.projection?.textDecorations ?? [],
            documentSearchCursor,
          })}
        </h4>,
      );
    },
    h5: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("heading");

      return renderProjectedBlock(
        block,
        <h5 {...props}>
          {renderMarkdownTextChildren({
            children,
            decorations: block.projection?.textDecorations ?? [],
            documentSearchCursor,
          })}
        </h5>,
      );
    },
    h6: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("heading");

      return renderProjectedBlock(
        block,
        <h6 {...props}>
          {renderMarkdownTextChildren({
            children,
            decorations: block.projection?.textDecorations ?? [],
            documentSearchCursor,
          })}
        </h6>,
      );
    },
    p: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("paragraph");

      return renderProjectedBlock(
        block,
        <p {...props}>
          {renderMarkdownTextChildren({
            children,
            decorations: block.projection?.textDecorations ?? [],
            documentSearchCursor,
          })}
        </p>,
      );
    },
    li: ({ children, ...props }) => {
      const block = blockIndexer.next("list-item");

      return renderProjectedBlock(
        block,
        <MarkdownListItem {...props}>
          {renderMarkdownTextChildren({
            children,
            decorations: block.projection?.textDecorations ?? [],
            documentSearchCursor,
          })}
        </MarkdownListItem>,
      );
    },
    pre: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("code");
      const mermaidSource = extractMermaidSource(children);

      if (mermaidSource !== null) {
        return renderProjectedBlock(
          block,
          <div className="markdown-rendered__mermaid">
            <MermaidDiagram source={mermaidSource} />
          </div>,
        );
      }

      return renderProjectedBlock(
        block,
        <pre {...props}>
          {renderMarkdownTextChildren({
            children,
            decorations: block.projection?.textDecorations ?? [],
            documentSearchCursor,
          })}
        </pre>,
      );
    },
    table: ({ node: _node, children, ...props }) => {
      const block = blockIndexer.next("table");

      return renderProjectedBlock(
        block,
        <div className="markdown-rendered__table-scroll">
          <table {...props}>
            {renderMarkdownTextChildren({
              children,
              decorations: block.projection?.textDecorations ?? [],
              documentSearchCursor,
            })}
          </table>
        </div>,
      );
    },
    a: ({ node: _node, ...props }) => <SafeMarkdownLink {...props} />,
    input: ({ node: _node, ...props }) => <ReadOnlyMarkdownInput {...props} />,
  };
}

/** @returns A block element enriched by its renderer-owned metadata and projection. */
function renderProjectedBlock(
  block: IndexedBlock,
  element: ReactElement,
): ReactElement {
  const projectedElement = cloneElement(element, {
    ...block.metadata,
    ...block.projection?.attributes,
  });

  return (
    block.projection?.renderContainer?.(block.model, projectedElement) ??
    projectedElement
  );
}

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

/** @returns Markdown children with generic decorations and document search highlights. */
function renderMarkdownTextChildren({
  children,
  decorations,
  documentSearchCursor,
}: Readonly<{
  children: ReactNode;
  decorations: readonly RenderedTextDecoration[];
  documentSearchCursor: DocumentSearchCursor | null;
}>): ReactNode {
  const decoratedChildren = renderDecoratedChildren(children, decorations);

  if (documentSearchCursor === null) {
    return decoratedChildren;
  }

  return renderDocumentSearchHighlightedNode(
    decoratedChildren,
    documentSearchCursor,
  );
}

type RangeRenderCursor = {
  position: number;
  keyIndex: number;
};

/** @returns Markdown children with text ranges wrapped for emphasis. */
function renderDecoratedChildren(
  children: ReactNode,
  decorations: readonly RenderedTextDecoration[],
): ReactNode {
  if (decorations.length === 0) {
    return children;
  }

  const cursor: RangeRenderCursor = {
    position: 0,
    keyIndex: 0,
  };
  const sortedHighlights = [...decorations].sort(
    (left, right) => left.start - right.start,
  );

  return renderDecoratedNode(children, sortedHighlights, cursor);
}

/** @returns One React node with text decoration spans inserted into text descendants. */
function renderDecoratedNode(
  node: ReactNode,
  decorations: readonly RenderedTextDecoration[],
  cursor: RangeRenderCursor,
): ReactNode {
  if (typeof node === "string" || typeof node === "number") {
    return renderDecoratedText(String(node), decorations, cursor);
  }

  if (Array.isArray(node)) {
    return node.map((child) => renderDecoratedNode(child, decorations, cursor));
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
    renderDecoratedNode(childElement.props.children, decorations, cursor),
  );
}

/** @returns True when a Markdown descendant should keep its code styling intact. */
type MarkdownCodeElementProps = Readonly<{
  children?: ReactNode;
  className?: string;
}>;

/** @returns Mermaid source for a fenced `mermaid` block, otherwise null. */
function extractMermaidSource(children: ReactNode): string | null {
  const childNodes = Array.isArray(children) ? children : [children];

  if (childNodes.length !== 1) {
    return null;
  }

  const codeElement = childNodes[0];

  if (!isValidElement<MarkdownCodeElementProps>(codeElement)) {
    return null;
  }

  const languageClasses = codeElement.props.className?.split(/\s+/) ?? [];

  if (!languageClasses.includes("language-mermaid")) {
    return null;
  }

  return readReactNodeText(codeElement.props.children).trimEnd();
}

/** @returns Concatenated text content from a React node tree. */
function readReactNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(readReactNodeText).join("");
  }

  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return "";
  }

  return readReactNodeText(node.props.children);
}

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
function renderDecoratedText(
  text: string,
  decorations: readonly RenderedTextDecoration[],
  cursor: RangeRenderCursor,
): ReactNode {
  const absoluteStart = cursor.position;
  const absoluteEnd = absoluteStart + text.length;
  const parts: ReactNode[] = [];
  let localOffset = 0;

  for (const decoration of decorations) {
    if (decoration.end <= absoluteStart) {
      continue;
    }

    if (decoration.start >= absoluteEnd) {
      break;
    }

    const rangeStart = Math.max(decoration.start - absoluteStart, localOffset);
    const rangeEnd = Math.min(decoration.end - absoluteStart, text.length);

    if (rangeEnd <= rangeStart) {
      continue;
    }

    if (rangeStart > localOffset) {
      parts.push(text.slice(localOffset, rangeStart));
    }

    parts.push(
      cloneElement(decoration.render(text.slice(rangeStart, rangeEnd)), {
        key: `${decoration.key}-${cursor.keyIndex}`,
      }),
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

type ListItemProps = ComponentPropsWithoutRef<"li"> &
  Readonly<{
    checked?: boolean | null;
    node?: unknown;
  }>;

/** @returns A rendered Markdown list item without parser-only props. */
function MarkdownListItem({
  checked: _checked,
  node: _node,
  ...props
}: ListItemProps) {
  return <li {...props} />;
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
