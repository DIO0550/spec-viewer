import { expect, test } from "vitest";

import { DiffAvailability } from "@/features/diff/domain/diffAvailability";

const REPOSITORY_UNAVAILABLE_CODES = [
  "notRepository",
  "bareRepository",
  "worktreeUnavailable",
  "gitUnavailable",
  "unbornHead",
];

const STALE_CODES = [
  "staleSnapshot",
  "headChangedDuringRead",
  "staleBase",
  "entryChangedDuringRead",
  "staleCursor",
  "invalidCursor",
];

test.each(
  REPOSITORY_UNAVAILABLE_CODES,
)("DiffAvailabilityはrepository不可code=%sをtrueと判定する", (code) => {
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

test("DiffAvailabilityはcommonDirBoundaryEscapeをSpec側のrepository不可に含めない", () => {
  expect(
    DiffAvailability.isRepositoryUnavailable("commonDirBoundaryEscape"),
  ).toBe(false);
});

test.each(
  REPOSITORY_UNAVAILABLE_CODES,
)("isRepositoryWideUnavailableは既存repository不可code=%sをtrueと判定する", (code) => {
  expect(DiffAvailability.isRepositoryWideUnavailable(code)).toBe(true);
});

test("isRepositoryWideUnavailableはcommonDirBoundaryEscapeもtrueと判定する", () => {
  expect(
    DiffAvailability.isRepositoryWideUnavailable("commonDirBoundaryEscape"),
  ).toBe(true);
});

test.each(STALE_CODES)("isStaleはstale code=%sをtrueと判定する", (code) => {
  expect(DiffAvailability.isStale(code)).toBe(true);
});

test.each([
  ...REPOSITORY_UNAVAILABLE_CODES,
  "commonDirBoundaryEscape",
])("unavailable code=%sはstaleと判定されない", (code) => {
  expect(DiffAvailability.isStale(code)).toBe(false);
});

test.each(
  STALE_CODES,
)("stale code=%sはrepository不可と判定されない", (code) => {
  expect(DiffAvailability.isRepositoryWideUnavailable(code)).toBe(false);
});

test("unbornHeadはunavailableでありstaleではない", () => {
  expect(DiffAvailability.isRepositoryWideUnavailable("unbornHead")).toBe(true);
  expect(DiffAvailability.isStale("unbornHead")).toBe(false);
});

test.each([
  "io",
  "gitTimedOut",
  "invalidResponse",
])("無関係なerror code=%sはunavailableでもstaleでもない", (code) => {
  expect(DiffAvailability.isRepositoryWideUnavailable(code)).toBe(false);
  expect(DiffAvailability.isStale(code)).toBe(false);
});
