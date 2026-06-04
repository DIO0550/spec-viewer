import type { ReviewRunTarget as ReviewRunTargetDto } from "@/features/review-runs/types/reviewRun";
import type { SpecFileKey } from "@/features/specs/types/spec";

export type ReviewRunTargetScope = "file" | "spec";

export type ReviewRunTargetInput = Readonly<{
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: ReviewRunTargetScope;
}>;

export type ReviewRunTargetIdentity = string;

export const ReviewRunTarget = {
  /** @returns A review-run target for file/spec scope, or null when incomplete. */
  create(input: ReviewRunTargetInput): ReviewRunTargetDto | null {
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

export const ReviewRunTargetIdentity = {
  /** @returns Stable target identity for stale async result checks. */
  create(target: ReviewRunTargetDto | null): ReviewRunTargetIdentity {
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
    current: ReviewRunTargetIdentity,
    other: ReviewRunTargetIdentity,
  ): boolean {
    return current === other;
  },
} as const;
