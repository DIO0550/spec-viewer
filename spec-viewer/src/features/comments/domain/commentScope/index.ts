import type { SpecFileKey, SpecFileScope } from "@/features/specs/types/spec";

export type CommentScope = SpecFileScope;

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
} as const;
