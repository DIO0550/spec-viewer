import { expect, test } from "vitest";
import {
  createRenderedBlockKey,
  readRenderedBlockModel,
} from "../renderedDocument";

test("描画種別と backend block index から stable key を作る", () => {
  expect(createRenderedBlockKey("heading", 4)).toBe("heading:4");
});

test("DOM metadata を DOM 非依存の rendered block model に復元する", () => {
  const element = document.createElement("p");
  element.dataset.blockType = "paragraph";
  element.dataset.blockIndex = "7";
  element.dataset.renderedBlockType = "block_quote";
  element.dataset.textHash = "sha256:example";
  element.dataset.textSnippet = "quoted context";
  element.dataset.sourceStartByteOffset = "12";
  element.dataset.sourceEndByteOffset = "42";

  expect(readRenderedBlockModel(element)).toEqual({
    key: "paragraph:7",
    renderedType: "paragraph",
    metadata: {
      blockType: "block_quote",
      blockIndex: 7,
      textHash: "sha256:example",
      textSnippet: "quoted context",
      sourceRange: {
        startByteOffset: 12,
        endByteOffset: 42,
      },
    },
  });
});

test("source range 属性が両方ない metadata は null range として復元する", () => {
  const element = document.createElement("code");
  element.dataset.blockType = "code";
  element.dataset.blockIndex = "0";
  element.dataset.renderedBlockType = "code_block";
  element.dataset.textHash = "sha256:code";
  element.dataset.textSnippet = "const enabled = true";

  expect(readRenderedBlockModel(element)?.metadata.sourceRange).toBeNull();
});

test.each([
  ["未知の描画種別", { blockType: "unknown", blockIndex: "0" }],
  ["負の block index", { blockType: "paragraph", blockIndex: "-1" }],
  ["小数の block index", { blockType: "paragraph", blockIndex: "1.5" }],
  ["未知の backend block type", { renderedBlockType: "unknown" }],
  ["片側だけの source range", { sourceStartByteOffset: "1" }],
] as const)("%s の metadata は拒否する", (_label, overrides) => {
  const element = document.createElement("p");
  element.dataset.blockType = "paragraph";
  element.dataset.blockIndex = "1";
  element.dataset.renderedBlockType = "paragraph";
  element.dataset.textHash = "sha256:paragraph";
  element.dataset.textSnippet = "paragraph";

  Object.assign(element.dataset, overrides);

  expect(readRenderedBlockModel(element)).toBeNull();
});
