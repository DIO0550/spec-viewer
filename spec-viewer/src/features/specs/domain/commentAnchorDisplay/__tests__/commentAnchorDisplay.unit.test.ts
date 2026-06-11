import { expect, test } from "vitest";

import type { Comment } from "@/features/comments/domain/comment";
import type { CommentAnchorResolution } from "@/features/comments/types/comment";
import { CommentId as CommentIdValue } from "@/features/comments/types/comment";
import { CommentAnchorDisplay } from "@/features/specs/domain/commentAnchorDisplay";

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
      textHash: "sha256:expected",
      textSnippet: "Clarify this task",
      charRange: { start: 0, end: 17 },
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
 * @param blocks - Block descriptors rendered into the root
 * @returns A rendered root element with block metadata attributes.
 */
function createRenderedRoot(
  blocks: readonly Readonly<{
    blockType: string;
    blockIndex: number;
    textHash?: string;
  }>[],
): HTMLElement {
  const root = document.createElement("div");

  for (const block of blocks) {
    const element = document.createElement("p");
    element.dataset.blockType = block.blockType;
    element.dataset.blockIndex = String(block.blockIndex);
    Object.assign(
      element.dataset,
      block.textHash === undefined ? {} : { textHash: block.textHash },
    );
    root.appendChild(element);
  }

  return root;
}

const movedResolution: CommentAnchorResolution = {
  status: "moved",
  reason: "moved_by_hash",
  details: null,
  target: {
    blockType: "paragraph",
    blockIndex: 2,
    textHash: "sha256:moved",
    textSnippet: "Moved",
    sourceRange: null,
    score: 1,
  },
};

test("createStatesはルート未描画で空配列を返す", () => {
  expect(
    CommentAnchorDisplay.createStates({
      comments: [createComment()],
      renderedRoot: null,
    }),
  ).toEqual([]);
});

test("createStatesはハッシュ一致でexactを返す", () => {
  const renderedRoot = createRenderedRoot([
    { blockType: "paragraph", blockIndex: 0, textHash: "sha256:expected" },
  ]);

  expect(
    CommentAnchorDisplay.createStates({
      comments: [createComment()],
      renderedRoot,
    }),
  ).toEqual([{ commentId: commentId("cmt_1"), status: "exact" }]);
});

test("createStatesはハッシュ不一致でstaleを返す", () => {
  const renderedRoot = createRenderedRoot([
    { blockType: "paragraph", blockIndex: 0, textHash: "sha256:changed" },
  ]);

  expect(
    CommentAnchorDisplay.createStates({
      comments: [createComment()],
      renderedRoot,
    }),
  ).toEqual([{ commentId: commentId("cmt_1"), status: "stale" }]);
});

test("createStatesはブロックが見つからない場合orphanedを返す", () => {
  const renderedRoot = createRenderedRoot([
    { blockType: "paragraph", blockIndex: 9 },
  ]);

  expect(
    CommentAnchorDisplay.createStates({
      comments: [createComment()],
      renderedRoot,
    }),
  ).toEqual([{ commentId: commentId("cmt_1"), status: "orphaned" }]);
});

test("createStatesは解決済みターゲットが描画されていればその状態を使う", () => {
  const renderedRoot = createRenderedRoot([
    { blockType: "paragraph", blockIndex: 2 },
  ]);

  expect(
    CommentAnchorDisplay.createStates({
      comments: [createComment({ anchorResolution: movedResolution })],
      renderedRoot,
    }),
  ).toEqual([{ commentId: commentId("cmt_1"), status: "moved" }]);
});

test("createStatesはresolvedの解決結果をexactとして表示する", () => {
  const renderedRoot = createRenderedRoot([
    { blockType: "paragraph", blockIndex: 0 },
  ]);

  expect(
    CommentAnchorDisplay.createStates({
      comments: [
        createComment({
          anchorResolution: {
            status: "resolved",
            reason: "exact_match",
            details: null,
            target: null,
          },
        }),
      ],
      renderedRoot,
    }),
  ).toEqual([{ commentId: commentId("cmt_1"), status: "exact" }]);
});

test("createStatesは解決ターゲットが未描画ならstaleへ落とす", () => {
  const renderedRoot = createRenderedRoot([
    { blockType: "paragraph", blockIndex: 0 },
  ]);

  expect(
    CommentAnchorDisplay.createStates({
      comments: [createComment({ anchorResolution: movedResolution })],
      renderedRoot,
    }),
  ).toEqual([{ commentId: commentId("cmt_1"), status: "stale" }]);
});

test("createStateByCommentIdはコメントIDから状態を引けるMapを作る", () => {
  const lookup = CommentAnchorDisplay.createStateByCommentId([
    { commentId: commentId("cmt_1"), status: "exact" },
    { commentId: commentId("cmt_2"), status: "stale" },
  ]);

  expect(lookup.get(commentId("cmt_2"))).toBe("stale");
  expect(lookup.get(commentId("cmt_3"))).toBeUndefined();
});

test("findBlockForScrollはorphanedな解決結果でnullを返す", () => {
  const renderedRoot = createRenderedRoot([
    { blockType: "paragraph", blockIndex: 0 },
  ]);

  expect(
    CommentAnchorDisplay.findBlockForScroll({
      comment: createComment({
        anchorResolution: {
          status: "orphaned",
          reason: "missing_original_block",
          details: null,
          target: null,
        },
      }),
      renderedRoot,
    }),
  ).toBeNull();
});

test("findBlockForScrollは解決ターゲットのブロックを優先する", () => {
  const renderedRoot = createRenderedRoot([
    { blockType: "paragraph", blockIndex: 0 },
    { blockType: "paragraph", blockIndex: 2 },
  ]);
  const block = CommentAnchorDisplay.findBlockForScroll({
    comment: createComment({ anchorResolution: movedResolution }),
    renderedRoot,
  });

  expect(block?.dataset.blockIndex).toBe("2");
});
