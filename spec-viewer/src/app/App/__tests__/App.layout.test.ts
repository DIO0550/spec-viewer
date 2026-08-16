import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const appCssFilePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../App.css",
);

const diffViewerCssFilePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../styles/diff-viewer.css",
);
const repositoryDiffCssFilePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../styles/repository-diff-workspace.css",
);

/** @returns The declaration body for one CSS selector in a stylesheet. */
function readCssRule(filePath: string, selector: string): string {
  const css = readFileSync(filePath, "utf8");
  const selectorPattern = selector
    .trim()
    .split(/\s+/)
    .map((selectorPart) => selectorPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const match = css.match(new RegExp(`${selectorPattern}\\s*{(?<body>[^}]*)}`));

  return match?.groups?.body ?? "";
}

test("Specs表示はModeNavigationと本文をそれぞれのスクロール領域に収める", () => {
  const contentRule = readCssRule(appCssFilePath, ".app-shell__content");
  const specsRule = readCssRule(appCssFilePath, ".specs-workspace");
  const documentRule = readCssRule(
    appCssFilePath,
    ".specs-workspace__document",
  );
  const specTabsRule = readCssRule(appCssFilePath, ".spec-tabs");
  const initialFileRule = readCssRule(
    appCssFilePath,
    ".specs-workspace__document > .empty-state--inline",
  );
  const viewerRule = readCssRule(appCssFilePath, ".specs-workspace__viewer");
  const tabsRule = readCssRule(
    appCssFilePath,
    ".specs-workspace__document > .spec-tabs",
  );
  const tabRule = readCssRule(
    appCssFilePath,
    ".specs-workspace__document > .spec-tabs .spec-tabs__tab",
  );
  const markdownRule = readCssRule(
    appCssFilePath,
    ".specs-workspace__viewer > .markdown-viewer",
  );
  const statusRule = readCssRule(
    appCssFilePath,
    ".specs-workspace__viewer > .markdown-viewer__status",
  );
  const centerRule = readCssRule(
    appCssFilePath,
    ".specs-workspace__viewer > .markdown-viewer--center",
  );

  expect(contentRule).toContain("display: flex;");
  expect(contentRule).toContain("overflow: hidden;");
  expect(specsRule).toContain("display: flex;");
  expect(specsRule).toContain("flex-direction: column;");
  expect(documentRule).toContain("grid-template-rows: 38px minmax(0, 1fr);");
  expect(initialFileRule).toContain("height: 38px;");
  expect(initialFileRule).toContain("overflow: hidden;");
  expect(specTabsRule).toContain("overflow-x: auto;");
  expect(specTabsRule).toContain("overflow-y: hidden;");
  expect(specTabsRule).toContain("scrollbar-width: none;");
  expect(specTabsRule).toContain("scrollbar-gutter: auto;");
  expect(tabsRule).toContain("min-height: 38px;");
  expect(tabRule).toContain("min-height: 38px;");
  expect(viewerRule).toContain("display: flex;");
  expect(viewerRule).toContain("overflow: hidden;");
  expect(statusRule).toContain("flex: 1 1 0;");
  expect(statusRule).toContain("height: 100%;");
  expect(centerRule).toContain("flex: 1 1 0;");
  expect(centerRule).toContain("height: 100%;");
  expect(centerRule).toContain("overflow: hidden;");
  expect(markdownRule).toContain("height: 100%;");
  expect(markdownRule).toContain("overflow: auto;");
});

test("SpecTreeのアーカイブ操作はSpec行の同じ行に収まる", () => {
  const itemRule = readCssRule(appCssFilePath, ".spec-tree__item");

  expect(itemRule).toContain(
    "grid-template-columns: 14px auto minmax(0, 1fr) auto auto auto;",
  );
});

test("Diff表示はファイルタブとプレビューを縦方向に積む", () => {
  const workspaceRule = readCssRule(appCssFilePath, ".diff-workspace");
  const contentRule = readCssRule(appCssFilePath, ".diff-workspace__content");
  const previewRule = readCssRule(appCssFilePath, ".diff-preview");

  expect(workspaceRule).toContain("display: flex;");
  expect(workspaceRule).toContain("flex-direction: column;");
  expect(contentRule).toContain("display: flex;");
  expect(contentRule).toContain("overflow: hidden;");
  expect(previewRule).toContain("display: flex;");
  expect(previewRule).toContain("flex-direction: column;");
});

test("DiffはGitHub風のファイル枠と行番号付き配色を持つ", () => {
  const panelRule = readCssRule(
    repositoryDiffCssFilePath,
    ".repository-diff-panel",
  );
  const fileHeaderRule = readCssRule(
    repositoryDiffCssFilePath,
    ".repository-diff-file-header",
  );
  const fileTabsRule = readCssRule(
    repositoryDiffCssFilePath,
    ".repository-file-tabs",
  );
  const fileTablistRule = readCssRule(
    repositoryDiffCssFilePath,
    ".repository-file-tabs__tablist",
  );
  const diffViewerRule = readCssRule(diffViewerCssFilePath, ".diff-viewer");
  const addedLineNumberRule = readCssRule(
    diffViewerCssFilePath,
    '.diff-viewer__cell[data-kind="added"] .diff-viewer__line-number',
  );
  const removedLineNumberRule = readCssRule(
    diffViewerCssFilePath,
    '.diff-viewer__cell[data-kind="removed"] .diff-viewer__line-number',
  );

  expect(panelRule).toContain("overflow: hidden;");
  expect(panelRule).toContain("border-radius: 6px;");
  expect(fileTabsRule).toContain("height: 38px;");
  expect(fileTablistRule).toContain("overflow-x: auto;");
  expect(fileTablistRule).toContain("overflow-y: hidden;");
  expect(fileTablistRule).toContain("scrollbar-width: none;");
  expect(fileHeaderRule).toContain("min-height: 44px;");
  expect(fileHeaderRule).toContain("background: var(--diff-file-header-bg);");
  expect(diffViewerRule).toContain("overflow: hidden;");
  expect(addedLineNumberRule).toContain(
    "background: var(--diff-added-emphasis);",
  );
  expect(removedLineNumberRule).toContain(
    "background: var(--diff-removed-emphasis);",
  );
});

test("Diffコードは行番号と同じ行を保ち、長い行を横スクロールする", () => {
  const scrollSurfaceRule = readCssRule(
    diffViewerCssFilePath,
    ".diff-viewer__scroll-surface",
  );
  const cellRule = readCssRule(diffViewerCssFilePath, ".diff-viewer__cell");
  const inlineCellRule = readCssRule(
    diffViewerCssFilePath,
    ".diff-viewer__row--inline .diff-viewer__cell",
  );
  const commentLaneRule = readCssRule(
    diffViewerCssFilePath,
    ".diff-viewer__comment-lane",
  );
  const codeRule = readCssRule(
    diffViewerCssFilePath,
    ".diff-viewer__cell code",
  );

  expect(scrollSurfaceRule).toContain("overflow-x: auto;");
  expect(scrollSurfaceRule).toContain("overflow-y: auto;");
  expect(cellRule).toContain("grid-template-columns: 48px 48px 20px");
  expect(inlineCellRule).toContain(
    "grid-template-columns: 48px 48px 48px 20px",
  );
  expect(commentLaneRule).toContain("min-width: 48px;");
  expect(codeRule).toContain("display: block;");
  expect(codeRule).toContain("min-width: max-content;");
  expect(codeRule).toContain("overflow-wrap: normal;");
  expect(codeRule).toContain("white-space: pre;");
});
