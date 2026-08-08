import { expect, test } from "vitest";

import {
  createInitialSpecDiffWorkspaceState,
  reduceSpecDiffWorkspaceState,
} from "@/features/diff/domain/specDiffWorkspaceState";

const identity = {
  workspacePath: "/workspace",
  cycleId: 1,
  requestGeneration: 1,
} as const;

/**
 * Reduces a started-then-failed overview cycle for one Backend error code.
 *
 * @param code - Backend error code carried by the overviewFailed action.
 * @returns The state after the failure was reduced.
 */
function reduceOverviewFailure(code: string) {
  const started = reduceSpecDiffWorkspaceState(
    createInitialSpecDiffWorkspaceState(),
    { type: "overviewStarted", ...identity },
  );

  return reduceSpecDiffWorkspaceState(started, {
    type: "overviewFailed",
    ...identity,
    code,
    message: `${code} failure`,
  });
}

test.each([
  "notRepository",
  "bareRepository",
  "worktreeUnavailable",
  "gitUnavailable",
  "unbornHead",
])("overview失敗のcode=%sは従来どおりunavailableになる", (code) => {
  expect(reduceOverviewFailure(code).status).toBe("unavailable");
});

test("commonDirBoundaryEscapeはunavailableへ昇格せずfailedのままである", () => {
  expect(reduceOverviewFailure("commonDirBoundaryEscape").status).toBe(
    "failed",
  );
});

test.each([
  "io",
  "gitTimedOut",
  "gitFailed",
  "staleSnapshot",
])("unavailable以外のcode=%sはfailedのままである", (code) => {
  expect(reduceOverviewFailure(code).status).toBe("failed");
});
