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
  const match = css.match(new RegExp(`${escapedSelector}\\s*{(?<body>[^}]*)}`));

  return match?.groups?.body ?? "";
}

test("Editor windowing surfaceは後続base ruleより高いmodifier scopeを持つ", () => {
  const viewerRule = readCssRule(
    ".current-file-viewer.current-file-viewer--editor",
  );
  const rowRule = readCssRule(
    ".current-file-viewer--editor .current-file-viewer__row",
  );

  expect(viewerRule).toContain("display: flex;");
  expect(viewerRule).toContain("overflow: hidden;");
  expect(rowRule).toContain("grid-template-columns: 4px 52px max-content;");
});
