import type { SpecFileKey } from "@/shared/types/specFileKey";

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
} as const;
