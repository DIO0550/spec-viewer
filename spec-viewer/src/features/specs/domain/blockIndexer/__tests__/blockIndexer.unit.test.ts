import { expect, test } from "vitest";

import type { Comment } from "@/features/comments/domain/comment";
import { CommentId as CommentIdValue } from "@/features/comments/types/comment";
import { BlockIndexer } from "@/features/specs/domain/blockIndexer";
import { CommentBlockHighlight } from "@/features/specs/domain/commentBlockHighlight";
import type { MarkdownBlockMetadata } from "@/features/specs/types/spec";

const commentId = CommentIdValue.fromString;

const backendBlocks: readonly MarkdownBlockMetadata[] = [
  {
    blockType: "heading",
    blockIndex: 0,
    textHash: "sha256:heading",
    textSnippet: "Title",
    sourceRange: { startByteOffset: 0, endByteOffset: 7 },
  },
  {
    blockType: "paragraph",
    blockIndex: 1,
    textHash: "sha256:paragraph",
    textSnippet: "Body",
    sourceRange: null,
  },
];

const emptyHighlights = new Map();

test("nextはバックエンドブロックの順序を辿りメタデータを付与する", () => {
  const indexer = BlockIndexer.create({
    blocks: backendBlocks,
    highlights: emptyHighlights,
  });

  const heading = indexer.next("heading");
  const paragraph = indexer.next("paragraph");

  expect(heading.metadata["data-block-index"]).toBe(0);
  expect(heading.metadata["data-text-hash"]).toBe("sha256:heading");
  expect(heading.metadata["data-source-start-byte-offset"]).toBe(0);
  expect(paragraph.metadata["data-block-index"]).toBe(1);
  expect(paragraph.metadata["data-text-hash"]).toBe("sha256:paragraph");
});

test("nextはバックエンドに一致が無ければ描画順のフォールバック番号を使う", () => {
  const indexer = BlockIndexer.create({
    blocks: [],
    highlights: emptyHighlights,
  });

  const first = indexer.next("paragraph");
  const second = indexer.next("paragraph");

  expect(first.metadata).toEqual({
    "data-block-type": "paragraph",
    "data-block-index": 0,
  });
  expect(second.metadata["data-block-index"]).toBe(1);
});

test("nextは消費済みのバックエンドブロックへ巻き戻らない", () => {
  const indexer = BlockIndexer.create({
    blocks: backendBlocks,
    highlights: emptyHighlights,
  });

  indexer.next("paragraph");
  const second = indexer.next("paragraph");

  expect(second.metadata["data-text-hash"]).toBeUndefined();
  expect(second.metadata["data-block-index"]).toBe(1);
});

test("nextは該当ブロックのハイライトをメタデータと注釈に反映する", () => {
  const comment: Comment = {
    id: commentId("cmt_1"),
    anchor: {
      fileKey: "tasks",
      blockType: "paragraph",
      blockIndex: 1,
      textHash: "sha256:paragraph",
      textSnippet: "Body",
      charRange: { start: 0, end: 4 },
    },
    body: "Needs detail",
    status: "open",
    resolved: false,
    createdAt: "2026-05-05T10:00:00Z",
    updatedAt: "2026-05-05T10:00:00Z",
  };
  const highlights = CommentBlockHighlight.fromComments({
    comments: [comment],
    activeCommentId: null,
    anchorDisplayStateByCommentId: new Map([[comment.id, "exact"]]),
  });
  const indexer = BlockIndexer.create({ blocks: backendBlocks, highlights });

  indexer.next("heading");
  const paragraph = indexer.next("paragraph");

  expect(paragraph.metadata["data-comment-highlight"]).toBe("true");
  expect(paragraph.metadata["data-comment-ids"]).toBe("cmt_1");
  expect(paragraph.rangeHighlights).toHaveLength(1);
  expect(paragraph.commentAnnotations).toEqual([
    { comment, anchorDisplayStatus: "exact", isActive: false },
  ]);
});
