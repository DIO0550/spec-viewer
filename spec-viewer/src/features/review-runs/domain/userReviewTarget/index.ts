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

const specFileKeys: ReadonlySet<SpecFileKey> = new Set([
  "exploration",
  "hearing",
  "impl",
  "tasks",
  "tech-reference",
  "test-cases",
  "requirements",
  "design",
]);

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

  /**
   * @param target - Runtime target value restored from a boundary.
   * @returns True when target scope and identity fields are valid.
   */
  isValid(target: unknown): target is UserReviewTarget {
    if (typeof target !== "object" || target === null) {
      return false;
    }

    const candidate = target as Record<string, unknown>;

    if (
      typeof candidate.specId !== "string" ||
      candidate.specId.trim().length === 0
    ) {
      return false;
    }

    if (candidate.scope === "spec") {
      return true;
    }

    return (
      candidate.scope === "file" &&
      specFileKeys.has(candidate.fileKey as SpecFileKey)
    );
  },

  /**
   * @param target - First target.
   * @param other - Second target.
   * @returns True when both targets select the same spec/file scope.
   */
  equals(target: UserReviewTarget, other: UserReviewTarget): boolean {
    if (target.scope !== other.scope || target.specId !== other.specId) {
      return false;
    }

    if (target.scope === "spec" || other.scope === "spec") {
      return true;
    }

    return target.fileKey === other.fileKey;
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
