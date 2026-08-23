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
  const rootRule = readCssRule(diffViewerCssFilePath, ":root");
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
  const addedMarkerRule = readCssRule(
    diffViewerCssFilePath,
    '.diff-viewer__cell[data-kind="added"] .diff-viewer__marker',
  );
  const addedWordRule = readCssRule(
    diffViewerCssFilePath,
    '[data-segment-kind="added"]',
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
    "background: var(--diff-added-number-bg);",
  );
  expect(removedLineNumberRule).toContain(
    "background: var(--diff-removed-number-bg);",
  );
  expect(rootRule).toContain("--diff-added-line-bg: #e6ffec;");
  expect(rootRule).toContain("--diff-added-number-bg: #ccffd8;");
  expect(rootRule).toContain("--diff-added-word-bg: #abf2bc;");
  expect(rootRule).toContain("--diff-removed-line-bg: #ffebe9;");
  expect(rootRule).toContain("--diff-removed-number-bg: #ffd7d5;");
  expect(addedMarkerRule).toContain("background: var(--diff-added-line-bg);");
  expect(addedWordRule).toContain("background: var(--diff-added-word-bg);");
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
  const endSpacerRule = readCssRule(
    diffViewerCssFilePath,
    ".diff-viewer__end-spacer",
  );

  expect(scrollSurfaceRule).toContain("overflow-x: auto;");
  expect(scrollSurfaceRule).toContain("overflow-y: auto;");
  expect(scrollSurfaceRule).toContain(
    "font-size: var(--viewer-font-size, 16px);",
  );
  expect(scrollSurfaceRule).toContain(
    "line-height: var(--viewer-line-height, 26px);",
  );
  expect(cellRule).toContain("grid-template-columns: 48px 20px");
  expect(cellRule).toContain("min-height: var(--viewer-line-height, 26px);");
  expect(inlineCellRule).toContain("grid-template-columns: 48px 48px 20px");
  expect(commentLaneRule).toContain("min-width: 112px;");
  expect(codeRule).toContain("display: block;");
  expect(codeRule).toContain("min-width: max-content;");
  expect(codeRule).toContain("overflow-wrap: normal;");
  expect(codeRule).toContain("white-space: pre;");
  expect(endSpacerRule).toContain(
    "height: calc(100% - var(--viewer-line-height, 26px));",
  );
  expect(endSpacerRule).toContain(
    "min-height: calc(100% - var(--viewer-line-height, 26px));",
  );
});

test("Diff表示切替はデザイン同様のsegmented controlとして描画する", () => {
  const controlsRule = readCssRule(
    repositoryDiffCssFilePath,
    ".diff-view-mode-controls",
  );
  const buttonRule = readCssRule(
    repositoryDiffCssFilePath,
    ".diff-view-mode-controls__button",
  );
  const adjacentButtonRule = readCssRule(
    repositoryDiffCssFilePath,
    ".diff-view-mode-controls__button + .diff-view-mode-controls__button",
  );

  expect(controlsRule).toContain("border: 1px solid var(--diff-border);");
  expect(controlsRule).toContain("border-radius: 6px;");
  expect(controlsRule).toContain("overflow: hidden;");
  expect(buttonRule).toContain("padding: 4px 14px;");
  expect(buttonRule).toContain("border: 0;");
  expect(adjacentButtonRule).toContain(
    "border-left: 1px solid var(--diff-border);",
  );
});

test("サイドバー開閉ボタンはパネル端のヘッダー位置に揃える", () => {
  const commentsCloseRule = readCssRule(
    appCssFilePath,
    ".app-shell__comments-close",
  );
  const worktreesCloseRule = readCssRule(
    appCssFilePath,
    ".app-shell__worktrees-close",
  );
  const currentWorkspaceRule = readCssRule(
    appCssFilePath,
    ".workspace-sidebar-section__current",
  );
  const worktreesOpenRule = readCssRule(
    appCssFilePath,
    ".app-shell__worktrees-open",
  );
  const commentsOpenRule = readCssRule(
    appCssFilePath,
    ".app-shell__comments-open",
  );

  expect(commentsCloseRule).toContain("right: 12px;");
  expect(worktreesCloseRule).toContain("top: 20px;");
  expect(worktreesCloseRule).toContain("right: 18px;");
  expect(currentWorkspaceRule).toContain("padding-right: 46px;");
  expect(worktreesOpenRule).toContain("align-self: center;");
  expect(commentsOpenRule).toContain("align-self: center;");
});

test("主要なファイル名とworktree名を14pxで読みやすく表示する", () => {
  const activeItemRule = readCssRule(
    appCssFilePath,
    ".view-mode-toolbar__item",
  );
  const specFileRule = readCssRule(appCssFilePath, ".spec-tree__item-label");
  const diffTreeRule = readCssRule(
    appCssFilePath,
    ".repository-diff-tree__name",
  );
  const worktreeRule = readCssRule(appCssFilePath, ".worktree-tree__label");
  const diffTabRule = readCssRule(
    repositoryDiffCssFilePath,
    ".repository-file-tab__path",
  );

  expect(activeItemRule).toContain("font-size: 14px;");
  expect(specFileRule).toContain("font-size: 14px;");
  expect(diffTreeRule).toContain("font-size: 14px;");
  expect(worktreeRule).toContain("font-size: 14px;");
  expect(diffTabRule).toContain("font-size: 14px;");
});
