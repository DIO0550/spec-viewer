import type {
  WorkspaceWorktrees,
  Worktree,
} from "@/features/workspace/domain/worktree";
import type { ViewMode } from "@/features/workspace/types/viewMode";
import { WorktreeTreeNode } from "@/features/workspace/types/worktreeTreeNode";

type MutableCategoryNode = {
  kind: "category";
  id: string;
  label: string;
  children: Array<MutableCategoryNode | WorktreeTreeNode>;
};

export type WorktreeTree = readonly WorktreeTreeNode[];

export const WorktreeTree = {
  /**
   * Projects one workspace snapshot into a navigation tree.
   * @param source - Immutable worktree facts.
   * @param mode - Active Specs or Diff mode.
   * @returns A detached tree in display order.
   */
  fromWorkspace(source: WorkspaceWorktrees, mode: ViewMode): WorktreeTree {
    if (mode === "diff") {
      return source.worktrees.map((worktree) =>
        WorktreeTreeNode.fromWorktree(worktree, mode),
      );
    }

    const roots: Array<MutableCategoryNode | WorktreeTreeNode> = [];
    const categoriesById = new Map<string, MutableCategoryNode>();

    for (const worktree of source.worktrees) {
      appendSpecsWorktree(roots, categoriesById, worktree);
    }

    return copySnapshots(roots);
  },
} as const;

/**
 * Adds a worktree to its ordered category path.
 *
 * @param roots - Mutable projection builder roots.
 * @param categoriesById - Categories already created for this projection.
 * @param worktree - Worktree to append.
 */
function appendSpecsWorktree(
  roots: Array<MutableCategoryNode | WorktreeTreeNode>,
  categoriesById: Map<string, MutableCategoryNode>,
  worktree: Worktree,
): void {
  let siblings = roots;
  const pathParts: string[] = [];

  for (const categoryLabel of worktree.categoryPath) {
    pathParts.push(categoryLabel);
    const categoryId = `category:${pathParts.map(encodeURIComponent).join("/")}`;
    const existing = categoriesById.get(categoryId);
    const category =
      existing ??
      ({
        kind: "category",
        id: categoryId,
        label: categoryLabel,
        children: [],
      } satisfies MutableCategoryNode);

    if (existing === undefined) {
      siblings.push(category);
      categoriesById.set(categoryId, category);
    }

    siblings = category.children;
  }

  siblings.push(WorktreeTreeNode.fromWorktree(worktree, "specs"));
}

/**
 * Converts mutable builder nodes into detached readonly snapshots.
 *
 * @param nodes - Projection builder nodes.
 * @returns Recursively copied UI nodes.
 */
function copySnapshots(
  nodes: readonly (MutableCategoryNode | WorktreeTreeNode)[],
): readonly WorktreeTreeNode[] {
  return nodes.map((node) => {
    if (node.kind === "worktree") {
      return {
        ...node,
        count: { ...node.count },
      };
    }

    return {
      kind: "category",
      id: node.id,
      label: node.label,
      children: copySnapshots(node.children),
    };
  });
}
