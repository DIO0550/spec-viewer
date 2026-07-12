import type { SpecFileKey } from "@/shared/domain/specFileKey";
import {
  SpecViewSelection,
  type SpecViewSelection as SpecViewSelectionType,
  type SpecViewTargetScope,
} from "@/shared/domain/specViewSelection";

export type UserReviewTargetScope = SpecViewTargetScope;

export type UserReviewTarget =
  | Readonly<{
      scope: "file";
      specId: string;
      fileKey: SpecFileKey;
    }>
  | Readonly<{
      scope: "spec";
      specId: string;
    }>;

export const UserReviewTarget = {
  /**
   * @param selection - Current spec view selection aggregate.
   * @returns A validated user review target, or null when incomplete.
   */
  fromSelection(selection: SpecViewSelectionType): UserReviewTarget | null {
    const target = SpecViewSelection.reviewTarget(selection);
    if (target === null) {
      return null;
    }

    if (target.scope === "spec") {
      return {
        scope: "spec",
        specId: target.specId,
      };
    }

    return {
      scope: "file",
      specId: target.specId,
      fileKey: target.fileKey,
    };
  },
} as const;
