import {
  Worktree,
  type WorktreeId,
} from "@/features/workspace/domain/worktree";
import type { ViewMode } from "@/features/workspace/types/viewMode";

export type WorktreeRowCount =
  | Readonly<{ kind: "spec-count"; value: number }>
  | Readonly<{ kind: "changed-file-count"; value: number }>;

export type WorktreeTreeNode =
  | Readonly<{
      kind: "category";
      id: string;
      label: string;
      children: readonly WorktreeTreeNode[];
    }>
  | Readonly<{
      kind: "worktree";
      id: WorktreeId;
      label: string;
      count: WorktreeRowCount;
    }>;

export const WorktreeTreeNode = {
  /**
   * Creates a detached navigation leaf from a worktree.
   * @param worktree - Source worktree.
   * @param mode - View mode used to select the count.
   * @returns A worktree navigation leaf.
   */
  fromWorktree(worktree: Worktree, mode: ViewMode): WorktreeTreeNode {
    return {
      kind: "worktree",
      id: worktree.id,
      label: worktree.name,
      count:
        mode === "specs"
          ? { kind: "spec-count", value: Worktree.countActiveSpecs(worktree) }
          : {
              kind: "changed-file-count",
              value: Worktree.countChangedFiles(worktree),
            },
    };
  },
} as const;
