import type { ReviewRunTarget } from "@/features/review-runs/types/reviewRun";
import type { SpecFileKey } from "@/features/specs/types/spec";

export type ReviewSessionTargetScope = "file" | "spec";

export type ReviewSessionTargetInput = Readonly<{
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: ReviewSessionTargetScope;
}>;

export type ReviewSessionTargetIdentity = string;

export const ReviewSessionTarget = {
  /** @returns A review-run target for file/spec scope, or null when incomplete. */
  create(input: ReviewSessionTargetInput): ReviewRunTarget | null {
    if (input.specId === null) {
      return null;
    }

    if (input.targetScope === "spec") {
      return {
        scope: "spec",
        specId: input.specId,
      };
    }

    if (input.fileKey === null) {
      return null;
    }

    return {
      scope: "file",
      specId: input.specId,
      fileKey: input.fileKey,
    };
  },
} as const;

export const ReviewSessionTargetIdentity = {
  /** @returns Stable target identity for stale async result checks. */
  create(target: ReviewRunTarget | null): ReviewSessionTargetIdentity {
    if (target === null) {
      return "none";
    }

    if (target.scope === "spec") {
      return `spec:${target.specId}`;
    }

    return `file:${target.specId}:${target.fileKey}`;
  },

  /** @returns True when both identities refer to the same review-run target. */
  equals(
    current: ReviewSessionTargetIdentity,
    other: ReviewSessionTargetIdentity,
  ): boolean {
    return current === other;
  },
} as const;
