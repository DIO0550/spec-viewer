import type { SelectionIdentity } from "@/features/specs/domain/specViewSelection";
import {
  SpecViewSelection,
  type SpecViewSelection as SpecViewSelectionType,
} from "@/features/specs/domain/specViewSelection";
import type { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import type { SpecFileKey } from "@/features/specs/types/spec";
import { WorkspacePath } from "@/domains/workspacePath";

export type CommentScope = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
  selectionIdentity: SelectionIdentity;
}>;

export const CommentScope = {
  /**
   * @param input - Current workspace and selected document at the application boundary.
   * @returns Complete comment scope, or null for an incomplete selection.
   */
  create(
    input: Readonly<{
      workspacePath: string | null;
      specId: string | null;
      fileKey: SpecFileKey | null;
    }>,
  ): CommentScope | null {
    const workspacePath =
      input.workspacePath === null
        ? null
        : WorkspacePath.fromString(input.workspacePath);
    return CommentScope.fromSelection(
      SpecViewSelection.synchronize(SpecViewSelection.empty(), {
        ...input,
        workspacePath,
      }),
    );
  },
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
  /** @returns Scope identity for stale comment operation guards. */
  toKey(scope: CommentScope | null, statusFilter: CommentStatusFilter): string {
    if (scope === null) {
      return `idle:${statusFilter}`;
    }

    return `${scope.workspacePath}:${scope.specId}:${scope.fileKey}:${statusFilter}`;
  },
} as const;
