import { expect, it } from "vitest";

import { buildEvidence } from "../../../scripts/generate-review-evidence.mjs";
import type { ReviewAcceptanceLeaf } from "./review-phase-1";

const leaf = {
  id: "R199-UNIT-001",
  requirement: "one behavior",
  runner: "Vitest",
  selector: "[R199-UNIT-001]",
  targets: [
    { os: "ubuntu-24.04", ciJob: "frontend-unit", artifact: "frontend-junit" },
  ],
} satisfies ReviewAcceptanceLeaf;

it("evidence aggregation accepts exactly one successful result per leaf target", () => {
  expect(
    buildEvidence(
      [leaf],
      [{ leafId: leaf.id, ...leaf.targets[0], status: "passed" }],
    ).summary,
  ).toEqual({ passed: 1, required: 1 });
});

it("evidence aggregation fails when a required leaf target is absent", () => {
  expect(() => buildEvidence([leaf], [])).toThrow(/missing evidence/i);
});

it("evidence aggregation rejects one result reused for duplicate leaf evidence", () => {
  const result = { leafId: leaf.id, ...leaf.targets[0], status: "passed" };
  expect(() => buildEvidence([leaf], [result, result])).toThrow(
    /duplicate evidence/i,
  );
});
