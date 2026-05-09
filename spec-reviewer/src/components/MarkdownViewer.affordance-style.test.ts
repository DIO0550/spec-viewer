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

test("MarkdownViewerのブロックコメントボタンは右コメントレーン左端のhover導線を保つ", () => {
  const buttonRule = readCssRule(".markdown-block-comment-button");
  const hoverRule = readCssRule(
    ".markdown-comment-target:hover > .markdown-block-comment-button,\n.markdown-comment-target:focus-within > .markdown-block-comment-button,\n.markdown-rendered li:hover > .markdown-block-comment-button,\n.markdown-rendered li:focus-within > .markdown-block-comment-button",
  );

  expect(buttonRule).toContain(
    "right: calc(\n    var(--markdown-comment-lane-width) -\n    var(--markdown-comment-add-button-width)\n  );",
  );
  expect(buttonRule).toContain("left: auto;");
  expect(buttonRule).toContain("transform: none;");
  expect(buttonRule).toContain("pointer-events: none;");
  expect(hoverRule).toContain("pointer-events: auto;");
});

test("MarkdownViewerの本文幅は固定上限ではなく利用可能幅に追従する", () => {
  const renderedRule = readCssRule(".markdown-rendered");
  const targetRule = readCssRule(".markdown-comment-target");
  const annotatedTargetRule = readCssRule(
    '.markdown-comment-target[data-has-comment-annotations="true"]',
  );
  const blockRule = readCssRule(".markdown-comment-target > [data-block-type]");
  const annotationsRule = readCssRule(".markdown-comment-annotations");

  expect(renderedRule).toContain("--markdown-comment-lane-width: 88px;");
  expect(renderedRule).toContain("width: 100%;");
  expect(renderedRule).toContain("max-width: none;");
  expect(targetRule).toContain(
    "grid-template-columns: minmax(0, 1fr) var(--markdown-comment-lane-width);",
  );
  expect(annotatedTargetRule).toContain(
    "grid-template-columns: minmax(0, 1fr) var(--markdown-comment-lane-width);",
  );
  expect(blockRule).toContain("min-width: 0;");
  expect(blockRule).toContain("max-width: none;");
  expect(annotationsRule).toContain("grid-column: 2;");
  expect(annotationsRule).toContain("justify-self: end;");
});
