import type { ExportCommentsTarget } from "@/features/comments/types/comment";
import type { SpecFileKey } from "@/features/specs/types/spec";

export type UserReviewTargetScope = "file" | "spec";

export type UserReviewTarget = Extract<
  ExportCommentsTarget,
  { scope: "file" } | { scope: "spec" }
>;

export type UserReviewTargetInput = Readonly<{
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: UserReviewTargetScope;
}>;

export type UserReviewTargetIdentity = string;

export const UserReviewTarget = {
  /** @returns A user review target for file/spec scope, or null when incomplete. */
  create(input: UserReviewTargetInput): UserReviewTarget | null {
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

export const UserReviewTargetIdentity = {
  /** @returns Stable target identity for stale async result checks. */
  create(target: UserReviewTarget | null): UserReviewTargetIdentity {
    if (target === null) {
      return "none";
    }

    if (target.scope === "spec") {
      return `spec:${target.specId}`;
    }

    return `file:${target.specId}:${target.fileKey}`;
  },

  /** @returns True when both identities refer to the same user review target. */
  equals(
    current: UserReviewTargetIdentity,
    other: UserReviewTargetIdentity,
  ): boolean {
    return current === other;
  },
} as const;
