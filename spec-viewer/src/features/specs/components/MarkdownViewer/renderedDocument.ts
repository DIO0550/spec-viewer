import type { ReactElement, ReactNode, RefObject } from "react";
import type {
  MarkdownBlockMetadata,
  MarkdownBlockSourceRange,
  MarkdownBlockType,
} from "@/features/specs/types/spec";

export type RenderedBlockType =
  | "heading"
  | "paragraph"
  | "list-item"
  | "table"
  | "code";

export type RenderedBlockModel = Readonly<{
  key: string;
  renderedType: RenderedBlockType;
  metadata: MarkdownBlockMetadata;
}>;

export type RenderedTextDecoration = Readonly<{
  key: string;
  start: number;
  end: number;
  render: (children: ReactNode) => ReactElement;
}>;

export type RenderedBlockProjection = Readonly<{
  attributes: Readonly<Record<string, string | number | undefined>>;
  textDecorations: readonly RenderedTextDecoration[];
  renderContainer: (
    block: RenderedBlockModel,
    children: ReactElement,
  ) => ReactElement;
}>;

export type RenderedDocumentPort = Readonly<{
  rootRef: RefObject<HTMLDivElement | null>;
  isOverlayOpen: boolean;
  projectBlock: (block: RenderedBlockModel) => RenderedBlockProjection | null;
  onRenderedDocumentCommit: () => void;
  renderOverlay: () => ReactNode;
}>;

const renderedBlockTypes = [
  "heading",
  "paragraph",
  "list-item",
  "table",
  "code",
] as const satisfies readonly RenderedBlockType[];

const markdownBlockTypes = [
  "paragraph",
  "heading",
  "list_item",
  "code_block",
  "block_quote",
  "table",
  "thematic_break",
  "html",
  "other",
] as const satisfies readonly MarkdownBlockType[];

const invalidSourceRange = Symbol("invalid-source-range");

/**
 * Creates the stable identity used by rendered block projections.
 * @param renderedType - The HTML-facing kind rendered by MarkdownViewer.
 * @param blockIndex - The backend block index.
 * @returns A stable key scoped to one rendered document.
 */
export function createRenderedBlockKey(
  renderedType: RenderedBlockType,
  blockIndex: number,
): string {
  return `${renderedType}:${blockIndex}`;
}

/**
 * Decodes the public rendered-block data attributes on an element.
 * @param element - A candidate rendered Markdown block.
 * @returns A DOM-free model, or null when the metadata contract is invalid.
 */
export function readRenderedBlockModel(
  element: HTMLElement,
): RenderedBlockModel | null {
  const renderedType = element.dataset.blockType;
  const blockIndex = Number(element.dataset.blockIndex);
  const sourceBlockType = element.dataset.renderedBlockType;
  const textHash = element.dataset.textHash;
  const textSnippet = element.dataset.textSnippet;
  const sourceRange = readSourceRange(element);

  if (
    !isRenderedBlockType(renderedType) ||
    !Number.isSafeInteger(blockIndex) ||
    blockIndex < 0 ||
    !isMarkdownBlockType(sourceBlockType) ||
    textHash === undefined ||
    textSnippet === undefined ||
    sourceRange === invalidSourceRange
  ) {
    return null;
  }

  return {
    key: createRenderedBlockKey(renderedType, blockIndex),
    renderedType,
    metadata: {
      blockType: sourceBlockType,
      blockIndex,
      textHash,
      textSnippet,
      sourceRange,
    },
  };
}

/** @returns Whether a value belongs to the rendered block type contract. */
function isRenderedBlockType(
  value: string | undefined,
): value is RenderedBlockType {
  return renderedBlockTypes.some((candidate) => candidate === value);
}

/** @returns Whether a value is a backend Markdown block type. */
function isMarkdownBlockType(
  value: string | undefined,
): value is MarkdownBlockType {
  return markdownBlockTypes.some((candidate) => candidate === value);
}

/** @returns A validated source range, null when omitted, or an invalid sentinel. */
function readSourceRange(
  element: HTMLElement,
): MarkdownBlockSourceRange | null | typeof invalidSourceRange {
  const startValue = element.dataset.sourceStartByteOffset;
  const endValue = element.dataset.sourceEndByteOffset;

  if (startValue === undefined && endValue === undefined) {
    return null;
  }

  if (startValue === undefined || endValue === undefined) {
    return invalidSourceRange;
  }

  const startByteOffset = Number(startValue);
  const endByteOffset = Number(endValue);
  const hasValidOffsets =
    Number.isSafeInteger(startByteOffset) &&
    Number.isSafeInteger(endByteOffset) &&
    startByteOffset >= 0 &&
    endByteOffset >= startByteOffset;

  if (!hasValidOffsets) {
    return invalidSourceRange;
  }

  return { startByteOffset, endByteOffset };
}
