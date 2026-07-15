import { expect, test } from "vitest";

import {
  BlockIdentity,
  BlockIndex,
  BlockType,
  CharRange,
  CommentAnchor,
  TextHash,
  TextSnippet,
} from "@/features/comments/domain/commentAnchor";

test("有効な値からコメントアンカーを生成する", () => {
  const result = CommentAnchor.parse({
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 3,
    textHash: "  sha256:abc12345  ",
    textSnippet: "Selected text",
    charRange: { start: 4, end: 17 },
  });

  expect(result).toEqual({
    ok: true,
    value: {
      fileKey: "tasks",
      blockType: "paragraph",
      blockIndex: 3,
      textHash: "sha256:abc12345",
      textSnippet: "Selected text",
      charRange: { start: 4, end: 17 },
    },
  });
});

test.each([
  "unsupported",
  "list-item",
  "",
])("未対応コメントブロック種別%sを拒否する", (value) => {
  expect(BlockType.parse(value)).toEqual({
    ok: false,
    error: { reason: "unsupported_block_type", value },
  });
});

test.each([
  -1,
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
])("不正なブロックindex %sを拒否する", (value) => {
  expect(BlockIndex.parse(value)).toEqual({
    ok: false,
    error: { reason: "invalid_block_index", value },
  });
});

test.each([
  [-1, 3],
  [3, 3],
  [4, 3],
  [1.5, 3],
] as const)("不正な文字範囲%s..%sを拒否する", (start, end) => {
  expect(CharRange.parse({ start, end })).toEqual({
    ok: false,
    error: { reason: "invalid_char_range", start, end },
  });
});

test.each([
  Symbol("start"),
  {
    valueOf() {
      throw new Error("CharRange must not coerce an object start value");
    },
  },
])("unknownな文字範囲を数値変換せずtyped errorで拒否する", (start) => {
  expect(CharRange.parse({ start, end: 3 })).toEqual({
    ok: false,
    error: { reason: "invalid_char_range", start, end: 3 },
  });
});

test("空白だけのtext hashを拒否する", () => {
  expect(TextHash.parse("   ")).toEqual({
    ok: false,
    error: { reason: "invalid_text_hash", value: "   " },
  });
});

test("空白だけのtext snippetを拒否する", () => {
  expect(TextSnippet.parse("   ")).toEqual({
    ok: false,
    error: { reason: "invalid_text_snippet", value: "   " },
  });
});

test("ブロックidentityは種別と非負indexをまとめて検証する", () => {
  expect(
    BlockIdentity.parse({ blockType: "code_block", blockIndex: 0 }),
  ).toEqual({
    ok: true,
    value: { blockType: "code_block", blockIndex: 0 },
  });
});

test.each([
  ["heading", "heading"],
  ["paragraph", "paragraph"],
  ["list-item", "list_item"],
  ["table", "table"],
  ["code", "code_block"],
  ["blockquote", "block_quote"],
] as const)("rendered block種別%sをcomment block種別%sへ変換する", (renderedBlockType, commentBlockType) => {
  expect(BlockType.fromRendered(renderedBlockType)).toEqual({
    ok: true,
    value: commentBlockType,
  });
  expect(BlockType.toRendered(commentBlockType)).toBe(renderedBlockType);
});

test.each([
  "thematic_break",
  "html",
  "other",
] as const)("Viewerが描画対象にしないcomment block種別%sはrendered種別へ変換しない", (blockType) => {
  expect(BlockType.toRendered(blockType)).toBeNull();
});
