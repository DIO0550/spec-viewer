import type { SelectionIdentity } from "@/features/specs/domain/specViewSelection";
import {
  SpecViewSelection,
  type SpecViewSelection as SpecViewSelectionType,
} from "@/features/specs/domain/specViewSelection";
import type { SpecFileKey } from "@/features/specs/types/spec";
import { WorkspacePath } from "@/shared/domain/workspacePath";

export type CommentScope = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
  selectionIdentity: SelectionIdentity;
}>;

export const CommentScope = {
  /**
   * @param selection - Current spec view selection aggregate.
   * @returns Complete comment scope, or null when the selected file is incomplete.
   */
  fromSelection(selection: SpecViewSelectionType): CommentScope | null {
    const target = SpecViewSelection.commentTarget(selection);
    if (target === null) {
      return null;
    }

    return {
      workspacePath: WorkspacePath.toString(target.workspacePath),
      specId: target.specId,
      fileKey: target.fileKey,
      selectionIdentity: target.selectionIdentity,
    };
  },

  /**
   * @param scope - Complete comment scope.
   * @returns Selection identity derived through the shared aggregate rules.
   */
  selectionIdentity(scope: CommentScope): SelectionIdentity {
    return scope.selectionIdentity;
  },
} as const;
