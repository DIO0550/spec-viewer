import type { CommentStatusFilter } from "@/features/comments/domain/commentStatusFilter";
import type { SpecFileKey } from "@/features/specs/types/spec";

export type CommentScope = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
}>;

export type CommentScopeInput = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
}>;

export const CommentScope = {
  /** @returns Complete comment scope, or null when the selected file is incomplete. */
  create(input: CommentScopeInput): CommentScope | null {
    if (
      input.workspacePath === null ||
      input.specId === null ||
      input.fileKey === null
    ) {
      return null;
    }

    return {
      workspacePath: input.workspacePath,
      specId: input.specId,
      fileKey: input.fileKey,
    };
  },
  /** @returns Scope identity for stale comment operation guards. */
  toKey(scope: CommentScope | null, statusFilter: CommentStatusFilter): string {
    if (scope === null) {
      return `idle:${statusFilter}`;
    }

    return `${scope.workspacePath}:${scope.specId}:${scope.fileKey}:${statusFilter}`;
  },
} as const;
