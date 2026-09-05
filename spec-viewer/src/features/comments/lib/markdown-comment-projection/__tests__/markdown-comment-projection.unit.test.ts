import { expect, test } from "vitest";
import type { Comment } from "@/features/comments/domain/comment";
import type {
  CommentAnchorResolution,
  CommentBlockType,
} from "@/features/comments/domain/commentAnchor";
import { CommentId } from "@/features/comments/domain/commentId";
import {
  createCommentAnchorDisplayStates,
  createMarkdownCommentProjections,
  findCommentScrollTarget,
} from "@/features/comments/lib/markdown-comment-projection";

const commentId = CommentId.fromString;
const resolutionReasonByStatus = {
  resolved: "exact_match",
  moved: "moved_by_hash",
  fuzzy: "fuzzy_match",
  orphaned: "deleted_text",
} as const satisfies Readonly<
  Record<CommentAnchorResolution["status"], CommentAnchorResolution["reason"]>
>;

function createComment({
  id = "cmt_1",
  blockType = "paragraph",
  blockIndex = 0,
  status = "open",
  anchorResolution = null,
  start = 0,
  end = 9,
}: Readonly<{
  id?: string;
  blockType?: CommentBlockType;
  blockIndex?: number;
  status?: Comment["status"];
  anchorResolution?: CommentAnchorResolution | null;
  start?: number;
  end?: number;
}> = {}): Comment {
  return {
    id: commentId(id),
    anchor: {
      fileKey: "requirements",
      blockType,
      blockIndex,
      textHash: `hash:${blockIndex}`,
      textSnippet: "paragraph",
      charRange: { start, end },
    },
    body: `${id} body`,
    status,
    anchorResolution,
    createdAt: "2026-09-03T00:00:00Z",
    updatedAt: "2026-09-03T00:00:00Z",
  };
}

function createResolution(
  status: "resolved" | "moved" | "fuzzy" | "orphaned",
  blockIndex = 0,
): CommentAnchorResolution {
  return {
    status,
    reason: resolutionReasonByStatus[status],
    details: null,
    target:
      status === "orphaned"
        ? null
        : {
            blockType: "paragraph",
            blockIndex,
            textHash: `hash:${blockIndex}`,
            textSnippet: "paragraph",
            sourceRange: null,
            score: 1,
          },
  };
}

function appendRenderedBlock(
  root: HTMLElement,
  blockIndex: number,
  textHash = `hash:${blockIndex}`,
): HTMLElement {
  const block = document.createElement("p");
  block.dataset.blockType = "paragraph";
  block.dataset.blockIndex = String(blockIndex);
  block.dataset.renderedBlockType = "paragraph";
  block.dataset.textHash = textHash;
  block.dataset.textSnippet = "paragraph";
  root.append(block);
  return block;
}

test.each([
  ["exact", null, "open"],
  ["moved", createResolution("moved"), "moved"],
  ["fuzzy", createResolution("fuzzy"), "fuzzy"],
  ["stale", null, "stale"],
] as const)("%s anchor は %s block projection になる", (anchorStatus, resolution, expected) => {
  const comment = createComment({ anchorResolution: resolution });
  const projections = createMarkdownCommentProjections({
    comments: [comment],
    activeCommentId: null,
    anchorDisplayStates: [{ commentId: comment.id, status: anchorStatus }],
  });

  expect(projections.get("paragraph:0")?.state).toBe(expected);
});

test("active comment は stale より優先して block と range を active にする", () => {
  const active = createComment({ id: "cmt_active", start: 1, end: 5 });
  const stale = createComment({ id: "cmt_stale" });
  const projection = createMarkdownCommentProjections({
    comments: [stale, active],
    activeCommentId: active.id,
    anchorDisplayStates: [
      { commentId: stale.id, status: "stale" },
      { commentId: active.id, status: "exact" },
    ],
  }).get("paragraph:0");

  expect(projection?.state).toBe("active");
  expect(projection?.selectedCommentId).toBe(active.id);
  expect(projection?.ranges).toEqual([
    { commentId: active.id, start: 1, end: 5, state: "active" },
  ]);
});

test.each([
  ["空範囲", createComment({ start: 3, end: 3 })],
  ["code block", createComment({ blockType: "code_block" })],
] as const)("%s には range decoration を作らない", (_label, comment) => {
  const projection = createMarkdownCommentProjections({
    comments: [comment],
    activeCommentId: null,
    anchorDisplayStates: [{ commentId: comment.id, status: "exact" }],
  })
    .values()
    .next().value;

  expect(projection?.ranges).toEqual([]);
});

test.each([
  [
    "orphaned",
    createComment({ anchorResolution: createResolution("orphaned") }),
  ],
  ["resolved", createComment({ status: "resolved" })],
] as const)("%s comment は本文 projection から除外する", (_label, comment) => {
  expect(
    createMarkdownCommentProjections({
      comments: [comment],
      activeCommentId: null,
      anchorDisplayStates: [{ commentId: comment.id, status: "orphaned" }],
    }).size,
  ).toBe(0);
});

test("DOM metadata と backend resolution から anchor display state を求める", () => {
  const root = document.createElement("div");
  appendRenderedBlock(root, 0);
  appendRenderedBlock(root, 1, "changed");
  appendRenderedBlock(root, 3);
  const exact = createComment({ id: "cmt_exact" });
  const stale = createComment({ id: "cmt_stale", blockIndex: 1 });
  const moved = createComment({
    id: "cmt_moved",
    blockIndex: 2,
    anchorResolution: createResolution("moved", 3),
  });
  const orphaned = createComment({
    id: "cmt_orphaned",
    anchorResolution: createResolution("orphaned"),
  });

  expect(
    createCommentAnchorDisplayStates({
      comments: [exact, stale, moved, orphaned],
      renderedRoot: root,
    }),
  ).toEqual([
    { commentId: exact.id, status: "exact" },
    { commentId: stale.id, status: "stale" },
    { commentId: moved.id, status: "moved" },
    { commentId: orphaned.id, status: "orphaned" },
  ]);
});

test("scroll target は original anchor より backend resolution target を優先する", () => {
  const root = document.createElement("div");
  appendRenderedBlock(root, 0);
  const target = appendRenderedBlock(root, 4);
  const comment = createComment({
    anchorResolution: createResolution("moved", 4),
  });

  expect(findCommentScrollTarget({ comment, renderedRoot: root })).toBe(target);
});
