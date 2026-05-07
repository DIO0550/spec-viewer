import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const cssFilePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../App.css",
);

/** @returns The declaration body for one CSS selector in App.css. */
function readCssRule(selector: string): string {
  const css = readFileSync(cssFilePath, "utf8");
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*{(?<body>[^}]*)}`));

  return match?.groups?.body ?? "";
}

test("MarkdownViewerのブロックコメントボタンは右端配置のhover導線を保つ", () => {
  const buttonRule = readCssRule(".markdown-block-comment-button");
  const hoverRule = readCssRule(
    ".markdown-comment-target:hover > .markdown-block-comment-button,\n.markdown-comment-target:focus-within > .markdown-block-comment-button,\n.markdown-rendered li:hover > .markdown-block-comment-button,\n.markdown-rendered li:focus-within > .markdown-block-comment-button",
  );

  expect(buttonRule).toContain("right: 0.15rem;");
  expect(buttonRule).toContain("left: auto;");
  expect(buttonRule).toContain("transform: none;");
  expect(buttonRule).toContain("pointer-events: none;");
  expect(hoverRule).toContain("pointer-events: auto;");
});
