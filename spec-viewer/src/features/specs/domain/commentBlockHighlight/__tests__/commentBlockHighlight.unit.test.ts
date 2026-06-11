import { expect, test } from "vitest";

import type { Comment } from "@/features/comments/domain/comment";
import type {
  CommentAnchorDisplayStatus,
  CommentId,
} from "@/features/comments/types/comment";
import { CommentId as CommentIdValue } from "@/features/comments/types/comment";
import { CommentBlockHighlight } from "@/features/specs/domain/commentBlockHighlight";
import type { BlockMetadata } from "@/features/specs/domain/markdownBlock";

const commentId = CommentIdValue.fromString;

/**
 * @param overrides - Comment fields to override
 * @returns A comment fixture anchored to paragraph 0.
 */
function createComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: commentId("cmt_1"),
    anchor: {
      fileKey: "tasks",
      blockType: "paragraph",
      blockIndex: 0,
      textHash: "sha256:first",
      textSnippet: "Clarify this task",
      charRange: { start: 2, end: 9 },
    },
    body: "Clarify this task",
    status: "open",
    resolved: false,
    createdAt: "2026-05-05T10:00:00Z",
    updatedAt: "2026-05-05T10:00:00Z",
    ...overrides,
  };
}

/**
 * @param entries - Comment id and display status pairs
 * @returns A display status lookup for highlight creation.
 */
function createStateLookup(
  entries: readonly (readonly [CommentId, CommentAnchorDisplayStatus])[],
): ReadonlyMap<CommentId, CommentAnchorDisplayStatus> {
  return new Map(entries);
}

test("fromCommentsはアンカーのブロックごとにコメントを集約する", () => {
  const first = createComment();
  const second = createComment({
    id: commentId("cmt_2"),
    anchor: { ...first.anchor, blockIndex: 2, charRange: { start: 0, end: 0 } },
  });
  const highlights = CommentBlockHighlight.fromComments({
    comments: [first, second],
    activeCommentId: null,
    anchorDisplayStateByCommentId: createStateLookup([]),
  });

  expect(highlights.size).toBe(2);
  expect(highlights.get("paragraph:0")?.commentIds).toEqual([first.id]);
  expect(highlights.get("paragraph:2")?.commentIds).toEqual([second.id]);
});

test("fromCommentsはorphanedな解決結果のコメントを対象から除外する", () => {
  const orphaned = createComment({
    anchorResolution: {
      status: "orphaned",
      reason: "missing_original_block",
      details: null,
      target: null,
    },
  });
  const highlights = CommentBlockHighlight.fromComments({
    comments: [orphaned],
    activeCommentId: null,
    anchorDisplayStateByCommentId: createStateLookup([]),
  });

  expect(highlights.size).toBe(0);
});

test("fromCommentsは解決ターゲットがあればそのブロックへ割り当てる", () => {
  const moved = createComment({
    anchorResolution: {
      status: "moved",
      reason: "moved_by_hash",
      details: null,
      target: {
        blockType: "paragraph",
        blockIndex: 5,
        textHash: "sha256:moved",
        textSnippet: "Moved",
        sourceRange: null,
        score: 1,
      },
    },
  });
  const highlights = CommentBlockHighlight.fromComments({
    comments: [moved],
    activeCommentId: null,
    anchorDisplayStateByCommentId: createStateLookup([]),
  });

  expect(Array.from(highlights.keys())).toEqual(["paragraph:5"]);
});

test.each([
  ["active", createComment(), "cmt_1", []],
  ["stale", createComment(), null, [["cmt_1", "stale"]]],
  ["moved", createComment(), null, [["cmt_1", "moved"]]],
  ["fuzzy", createComment(), null, [["cmt_1", "fuzzy"]]],
  ["open", createComment(), null, []],
  ["resolved", createComment({ status: "resolved", resolved: true }), null, []],
] as const)("fromCommentsはハイライト状態%sを選択する", (expectedState, comment, activeId, stateEntries) => {
  const highlights = CommentBlockHighlight.fromComments({
    comments: [comment],
    activeCommentId: activeId === null ? null : commentId(activeId),
    anchorDisplayStateByCommentId: createStateLookup(
      stateEntries.map(([id, status]) => [commentId(id), status] as const),
    ),
  });

  expect(highlights.get("paragraph:0")?.state).toBe(expectedState);
});

test("fromCommentsはexactアンカーの文字範囲をrangeハイライトにする", () => {
  const comment = createComment();
  const highlights = CommentBlockHighlight.fromComments({
    comments: [comment],
    activeCommentId: null,
    anchorDisplayStateByCommentId: createStateLookup([[comment.id, "exact"]]),
  });

  expect(highlights.get("paragraph:0")?.rangeHighlights).toEqual([
    {
      commentIds: [comment.id],
      selectCommentId: comment.id,
      state: "open",
      start: 2,
      end: 9,
    },
  ]);
});

test.each([
  [
    "exact以外の表示状態",
    createComment(),
    createStateLookup([[commentId("cmt_1"), "stale"]]),
  ],
  [
    "コードブロックのアンカー",
    createComment({
      anchor: {
        fileKey: "tasks",
        blockType: "code_block",
        blockIndex: 0,
        textHash: "sha256:first",
        textSnippet: "code",
        charRange: { start: 0, end: 4 },
      },
    }),
    createStateLookup([[commentId("cmt_1"), "exact"]]),
  ],
  [
    "空の文字範囲",
    createComment({
      anchor: {
        fileKey: "tasks",
        blockType: "paragraph",
        blockIndex: 0,
        textHash: "sha256:first",
        textSnippet: "Clarify this task",
        charRange: { start: 4, end: 4 },
      },
    }),
    createStateLookup([[commentId("cmt_1"), "exact"]]),
  ],
])("fromCommentsは%sでrangeハイライトを作らない", (_label, comment, lookup) => {
  const highlights = CommentBlockHighlight.fromComments({
    comments: [comment],
    activeCommentId: null,
    anchorDisplayStateByCommentId: lookup,
  });
  const [highlight] = Array.from(highlights.values());

  expect(highlight.rangeHighlights).toEqual([]);
});

test("fromCommentsは選択コメントを未解決優先で決める", () => {
  const resolved = createComment({
    id: commentId("cmt_resolved"),
    status: "resolved",
    resolved: true,
  });
  const open = createComment({ id: commentId("cmt_open") });
  const highlights = CommentBlockHighlight.fromComments({
    comments: [resolved, open],
    activeCommentId: null,
    anchorDisplayStateByCommentId: createStateLookup([]),
  });

  expect(highlights.get("paragraph:0")?.selectCommentId).toBe(open.id);
});

test("applyToMetadataはハイライト属性とアクセシブルラベルを付与する", () => {
  const comment = createComment();
  const metadata: BlockMetadata = {
    "data-block-type": "paragraph",
    "data-block-index": 0,
  };
  const highlights = CommentBlockHighlight.fromComments({
    comments: [comment],
    activeCommentId: null,
    anchorDisplayStateByCommentId: createStateLookup([]),
  });
  const result = CommentBlockHighlight.applyToMetadata({
    metadata,
    highlight: highlights.get("paragraph:0"),
  });

  expect(result["data-comment-highlight"]).toBe("true");
  expect(result["data-comment-highlight-count"]).toBe(1);
  expect(result["data-comment-highlight-mode"]).toBe("block");
  expect(result["data-comment-highlight-state"]).toBe("open");
  expect(result["data-comment-ids"]).toBe("cmt_1");
  expect(result["aria-label"]).toBe("1件のコメントがあるMarkdownブロック");
});

test("applyToMetadataはハイライトが無ければ元のメタデータを返す", () => {
  const metadata: BlockMetadata = {
    "data-block-type": "paragraph",
    "data-block-index": 0,
  };

  expect(
    CommentBlockHighlight.applyToMetadata({ metadata, highlight: undefined }),
  ).toBe(metadata);
});

test("createAriaLabelは複数コメントの件数を表現する", () => {
  expect(
    CommentBlockHighlight.createAriaLabel({
      commentIds: [commentId("cmt_1"), commentId("cmt_2")],
    }),
  ).toBe("2件のコメントがあるMarkdownブロック");
});
