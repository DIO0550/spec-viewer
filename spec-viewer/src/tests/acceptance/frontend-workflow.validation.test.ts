import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const workflow = readFileSync(
  resolve("../.github/workflows/frontend.yml"),
  "utf8",
);
const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8"));

it("frontend workflow exposes typed acceptance job and artifact IDs", () => {
  for (const value of [
    "frontend-unit:",
    "app-review-e2e:",
    "storybook-review-e2e:",
    "native-review-smoke:",
    "name: app-playwright",
    "name: storybook-playwright",
    "name: native-smoke",
  ])
    expect(workflow).toContain(value);
});

it("App, Storybook, and native scripts remain exact and disjoint", () => {
  expect(packageJson.scripts["test:e2e"]).toBe("pnpm test:e2e:app");
  expect(packageJson.scripts["test:e2e:app"]).toContain("playwright.config.ts");
  expect(packageJson.scripts["test:e2e:storybook"]).toContain(
    "playwright.storybook.config.ts",
  );
  expect(packageJson.scripts["test:e2e:native"]).toContain(
    "wdio.native.conf.ts",
  );
});

it("native job installs direct WebKit driver and runs under Xvfb", () => {
  expect(workflow).toContain("webkit2gtk-driver");
  expect(workflow).toContain("xvfb");
  expect(workflow).toContain(
    "cargo install tauri-driver --version 2.0.6 --locked",
  );
  expect(packageJson.scripts["test:e2e:native"]).toContain("xvfb-run -a");
});
