// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

const candidate = readFileSync(
  new URL(
    "../../../../.github/workflows/storybook-visual-candidate.yml",
    import.meta.url,
  ),
  "utf8",
);
const trusted = readFileSync(
  new URL(
    "../../../../.github/workflows/storybook-visual-approval.yml",
    import.meta.url,
  ),
  "utf8",
);

it("legacy workflow that executes PR code with write permissions is removed", () => {
  expect(
    existsSync(
      new URL(
        "../../../../.github/workflows/storybook-visual-regression.yml",
        import.meta.url,
      ),
    ),
  ).toBe(false);
});

it("[R199-VRT-005] candidate workflow is read-only", () => {
  expect(candidate).toContain("pull_request:");
  expect(candidate).toContain("contents: read");
  expect(candidate).not.toMatch(
    /contents: write|pull-requests: write|issues: write/,
  );
});

it("[R199-VRT-007] trusted workflow executes only the base-pinned validator", () => {
  expect(trusted).toMatch(/workflow_run:|issue_comment:|pull_request_review:/);
  expect(trusted).toContain(
    "ref: ${{ github.event.repository.default_branch }}",
  );
  expect(trusted).not.toContain("github.event.pull_request.head.sha");
  expect(trusted).not.toMatch(
    /pnpm (install|build)|npm (install|run)|pull_request_target/,
  );
});
