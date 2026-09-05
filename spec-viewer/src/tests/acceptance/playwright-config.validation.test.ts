import { expect, test } from "vitest";
import {
  appPlaywrightTestMatches,
  storybookPlaywrightTestMatches,
} from "../../../playwright.test-matches";

test("[R199-CONFIG-001] App Playwrightは明示したspecだけを実行する", () => {
  expect(appPlaywrightTestMatches).toEqual([
    "diff-comments.spec.ts",
    "review-regression.spec.ts",
  ]);
});

test("[R199-CONFIG-002] Storybook Playwrightは明示したspecだけを実行する", () => {
  expect(storybookPlaywrightTestMatches).toEqual([
    "storybook-diff-comments.spec.ts",
    "storybook-review-regression.spec.ts",
  ]);
});

test("[R199-CONFIG-003] AppとStorybookのspec discoveryは交差しない", () => {
  const appMatches = new Set<string>(appPlaywrightTestMatches);
  expect(
    storybookPlaywrightTestMatches.filter((value) => appMatches.has(value)),
  ).toEqual([]);
});
