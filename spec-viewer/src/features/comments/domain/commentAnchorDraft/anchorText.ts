const MAX_SNIPPET_LENGTH = 160;
const FNV_32_OFFSET = 0x811c9dc5;
const FNV_32_PRIME = 0x01000193;

/**
 * @param text - Rendered block text.
 * @returns A stable non-cryptographic hash for the rendered block text.
 */
export function createTextHash(text: string): string {
  let hash = FNV_32_OFFSET;

  for (const character of normalizeWhitespace(text)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, FNV_32_PRIME);
  }

  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * @param text - Raw selected text.
 * @returns A compact selected text snippet, or null when no text is selected.
 */
export function createTextSnippet(text: string): string | null {
  const snippet = normalizeWhitespace(text);

  if (snippet.length === 0) {
    return null;
  }

  return snippet.slice(0, MAX_SNIPPET_LENGTH);
}

/**
 * @param text - Raw text content.
 * @returns Text trimmed and collapsed to single spaces for anchor display.
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
