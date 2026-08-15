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
  const viewerRule = readCssRule(appCssFilePath, ".specs-workspace__viewer");
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
