import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const cssFilePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../App.css",
);

/** @returns The declaration body for one CSS selector in App.css. */
function readCssRule(selector: string): string {
  const css = readFileSync(cssFilePath, "utf8");
  const selectorPattern = selector
    .trim()
    .split(/\s+/)
    .map((selectorPart) => selectorPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const match = css.match(new RegExp(`${selectorPattern}\\s*{(?<body>[^}]*)}`));

  return match?.groups?.body ?? "";
}

test("Specs表示はModeNavigationと本文をそれぞれのスクロール領域に収める", () => {
  const contentRule = readCssRule(".app-shell__content");
  const specsRule = readCssRule(".specs-workspace");
  const viewerRule = readCssRule(".specs-workspace__viewer");
  const markdownRule = readCssRule(
    ".specs-workspace__viewer > .markdown-viewer",
  );

  expect(contentRule).toContain("display: flex;");
  expect(contentRule).toContain("overflow: hidden;");
  expect(specsRule).toContain("display: flex;");
  expect(specsRule).toContain("flex-direction: column;");
  expect(viewerRule).toContain("display: flex;");
  expect(viewerRule).toContain("overflow: hidden;");
  expect(markdownRule).toContain("height: 100%;");
  expect(markdownRule).toContain("overflow: auto;");
});

test("SpecTreeのアーカイブ操作はSpec行の同じ行に収まる", () => {
  const itemRule = readCssRule(".spec-tree__item");

  expect(itemRule).toContain(
    "grid-template-columns: 14px auto minmax(0, 1fr) auto auto auto;",
  );
});

test("Diff表示はファイルタブとプレビューを縦方向に積む", () => {
  const workspaceRule = readCssRule(".diff-workspace");
  const contentRule = readCssRule(".diff-workspace__content");
  const previewRule = readCssRule(".diff-preview");

  expect(workspaceRule).toContain("display: flex;");
  expect(workspaceRule).toContain("flex-direction: column;");
  expect(contentRule).toContain("display: flex;");
  expect(contentRule).toContain("overflow: hidden;");
  expect(previewRule).toContain("display: flex;");
  expect(previewRule).toContain("flex-direction: column;");
});
