import type { ChangedFile } from "./changedFile";
import type { WorktreeSpec } from "./worktreeSpec";

export type WorktreeId = string;

export type Worktree = Readonly<{
  id: WorktreeId;
  name: string;
  categoryPath: readonly string[];
  specs: readonly WorktreeSpec[];
  changedFiles: readonly ChangedFile[];
}>;

export const Worktree = {
  /**
   * Counts the non-archived specs in this worktree.
   * @param worktree - Worktree whose specs are counted.
   * @returns The number of active specs.
   */
  countActiveSpecs(worktree: Worktree): number {
    let count = 0;
    for (const spec of worktree.specs) {
      if (!spec.isArchived) {
        count += 1;
      }
    }
    return count;
  },
  /**
   * Counts the changed file entries in this worktree.
   * @param worktree - Worktree whose changed files are counted.
   * @returns The number of changed file entries.
   */
  countChangedFiles(worktree: Worktree): number {
    return worktree.changedFiles.length;
  },
} as const;
