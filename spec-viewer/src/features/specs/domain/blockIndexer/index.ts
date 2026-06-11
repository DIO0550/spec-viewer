import {
  type CommentBlockAnnotation,
  CommentBlockHighlight,
  type CommentBlockHighlights,
  type CommentRangeHighlight,
} from "@/features/specs/domain/commentBlockHighlight";
import {
  type BlockMetadata,
  type BlockType,
  MarkdownBlock,
} from "@/features/specs/domain/markdownBlock";
import type { MarkdownBlockMetadata } from "@/features/specs/types/spec";

export type IndexedBlock = Readonly<{
  metadata: BlockMetadata;
  rangeHighlights: readonly CommentRangeHighlight[];
  commentAnnotations: readonly CommentBlockAnnotation[];
}>;

export type BlockIndexer = Readonly<{
  /**
   * @param blockType - Rendered block type for the next Markdown element
   * @returns Metadata and highlights for the next rendered block.
   */
  next: (blockType: BlockType) => IndexedBlock;
}>;

export const BlockIndexer = {
  /**
   * @param input - Backend block metadata and comment highlights for the render
   * @returns A sequential block indexer scoped to one Markdown render.
   */
  create({
    blocks,
    highlights,
  }: Readonly<{
    blocks: readonly MarkdownBlockMetadata[];
    highlights: CommentBlockHighlights;
  }>): BlockIndexer {
    let fallbackBlockIndex = 0;
    let backendBlockCursor = 0;

    return {
      /**
       * @param blockType - Rendered block type for the next Markdown element
       * @returns Metadata and highlights for the next rendered block.
       */
      next: (blockType: BlockType): IndexedBlock => {
        const backendBlockMatch = MarkdownBlock.findNextBackendBlock({
          blocks,
          blockType,
          startIndex: backendBlockCursor,
        });
        const backendBlock = backendBlockMatch?.block ?? null;
        const currentBlockIndex =
          backendBlock?.blockIndex ?? fallbackBlockIndex;
        const metadata: BlockMetadata = {
          "data-block-type": blockType,
          "data-block-index": currentBlockIndex,
        };
        const highlight = highlights.get(
          MarkdownBlock.createKey(blockType, currentBlockIndex),
        );

        fallbackBlockIndex += 1;

        if (backendBlockMatch !== null) {
          backendBlockCursor = backendBlockMatch.index + 1;
        }

        return {
          metadata: CommentBlockHighlight.applyToMetadata({
            metadata: MarkdownBlock.attachBackendMetadata(
              metadata,
              backendBlock,
            ),
            highlight,
          }),
          rangeHighlights: highlight?.rangeHighlights ?? [],
          commentAnnotations: highlight?.annotations ?? [],
        };
      },
    };
  },
} as const;
