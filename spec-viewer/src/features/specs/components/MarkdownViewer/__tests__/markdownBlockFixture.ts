import { createTextHash } from "@/features/comments/lib/comment-anchor-draft";
import type { MarkdownBlockMetadata } from "@/features/specs/types/spec";

/**
 * Builds block metadata for Markdown fixtures used by MarkdownViewer tests.
 *
 * This mirrors the backend block scanner closely enough for rendering and
 * comment-anchor assertions. It lives outside the test file so the branching
 * fixture logic stays out of `*.test.tsx` sources.
 *
 * @param contents - Raw Markdown contents, or null when the document is absent.
 * @returns Ordered block metadata for the given contents (empty when null).
 */
export function createTestMarkdownBlocks(
  contents: string | null,
): readonly MarkdownBlockMetadata[] {
  if (contents === null) {
    return [];
  }

  const lines = contents.split("\n");
  const blocks: MarkdownBlockMetadata[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const trimmedLine = line.trim();

    if (trimmedLine.length === 0) {
      continue;
    }

    let blockType: MarkdownBlockMetadata["blockType"];
    let text = trimmedLine;

    if (trimmedLine.startsWith("```")) {
      blockType = "code_block";
      const codeLines: string[] = [];
      lineIndex += 1;
      while (
        lineIndex < lines.length &&
        !(lines[lineIndex] ?? "").trim().startsWith("```")
      ) {
        codeLines.push(lines[lineIndex] ?? "");
        lineIndex += 1;
      }
      text = codeLines.join("\n");
    } else if (/^#{1,6}\s/.test(trimmedLine)) {
      blockType = "heading";
      text = trimmedLine.replace(/^#{1,6}\s+/, "");
    } else if (/^>\s?/.test(trimmedLine)) {
      blockType = "block_quote";
      text = trimmedLine.replace(/^>\s?/, "");
    } else if (/^(?:[-*+]\s|\d+\.\s)/.test(trimmedLine)) {
      blockType = "list_item";
      text = trimmedLine
        .replace(/^(?:[-*+]\s|\d+\.\s)/, "")
        .replace(/^\[[ xX]\]\s*/, "");
    } else if (
      trimmedLine.startsWith("|") &&
      /^\|?\s*:?-{3,}/.test((lines[lineIndex + 1] ?? "").trim())
    ) {
      blockType = "table";
      const tableLines = [trimmedLine];
      lineIndex += 1;
      while (
        lineIndex < lines.length &&
        (lines[lineIndex] ?? "").trim().length > 0
      ) {
        tableLines.push((lines[lineIndex] ?? "").trim());
        lineIndex += 1;
      }
      lineIndex -= 1;
      text = tableLines.join("\n");
    } else if (/^(?:---+|\*\*\*+|___+)$/.test(trimmedLine)) {
      blockType = "thematic_break";
    } else if (/^<[^>]+>/.test(trimmedLine)) {
      blockType = "html";
    } else {
      blockType = "paragraph";
      const paragraphLines = [trimmedLine];
      while (
        lineIndex + 1 < lines.length &&
        (lines[lineIndex + 1] ?? "").trim().length > 0
      ) {
        lineIndex += 1;
        paragraphLines.push((lines[lineIndex] ?? "").trim());
      }
      text = paragraphLines.join(" ");
    }

    blocks.push({
      blockType,
      blockIndex: blocks.length,
      textHash: createTextHash(text),
      textSnippet: text.slice(0, 160),
      sourceRange: null,
    });
  }

  return blocks;
}
