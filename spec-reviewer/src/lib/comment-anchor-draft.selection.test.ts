import { afterEach, expect, test } from "vitest";

import {
  createCommentAnchorDraftFromSelection,
  createTextHash,
  createTextSnippet,
} from "./comment-anchor-draft";

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

  const selection = document.getSelection();
  expect(selection).not.toBeNull();

  const readySelection = selection as Selection;
  readySelection.removeAllRanges();
  readySelection.addRange(range);

  return readySelection;
}

test("Markdownブロック内の選択からコメントアンカードラフトを作成する", () => {
  const root = createRenderedRoot(
    '<p data-block-type="paragraph" data-block-index="3">Alpha beta gamma</p>',
  );
  const paragraph = root.querySelector("p");
  const textNode = paragraph?.firstChild;
  expect(textNode).toBeInstanceOf(Text);

  const selection = selectText(textNode as Text, 6, 10);
  const draft = createCommentAnchorDraftFromSelection({
    selection,
    renderedRoot: root,
    fileKey: "tasks",
  });

  expect(draft?.anchor).toEqual({
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 3,
    textHash: createTextHash("Alpha beta gamma"),
    textSnippet: "beta",
    charRange: {
      start: 6,
      end: 10,
    },
  });
});

test.each([
  ["list-item", "list_item"],
  ["code", "code_block"],
  ["heading", "heading"],
  ["table", "table"],
] as const)("Markdownブロック種別%sをコメントブロック種別%sに変換する", (markdownBlockType, commentBlockType) => {
  const root = createRenderedRoot(
    `<p data-block-type="${markdownBlockType}" data-block-index="0">Selected text</p>`,
  );
  const textNode = root.querySelector("p")?.firstChild;
  expect(textNode).toBeInstanceOf(Text);

  const selection = selectText(textNode as Text, 0, 8);
  const draft = createCommentAnchorDraftFromSelection({
    selection,
    renderedRoot: root,
    fileKey: "impl",
  });

  expect(draft?.anchor.blockType).toBe(commentBlockType);
});

test("Markdown外の選択はコメントアンカードラフトにしない", () => {
  const root = createRenderedRoot(
    '<p data-block-type="paragraph" data-block-index="0">Inside text</p>',
  );
  const outside = document.createElement("p");
  outside.textContent = "Outside text";
  document.body.append(outside);
  const textNode = outside.firstChild;
  expect(textNode).toBeInstanceOf(Text);

  const selection = selectText(textNode as Text, 0, 7);
  const draft = createCommentAnchorDraftFromSelection({
    selection,
    renderedRoot: root,
    fileKey: "tasks",
  });

  expect(draft).toBeNull();
});

test("複数Markdownブロックにまたがる選択はコメントアンカードラフトにしない", () => {
  const root = createRenderedRoot(
    [
      '<p data-block-type="paragraph" data-block-index="0">First text</p>',
      '<p data-block-type="paragraph" data-block-index="1">Second text</p>',
    ].join(""),
  );
  const firstTextNode = root.querySelectorAll("p")[0]?.firstChild;
  const secondTextNode = root.querySelectorAll("p")[1]?.firstChild;
  expect(firstTextNode).toBeInstanceOf(Text);
  expect(secondTextNode).toBeInstanceOf(Text);

  const range = document.createRange();
  range.setStart(firstTextNode as Text, 0);
  range.setEnd(secondTextNode as Text, 6);
  const selection = document.getSelection();
  expect(selection).not.toBeNull();

  const readySelection = selection as Selection;
  readySelection.removeAllRanges();
  readySelection.addRange(range);

  const draft = createCommentAnchorDraftFromSelection({
    selection: readySelection,
    renderedRoot: root,
    fileKey: "tasks",
  });

  expect(draft).toBeNull();
});

test("選択スニペットは空白を正規化して上限長で切り詰める", () => {
  const longText = `${"word ".repeat(40)}tail`;

  expect(createTextSnippet("  alpha\n beta\tgamma  ")).toBe("alpha beta gamma");
  expect(createTextSnippet("   ")).toBeNull();
  expect(createTextSnippet(longText)?.length).toBe(160);
});
