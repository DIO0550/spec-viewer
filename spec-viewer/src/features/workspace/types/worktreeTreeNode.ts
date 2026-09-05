import type { WorktreeId } from "@/features/workspace/domain/worktree";

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
