import { expect, test } from "vitest";

import { createTextHash } from "@/features/comments/lib/comment-anchor-draft";
import {
  type BlockMetadata,
  MarkdownBlock,
} from "@/features/specs/domain/markdownBlock";
import type { MarkdownBlockMetadata } from "@/features/specs/types/spec";

const paragraphBlock: MarkdownBlockMetadata = {
  blockType: "paragraph",
  blockIndex: 3,
  textHash: "sha256:paragraph",
  textSnippet: "A paragraph",
  sourceRange: { startByteOffset: 10, endByteOffset: 24 },
};

const headingBlock: MarkdownBlockMetadata = {
  blockType: "heading",
  blockIndex: 0,
  textHash: "sha256:heading",
  textSnippet: "A heading",
  sourceRange: null,
};

const baseMetadata: BlockMetadata = {
  "data-block-type": "paragraph",
  "data-block-index": 0,
};

test("createKeyはブロック種別とインデックスを結合する", () => {
  expect(MarkdownBlock.createKey("list-item", 4)).toBe("list-item:4");
});

test.each([
  ["heading", "heading"],
  ["paragraph", "paragraph"],
  ["list_item", "list-item"],
  ["table", "table"],
  ["code_block", "code"],
] as const)("fromCommentBlockTypeはアンカー種別を描画ブロック種別へ変換する(%s)", (input, expected) => {
  expect(MarkdownBlock.fromCommentBlockType(input)).toBe(expected);
});

test.each([
  ["block_quote"],
  ["thematic_break"],
  ["html"],
  ["other"],
] as const)("fromMarkdownBlockTypeは未対応のブロック種別でnullを返す(%s)", (input) => {
  expect(MarkdownBlock.fromMarkdownBlockType(input)).toBeNull();
});

test("findNextBackendBlockは開始位置以降で型が一致する最初のブロックを返す", () => {
  const blocks = [headingBlock, paragraphBlock];

  expect(
    MarkdownBlock.findNextBackendBlock({
      blocks,
      blockType: "paragraph",
      startIndex: 0,
    }),
  ).toEqual({ block: paragraphBlock, index: 1 });
  expect(
    MarkdownBlock.findNextBackendBlock({
      blocks,
      blockType: "heading",
      startIndex: 1,
    }),
  ).toBeNull();
});

test("attachBackendMetadataはバックエンドのアンカー情報とソース範囲を付与する", () => {
  const result = MarkdownBlock.attachBackendMetadata(
    baseMetadata,
    paragraphBlock,
  );

  expect(result).toEqual({
    "data-block-type": "paragraph",
    "data-block-index": 3,
    "data-comment-block-type": "paragraph",
    "data-text-hash": "sha256:paragraph",
    "data-text-snippet": "A paragraph",
    "data-source-start-byte-offset": 10,
    "data-source-end-byte-offset": 24,
  });
});

test("attachBackendMetadataはソース範囲が無い場合オフセット属性を付けない", () => {
  const result = MarkdownBlock.attachBackendMetadata(
    baseMetadata,
    headingBlock,
  );

  expect(result["data-source-start-byte-offset"]).toBeUndefined();
  expect(result["data-text-hash"]).toBe("sha256:heading");
});

test("attachBackendMetadataはバックエンドブロックが無ければそのまま返す", () => {
  expect(MarkdownBlock.attachBackendMetadata(baseMetadata, null)).toBe(
    baseMetadata,
  );
});

test("readRenderedTextHashはdata属性のハッシュを優先する", () => {
  const block = document.createElement("p");
  block.dataset.textHash = "sha256:from-backend";
  block.textContent = "Rendered text";

  expect(MarkdownBlock.readRenderedTextHash(block)).toBe("sha256:from-backend");
});

test("readRenderedTextHashはdata属性が無ければ本文からレガシーハッシュを作る", () => {
  const block = document.createElement("p");
  block.textContent = "Rendered text";

  expect(MarkdownBlock.readRenderedTextHash(block)).toBe(
    createTextHash("Rendered text"),
  );
});
