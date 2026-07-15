import {
  CharRange,
  CommentAnchor,
  type CommentAnchorDomainError,
  type CommentAnchorParseResult,
  type RenderedBlockSnapshot,
  type SelectionOffsets,
  TextHash,
  type TextHash as TextHashValue,
  TextSnippet,
} from "@/features/comments/domain/commentAnchor";
import type { SpecFileKey } from "@/shared/domain/specFileKey";

export type {
  RenderedBlockSnapshot,
  SelectionOffsets,
} from "@/features/comments/domain/commentAnchor";

export type CommentAnchorDraftValue = Readonly<{
  anchor: CommentAnchor;
}>;

type CreateCommentAnchorDraftInput = Readonly<{
  fileKey: SpecFileKey;
  block: RenderedBlockSnapshot;
  selectionOffsets: SelectionOffsets;
}>;

const MAX_SNIPPET_LENGTH = 160;

export const CommentAnchorDraftFactory = {
  /**
   * @param input - DOM-free rendered block snapshot and selected offsets.
   * @returns A validated anchor draft or its first typed domain error.
   */
  create(
    input: CreateCommentAnchorDraftInput,
  ): CommentAnchorParseResult<CommentAnchorDraftValue> {
    const charRange = CharRange.parse(input.selectionOffsets);

    if (!charRange.ok) {
      return charRange;
    }

    if (charRange.value.end > input.block.text.length) {
      return invalidRange(input.selectionOffsets);
    }

    const selectedText = input.block.text.slice(
      charRange.value.start,
      charRange.value.end,
    );
    const textSnippet = TextSnippet.parse(createTextSnippet(selectedText));

    if (!textSnippet.ok) {
      return textSnippet;
    }

    const textHash = resolveTextHash(input.block);

    if (!textHash.ok) {
      return textHash;
    }

    return createDraft(
      input,
      textHash.value,
      textSnippet.value,
      charRange.value,
    );
  },
} as const;

/**
 * @param text - Selected rendered text.
 * @returns Compact display snippet capped at the persisted maximum length.
 */
export function createTextSnippet(text: string): string | null {
  const snippet = Array.from(normalizeWhitespace(text))
    .slice(0, MAX_SNIPPET_LENGTH)
    .join("");

  return snippet.length === 0 ? null : snippet;
}

/**
 * @param block - Rendered block snapshot.
 * @returns Its required canonical backend fingerprint.
 */
function resolveTextHash(
  block: RenderedBlockSnapshot,
): CommentAnchorParseResult<TextHashValue> {
  return TextHash.parseCanonical(block.textHash);
}

/**
 * @param input - Draft factory input.
 * @param textHash - Validated block hash.
 * @param textSnippet - Validated selected-text snippet.
 * @param charRange - Validated selected character range.
 * @returns A validated anchor draft or its first typed domain error.
 */
function createDraft(
  input: CreateCommentAnchorDraftInput,
  textHash: TextHashValue,
  textSnippet: TextSnippet,
  charRange: CharRange,
): CommentAnchorParseResult<CommentAnchorDraftValue> {
  const anchor = CommentAnchor.parse({
    fileKey: input.fileKey,
    blockType: input.block.identity.blockType,
    blockIndex: input.block.identity.blockIndex,
    textHash,
    textSnippet,
    charRange,
  });

  if (!anchor.ok) {
    return anchor;
  }

  return { ok: true, value: { anchor: anchor.value } };
}

/**
 * @param offsets - Invalid selected offsets.
 * @returns A typed invalid-range result.
 */
function invalidRange<T>(
  offsets: SelectionOffsets,
): CommentAnchorParseResult<T> {
  const error: CommentAnchorDomainError = {
    reason: "invalid_char_range",
    start: offsets.start,
    end: offsets.end,
  };

  return { ok: false, error };
}

/**
 * @param text - Text to normalize.
 * @returns Trimmed text with whitespace runs collapsed to one space.
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
