import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const cssFilePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../app/App.css",
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
  expect(buttonRule).toContain("user-select: none;");
  expect(hoverRule).toContain("pointer-events: auto;");
});

test("MarkdownViewerの本文幅は固定上限ではなく利用可能幅に追従する", () => {
  const viewerPaneRule = readCssRule(
    ".app-shell__viewer:has(.markdown-viewer--html)",
  );
  const renderedRule = readCssRule(".markdown-rendered");
  const htmlViewerRule = readCssRule(".markdown-viewer--html");
  const htmlHeaderRule = readCssRule(
    ".markdown-viewer--html .markdown-viewer__header",
  );
  const htmlRule = readCssRule(".html-rendered");
  const targetRule = readCssRule(".markdown-comment-target");
  const annotatedTargetRule = readCssRule(
    '.markdown-comment-target[data-has-comment-annotations="true"]',
  );
  const blockRule = readCssRule(".markdown-comment-target > [data-block-type]");
  const annotationsRule = readCssRule(".markdown-comment-annotations");

  expect(viewerPaneRule).toContain("overflow: hidden;");
  expect(renderedRule).toContain("--markdown-comment-lane-width: 88px;");
  expect(renderedRule).toContain("width: 100%;");
  expect(renderedRule).toContain("max-width: none;");
  expect(htmlViewerRule).toContain("display: flex;");
  expect(htmlViewerRule).toContain("height: 100%;");
  expect(htmlViewerRule).toContain("overflow: hidden;");
  expect(htmlViewerRule).toContain("padding: 0;");
  expect(htmlHeaderRule).toContain("margin-bottom: 0;");
  expect(htmlHeaderRule).toContain("padding: 12px 14px;");
  expect(htmlRule).toContain("display: block;");
  expect(htmlRule).toContain("flex: 1 1 min(72dvh, 860px);");
  expect(htmlRule).toContain("width: 100%;");
  expect(htmlRule).toContain("max-width: 100%;");
  expect(htmlRule).toContain("height: auto;");
  expect(htmlRule).toContain("border-right: 0;");
  expect(htmlRule).toContain("border-bottom: 0;");
  expect(htmlRule).toContain("border-left: 0;");
  expect(htmlRule).toContain("border-radius: 0;");
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

test("MarkdownViewerのヘッダーはスクロール中もリロード操作できる", () => {
  const headerRule = readCssRule(".markdown-viewer__header");

  expect(headerRule).toContain("position: sticky;");
  expect(headerRule).toContain("top: 0;");
  expect(headerRule).toContain("z-index: 12;");
});

test("MarkdownViewerのコメント付き本文は背景色や枠線を変えない", () => {
  const blockRule = readCssRule(
    '.markdown-rendered [data-comment-highlight="true"]',
  );
  const rangeRule = readCssRule(
    '.markdown-rendered [data-comment-highlight-range="true"]',
  );
  const activeStateRule = readCssRule(
    '.markdown-rendered [data-comment-highlight-state="active"]',
  );
  const codeBlockRule = readCssRule(
    '.markdown-rendered pre[data-comment-highlight="true"]',
  );

  expect(blockRule).toContain("scroll-margin: 88px;");
  expect(blockRule).not.toContain("background:");
  expect(blockRule).not.toContain("box-shadow:");
  expect(rangeRule).toContain("color: inherit;");
  expect(rangeRule).not.toContain("background:");
  expect(rangeRule).not.toContain("box-shadow:");
  expect(rangeRule).not.toContain("padding:");
  expect(activeStateRule).toBe("");
  expect(codeBlockRule).toBe("");
});

test("MarkdownViewerのコメントダイアログはhoverの追加ボタンより前面に出る", () => {
  const popoverRule = readCssRule(".add-comment-popover");
  const dialogOpenRule = readCssRule(
    '.markdown-viewer[data-comment-dialog-open="true"] .text-selection-comment-button,\n.markdown-viewer[data-comment-dialog-open="true"] .markdown-block-comment-button,\n.markdown-viewer[data-comment-dialog-open="true"]\n  .markdown-comment-target:hover\n  > .markdown-block-comment-button,\n.markdown-viewer[data-comment-dialog-open="true"]\n  .markdown-comment-target:focus-within\n  > .markdown-block-comment-button,\n.markdown-viewer[data-comment-dialog-open="true"]\n  .markdown-rendered\n  li:hover\n  > .markdown-block-comment-button,\n.markdown-viewer[data-comment-dialog-open="true"]\n  .markdown-rendered\n  li:focus-within\n  > .markdown-block-comment-button',
  );

  expect(popoverRule).toContain("z-index: 50;");
  expect(dialogOpenRule).toContain("opacity: 0;");
  expect(dialogOpenRule).toContain("pointer-events: none;");
});

test("MarkdownViewerの右コメントカードは本文テキスト選択に混ざらない", () => {
  const annotationsRule = readCssRule(".markdown-comment-annotations");

  expect(annotationsRule).toContain("user-select: none;");
});
