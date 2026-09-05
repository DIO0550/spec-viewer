import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const cssFilePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../styles/editor-viewer.css",
);

/**
 * Reads one Editor Viewer CSS declaration body.
 *
 * @param selector - Exact selector whose declaration is required.
 * @returns The matching declaration body, or an empty string when absent.
 */
function readCssRule(selector: string): string {
  const css = readFileSync(cssFilePath, "utf8");
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selectorPattern = escapedSelector.replace(/\s+/g, "\\s+");
  const match = css.match(new RegExp(`${selectorPattern}\\s*{(?<body>[^}]*)}`));

  return match?.groups?.body ?? "";
}

test("Editor windowing surfaceは後続base ruleより高いmodifier scopeを持つ", () => {
  const viewerRule = readCssRule(
    ".current-file-viewer.current-file-viewer--editor",
  );
  const rowRule = readCssRule(
    '.current-file-viewer--editor .current-file-viewer__row[data-row-kind="current-line"]',
  );
  const commentsRowRule = readCssRule(
    '.current-file-viewer--editor.current-file-viewer--with-comments .current-file-viewer__row[data-row-kind="current-line"]',
  );

  expect(viewerRule).toContain("display: flex;");
  expect(viewerRule).toContain("overflow: hidden;");
  expect(rowRule).toContain("grid-template-columns: 4px 52px max-content;");
  expect(commentsRowRule).toContain(
    "grid-template-columns: 56px 4px 52px max-content;",
  );
});

test("Editorは最終行を先頭まで送れる末尾余白を持つ", () => {
  const scrollSurfaceRule = readCssRule(".current-file-viewer__scroll-surface");
  const endSpacerRule = readCssRule(".current-file-viewer__end-spacer");

  expect(endSpacerRule).toContain(
    "height: calc(100% - var(--viewer-line-height, 26px));",
  );
  expect(endSpacerRule).toContain(
    "min-height: calc(100% - var(--viewer-line-height, 26px));",
  );
  expect(scrollSurfaceRule).toContain("overflow-anchor: none;");
});

test("Editorコード行は折り返さず横スクロール可能な幅を持つ", () => {
  const codeRule = readCssRule(".current-file-viewer__code");

  expect(codeRule).toContain("display: block;");
  expect(codeRule).toContain("min-width: max-content;");
  expect(codeRule).toContain("overflow: visible;");
  expect(codeRule).toContain("overflow-wrap: normal;");
  expect(codeRule).toContain("word-break: normal;");
  expect(codeRule).toContain("white-space: pre;");
});

test("Editorの変更表示はVS Code風の左端マーカーだけを着色する", () => {
  const editorRule = readCssRule(
    ".current-file-viewer.current-file-viewer--editor",
  );
  const rowRule = readCssRule(
    '.current-file-viewer__row[data-row-kind="current-line"]',
  );
  const addedRule = readCssRule(
    '.current-file-viewer__row[data-change-kind="added"]',
  );
  const modifiedRule = readCssRule(
    '.current-file-viewer__row[data-change-kind="modified"]',
  );
  const addedGutterRule = readCssRule(
    '.current-file-viewer__row[data-change-kind="added"] .current-file-viewer__gutter',
  );
  const codeRule = readCssRule(".current-file-viewer__code");

  expect(editorRule).toContain("background: var(--editor-background);");
  expect(rowRule).toContain("background: var(--editor-background);");
  expect(addedRule).toContain("background: var(--editor-background);");
  expect(modifiedRule).toContain("background: var(--editor-background);");
  expect(addedGutterRule).toContain("background: var(--editor-added-marker);");
  expect(codeRule).toContain("background: var(--editor-background);");
});
