import { expect, test } from "vitest";

import { CommentThreadFormat } from "@/features/comments/domain/commentThreadFormat";
import type { Comment } from "@/features/comments/types/comment";
import { CommentId } from "@/features/comments/types/comment";
import { uiText } from "@/shared/lib/uiText";

const comment: Comment = {
  id: CommentId.fromString("comment-1"),
  anchor: {
    fileKey: "design",
    blockType: "code_block",
    blockIndex: 2,
    textHash: "fnv1a:00000000",
    textSnippet: "snippet",
    charRange: { start: 0, end: 7 },
  },
  body: "body",
  status: "open",
  resolved: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test.each([
  ["paragraph", "Paragraph"],
  ["code_block", "Code Block"],
  ["list_item", "List Item"],
] as const)("blockTypeLabelは%sを読みやすいラベルへ変換する", (blockType, expected) => {
  expect(CommentThreadFormat.blockTypeLabel(blockType)).toBe(expected);
});

test("anchorTitleはブロック種別と1始まりのブロック番号を組み合わせる", () => {
  expect(CommentThreadFormat.anchorTitle(comment)).toBe("Code Block block 3");
});

test("anchorDisplayStatusLabelはexactのときnullを返す", () => {
  expect(CommentThreadFormat.anchorDisplayStatusLabel("exact")).toBeNull();
});

test.each([
  ["moved", uiText.commentThread.anchorMoved],
  ["fuzzy", uiText.commentThread.fuzzyAnchor],
  ["orphaned", uiText.commentThread.anchorOrphaned],
  ["stale", uiText.commentThread.anchorStale],
] as const)("anchorDisplayStatusLabelは%sのラベルを返す", (status, expected) => {
  expect(CommentThreadFormat.anchorDisplayStatusLabel(status)).toBe(expected);
});

test("timestampLabelは不正なISO文字列を生の値のまま返す", () => {
  expect(CommentThreadFormat.timestampLabel("not-a-date")).toBe("not-a-date");
});
