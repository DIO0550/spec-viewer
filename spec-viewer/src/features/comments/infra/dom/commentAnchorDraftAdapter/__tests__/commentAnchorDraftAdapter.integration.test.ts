import { afterEach, expect, test } from "vitest";

import {
  decodeCommentAnchorBlock,
  decodeCommentAnchorSelection,
  decodeRenderedBlockSnapshot,
} from "@/features/comments/infra/dom/commentAnchorDraftAdapter";

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

function createRenderedRoot(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

function selectText(textNode: Text, start: number, end: number): Selection {
  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, end);

  const selection = document.getSelection() as Selection;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

test("DOM selectionをDOM-freeなdraft inputへdecodeする", () => {
  const root = createRenderedRoot(
    '<p data-block-type="paragraph" data-block-index="3" data-comment-block-type="paragraph" data-text-hash="sha256:a5dd5c34">Alpha beta gamma</p>',
  );
  const textNode = root.querySelector("p")?.firstChild as Text;

  const decoded = decodeCommentAnchorSelection({
    selection: selectText(textNode, 6, 10),
    renderedRoot: root,
  });

  expect(decoded).toMatchObject({
    block: {
      identity: { blockType: "paragraph", blockIndex: 3 },
      text: "Alpha beta gamma",
      textHash: "sha256:a5dd5c34",
    },
    selectionOffsets: { start: 6, end: 10 },
    selectionBounds: { top: 0, left: 0, width: 0, height: 0 },
  });
});

test("backend block metadataをrendered block mappingより優先する", () => {
  const root = createRenderedRoot(
    [
      '<p data-block-type="paragraph" data-block-index="3" ',
      'data-comment-block-type="heading" data-text-hash="sha256:abc12345">',
      "Alpha beta gamma</p>",
    ].join(""),
  );
  const block = root.querySelector("p") as HTMLElement;

  expect(decodeRenderedBlockSnapshot(block)).toMatchObject({
    ok: true,
    value: {
      identity: { blockType: "heading", blockIndex: 3 },
      textHash: "sha256:abc12345",
    },
  });
});

test.each([
  [
    '<p data-block-type="unsupported" data-block-index="0">Text</p>',
    "unsupported_block_type",
  ],
  [
    '<p data-block-type="paragraph" data-comment-block-type="bad" data-block-index="0">Text</p>',
    "unsupported_block_type",
  ],
  [
    '<p data-block-type="paragraph" data-comment-block-type="paragraph" data-block-index="2oops">Text</p>',
    "invalid_block_index",
  ],
  [
    '<p data-block-type="paragraph" data-comment-block-type="paragraph" data-block-index="-1">Text</p>',
    "invalid_block_index",
  ],
  [
    '<p data-block-type="paragraph" data-comment-block-type="paragraph" data-block-index="0" data-text-hash="   ">Text</p>',
    "invalid_text_hash",
  ],
  [
    '<p data-block-type="paragraph" data-block-index="0" data-comment-block-type="paragraph">Text</p>',
    "invalid_text_hash",
  ],
  [
    '<p data-block-type="paragraph" data-block-index="0" data-comment-block-type="paragraph" data-text-hash="fnv1a:12345678">Text</p>',
    "invalid_text_hash",
  ],
] as const)("malformed datasetをtyped errorで拒否する", (html, reason) => {
  const root = createRenderedRoot(html);
  const block = root.querySelector("p") as HTMLElement;

  expect(decodeRenderedBlockSnapshot(block)).toMatchObject({
    ok: false,
    error: { reason },
  });
});

test("コメントUIのtextをsnapshotとselection offsetから除外する", () => {
  const root = createRenderedRoot(
    [
      '<p data-block-type="paragraph" data-block-index="0" data-comment-block-type="paragraph" data-text-hash="sha256:a5dd5c34">',
      '<button class="markdown-block-comment-button">コメント追加</button>',
      "Alpha <strong>beta</strong> gamma",
      '<aside class="markdown-comment-annotations">annotation</aside>',
      "</p>",
    ].join(""),
  );
  const textNode = root.querySelector("strong")?.firstChild as Text;

  const decoded = decodeCommentAnchorSelection({
    selection: selectText(textNode, 0, 4),
    renderedRoot: root,
  });

  expect(decoded).toMatchObject({
    block: { text: "Alpha beta gamma" },
    selectionOffsets: { start: 6, end: 10 },
  });
});

test("block comment用のDOM-free inputはコメントUIを除くblock全体を選択する", () => {
  const root = createRenderedRoot(
    [
      '<p data-block-type="paragraph" data-block-index="4" data-comment-block-type="paragraph" data-text-hash="sha256:a5dd5c34">',
      '<button class="markdown-block-comment-button">コメント追加</button>',
      "Whole block text",
      "</p>",
    ].join(""),
  );
  const block = root.querySelector("p") as HTMLElement;

  const decoded = decodeCommentAnchorBlock(block);

  expect(decoded).toMatchObject({
    block: {
      identity: { blockType: "paragraph", blockIndex: 4 },
      text: "Whole block text",
    },
    selectionOffsets: { start: 0, end: 16 },
    selectionBounds: { top: 0, left: 0, width: 0, height: 0 },
  });
});

test("backend metadataが欠けたrendered blockからselection draftを作らない", () => {
  const root = createRenderedRoot(
    '<p data-block-type="paragraph" data-block-index="0">Text</p>',
  );
  const textNode = root.querySelector("p")?.firstChild as Text;

  expect(
    decodeCommentAnchorSelection({
      selection: selectText(textNode, 0, 4),
      renderedRoot: root,
    }),
  ).toBeNull();
});
