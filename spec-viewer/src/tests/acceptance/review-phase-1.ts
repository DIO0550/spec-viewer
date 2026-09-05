import generatedLeaves from "./review-phase-1.generated.json";

export type ReviewTargetOs = "ubuntu-24.04" | "windows-latest";

export type ReviewAcceptanceTarget = Readonly<{
  os: ReviewTargetOs;
  ciJob: string;
  artifact: string;
}>;

export type ReviewAcceptanceLeaf = Readonly<{
  id: string;
  requirement: string;
  runner: string;
  selector: string;
  targets: readonly ReviewAcceptanceTarget[];
}>;

type ReviewAcceptanceValidation =
  | Readonly<{ kind: "valid" }>
  | Readonly<{
      kind: "invalid";
      reason:
        | "duplicateId"
        | "duplicateSelector"
        | "emptyField"
        | "invalidId"
        | "invalidTarget";
      value: string;
    }>;

const leafIdPattern = /^R199-[A-Z0-9]+-[0-9]{3}$/;
const allowedOperatingSystems = new Set<ReviewTargetOs>([
  "ubuntu-24.04",
  "windows-latest",
]);

const isInvalidTarget = (target: ReviewAcceptanceTarget): boolean =>
  !allowedOperatingSystems.has(target.os) ||
  target.ciJob.length === 0 ||
  target.artifact.length === 0 ||
  target.ciJob.includes("/") ||
  target.artifact.includes("/");

/**
 * Validates that every Phase 1 evidence leaf is independently runnable.
 *
 * @param leaves - Acceptance evidence records to validate.
 * @returns A stable validation result suitable for the CI completeness gate.
 */
export const validateReviewPhase1Leaves = (
  leaves: readonly ReviewAcceptanceLeaf[],
): ReviewAcceptanceValidation => {
  const ids = new Set<string>();
  const selectors = new Set<string>();
  for (const leaf of leaves) {
    if (!leafIdPattern.test(leaf.id)) {
      return { kind: "invalid", reason: "invalidId", value: leaf.id };
    }
    if (ids.has(leaf.id)) {
      return { kind: "invalid", reason: "duplicateId", value: leaf.id };
    }
    ids.add(leaf.id);
    if (
      leaf.requirement.length === 0 ||
      leaf.runner.length === 0 ||
      leaf.selector.length === 0 ||
      leaf.targets.length === 0
    ) {
      return { kind: "invalid", reason: "emptyField", value: leaf.id };
    }
    if (selectors.has(leaf.selector)) {
      return {
        kind: "invalid",
        reason: "duplicateSelector",
        value: leaf.selector,
      };
    }
    selectors.add(leaf.selector);
    if (leaf.targets.some(isInvalidTarget)) {
      return { kind: "invalid", reason: "invalidTarget", value: leaf.id };
    }
  }
  return { kind: "valid" };
};

export const reviewPhase1Leaves =
  generatedLeaves as readonly ReviewAcceptanceLeaf[];
