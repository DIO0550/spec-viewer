import { expect, test } from "vitest";

import { DiffAvailability } from "@/features/diff/domain/diffAvailability";

test.each([
  "notRepository",
  "bareRepository",
  "worktreeUnavailable",
  "gitUnavailable",
  "unbornHead",
])("DiffAvailabilityはrepository不可code=%sをtrueと判定する", (code) => {
  expect(DiffAvailability.isRepositoryUnavailable(code)).toBe(true);
});

test.each([
  "invalidResponse",
  "gitTimedOut",
  "gitFailed",
  "staleSnapshot",
  "unknown",
])("DiffAvailabilityは通常error code=%sをfalseと判定する", (code) => {
  expect(DiffAvailability.isRepositoryUnavailable(code)).toBe(false);
});
