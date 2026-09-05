import { expect, test } from "vitest";
import {
  reviewPhase1Leaves,
  validateReviewPhase1Leaves,
  type ReviewAcceptanceLeaf,
} from "./review-phase-1";

const leaf = (id: string): ReviewAcceptanceLeaf => ({
  id,
  requirement: "one behavior",
  runner: "vitest",
  selector: `[${id}]`,
  targets: [
    {
      os: "ubuntu-24.04",
      ciJob: "frontend-unit",
      artifact: "frontend-junit",
    },
  ],
});

test("[R199-MANIFEST-001] 受け入れleaf IDは一意である", () => {
  expect(
    validateReviewPhase1Leaves([leaf("R199-NAV-001"), leaf("R199-NAV-001")]),
  ).toEqual({
    kind: "invalid",
    reason: "duplicateId",
    value: "R199-NAV-001",
  });
});

test("[R199-MANIFEST-002] 受け入れleaf selectorは一意である", () => {
  const first = leaf("R199-NAV-001");
  const second = { ...leaf("R199-NAV-002"), selector: first.selector };
  expect(validateReviewPhase1Leaves([first, second])).toEqual({
    kind: "invalid",
    reason: "duplicateSelector",
    value: "[R199-NAV-001]",
  });
});

test("[R199-MANIFEST-003] OS job artifactをslash結合できない", () => {
  const invalid = {
    ...leaf("R199-NAV-001"),
    targets: [
      {
        os: "ubuntu-24.04/windows-latest",
        ciJob: "frontend-unit",
        artifact: "frontend-junit",
      },
    ],
  } as unknown as ReviewAcceptanceLeaf;
  expect(validateReviewPhase1Leaves([invalid])).toEqual({
    kind: "invalid",
    reason: "invalidTarget",
    value: "R199-NAV-001",
  });
});

test("[R199-MANIFEST-004] checked-in manifestは完全に妥当である", () => {
  expect(validateReviewPhase1Leaves(reviewPhase1Leaves)).toEqual({
    kind: "valid",
  });
  expect(reviewPhase1Leaves.length).toBeGreaterThanOrEqual(132);
});
