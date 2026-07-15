import type { SpecFileKey } from "@/shared/domain/specFileKey";

declare const blockIndexBrand: unique symbol;
declare const charRangeBrand: unique symbol;
declare const textHashBrand: unique symbol;
declare const textSnippetBrand: unique symbol;
declare const blockIdentityBrand: unique symbol;
declare const commentAnchorBrand: unique symbol;

export type BlockType =
  | "paragraph"
  | "heading"
  | "list_item"
  | "code_block"
  | "block_quote"
  | "table"
  | "thematic_break"
  | "html"
  | "other";

export type RenderedBlockType =
  | "heading"
  | "paragraph"
  | "list-item"
  | "table"
  | "code"
  | "blockquote";

export type BlockIndex = number & {
  readonly [blockIndexBrand]: "BlockIndex";
};

export type CharRange = Readonly<{
  start: number;
  end: number;
  [charRangeBrand]: "CharRange";
}>;

export type TextHash = string & {
  readonly [textHashBrand]: "TextHash";
};

export type TextSnippet = string & {
  readonly [textSnippetBrand]: "TextSnippet";
};

export type BlockIdentity = Readonly<{
  blockType: BlockType;
  blockIndex: BlockIndex;
  [blockIdentityBrand]: "BlockIdentity";
}>;

export type RenderedBlockSnapshot = Readonly<{
  identity: BlockIdentity;
  text: string;
  textHash: TextHash | null;
}>;

export type SelectionOffsets = Readonly<{
  start: number;
  end: number;
}>;

export type CommentAnchor = Readonly<{
  fileKey: SpecFileKey;
  blockType: BlockType;
  blockIndex: BlockIndex;
  textHash: TextHash;
  textSnippet: TextSnippet;
  charRange: CharRange;
  [commentAnchorBrand]: "CommentAnchor";
}>;

export type CommentAnchorDomainError =
  | Readonly<{
      reason: "unsupported_block_type";
      value: unknown;
    }>
  | Readonly<{
      reason: "invalid_block_index";
      value: unknown;
    }>
  | Readonly<{
      reason: "invalid_char_range";
      start: unknown;
      end: unknown;
    }>
  | Readonly<{
      reason: "invalid_text_hash";
      value: unknown;
    }>
  | Readonly<{
      reason: "invalid_text_snippet";
      value: unknown;
    }>;

export type CommentAnchorParseResult<T> =
  | Readonly<{
      ok: true;
      value: T;
    }>
  | Readonly<{
      ok: false;
      error: CommentAnchorDomainError;
    }>;

export type CommentAnchorParseInput = Readonly<{
  fileKey: SpecFileKey;
  blockType: unknown;
  blockIndex: unknown;
  textHash: unknown;
  textSnippet: unknown;
  charRange: Readonly<{
    start: unknown;
    end: unknown;
  }>;
}>;

const blockTypes: readonly BlockType[] = [
  "paragraph",
  "heading",
  "list_item",
  "code_block",
  "block_quote",
  "table",
  "thematic_break",
  "html",
  "other",
];

const renderedBlockTypeMap: Readonly<Record<RenderedBlockType, BlockType>> = {
  heading: "heading",
  paragraph: "paragraph",
  "list-item": "list_item",
  table: "table",
  code: "code_block",
  blockquote: "block_quote",
};

const commentBlockTypeMap: Readonly<
  Partial<Record<BlockType, RenderedBlockType>>
> = {
  heading: "heading",
  paragraph: "paragraph",
  list_item: "list-item",
  table: "table",
  code_block: "code",
  block_quote: "blockquote",
};

/**
 * @param value - Parsed value.
 * @returns A successful value-object parse result.
 */
function success<T>(value: T): CommentAnchorParseResult<T> {
  return { ok: true, value };
}

/**
 * @param error - Typed domain validation error.
 * @returns A failed value-object parse result.
 */
function failure<T>(
  error: CommentAnchorDomainError,
): CommentAnchorParseResult<T> {
  return { ok: false, error };
}

export const BlockType = {
  /**
   * @param value - Candidate persisted comment block type.
   * @returns A supported block type or a typed domain error.
   */
  parse(value: unknown): CommentAnchorParseResult<BlockType> {
    if (typeof value !== "string" || !isBlockType(value)) {
      return failure({ reason: "unsupported_block_type", value });
    }

    return success(value);
  },

  /**
   * @param value - Candidate rendered Markdown block type.
   * @returns Its persisted comment block type or a typed domain error.
   */
  fromRendered(value: unknown): CommentAnchorParseResult<BlockType> {
    if (typeof value !== "string" || !isRenderedBlockType(value)) {
      return failure({ reason: "unsupported_block_type", value });
    }

    return success(renderedBlockTypeMap[value]);
  },

  /**
   * @param value - Persisted comment block type.
   * @returns The Viewer dataset block type, or null when Viewer has no mapping.
   */
  toRendered(value: BlockType): RenderedBlockType | null {
    return commentBlockTypeMap[value] ?? null;
  },
} as const;

export const BlockIndex = {
  /**
   * @param value - Candidate zero-based block index.
   * @returns A validated non-negative safe integer or a typed domain error.
   */
  parse(value: unknown): CommentAnchorParseResult<BlockIndex> {
    if (!Number.isSafeInteger(value) || Number(value) < 0) {
      return failure({ reason: "invalid_block_index", value });
    }

    return success(value as BlockIndex);
  },
} as const;

export const CharRange = {
  /**
   * @param input - Candidate start and end character offsets.
   * @returns A validated non-empty ordered range or a typed domain error.
   */
  parse(
    input: Readonly<{ start: unknown; end: unknown }>,
  ): CommentAnchorParseResult<CharRange> {
    const { start, end } = input;
    if (
      typeof start !== "number" ||
      typeof end !== "number" ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end <= start
    ) {
      return failure({ reason: "invalid_char_range", start, end });
    }

    return success({ start, end } as CharRange);
  },
} as const;

export const TextHash = {
  /**
   * @param value - Candidate rendered-text hash.
   * @returns A trimmed non-empty hash or a typed domain error.
   */
  parse(value: unknown): CommentAnchorParseResult<TextHash> {
    if (typeof value !== "string" || value.trim().length === 0) {
      return failure({ reason: "invalid_text_hash", value });
    }

    return success(value.trim() as TextHash);
  },
} as const;

export const TextSnippet = {
  /**
   * @param value - Candidate selected-text snippet.
   * @returns A non-blank snippet preserving its supplied text or a typed error.
   */
  parse(value: unknown): CommentAnchorParseResult<TextSnippet> {
    if (typeof value !== "string" || value.trim().length === 0) {
      return failure({ reason: "invalid_text_snippet", value });
    }

    return success(value as TextSnippet);
  },
} as const;

export const BlockIdentity = {
  /**
   * @param input - Candidate block type and index.
   * @returns A validated block identity or its first typed domain error.
   */
  parse(
    input: Readonly<{ blockType: unknown; blockIndex: unknown }>,
  ): CommentAnchorParseResult<BlockIdentity> {
    const blockType = BlockType.parse(input.blockType);

    if (!blockType.ok) {
      return blockType;
    }

    const blockIndex = BlockIndex.parse(input.blockIndex);

    if (!blockIndex.ok) {
      return blockIndex;
    }

    return success({
      blockType: blockType.value,
      blockIndex: blockIndex.value,
    } as BlockIdentity);
  },
} as const;

export const CommentAnchor = {
  /**
   * @param input - Candidate persisted or newly drafted anchor fields.
   * @returns A validated comment anchor or its first typed domain error.
   */
  parse(
    input: CommentAnchorParseInput,
  ): CommentAnchorParseResult<CommentAnchor> {
    const identity = BlockIdentity.parse(input);

    if (!identity.ok) {
      return identity;
    }

    const textHash = TextHash.parse(input.textHash);

    if (!textHash.ok) {
      return textHash;
    }

    const textSnippet = TextSnippet.parse(input.textSnippet);

    if (!textSnippet.ok) {
      return textSnippet;
    }

    const charRange = CharRange.parse(input.charRange);

    if (!charRange.ok) {
      return charRange;
    }

    return success({
      fileKey: input.fileKey,
      blockType: identity.value.blockType,
      blockIndex: identity.value.blockIndex,
      textHash: textHash.value,
      textSnippet: textSnippet.value,
      charRange: charRange.value,
    } as CommentAnchor);
  },
} as const;

/**
 * @param value - Candidate persisted comment block type.
 * @returns true when a string is a supported persisted comment block type.
 */
function isBlockType(value: string): value is BlockType {
  return blockTypes.some((blockType) => blockType === value);
}

/**
 * @param value - Candidate rendered Markdown block type.
 * @returns true when a string is a supported rendered Markdown block type.
 */
function isRenderedBlockType(value: string): value is RenderedBlockType {
  return Object.prototype.hasOwnProperty.call(renderedBlockTypeMap, value);
}
