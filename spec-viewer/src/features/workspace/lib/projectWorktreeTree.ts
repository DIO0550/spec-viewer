import type {
  WorkspaceWorktrees,
  Worktree,
} from "@/features/workspace/domain/worktree";
import type { ViewMode } from "@/features/workspace/types/viewMode";
import type { WorktreeTreeNode } from "@/features/workspace/types/worktreeTreeNode";

type MutableCategoryNode = {
  kind: "category";
  id: string;
  label: string;
  children: Array<MutableCategoryNode | WorktreeTreeNode>;
};

/**
 * Projects one workspace snapshot into the navigation tree for a view mode.
 *
 * @param source - Immutable worktree facts.
 * @param mode - Active Specs or Diff mode.
 * @returns A detached readonly tree in display order.
 */
export function projectWorktreeTree(
  source: WorkspaceWorktrees,
  mode: ViewMode,
): readonly WorktreeTreeNode[] {
  if (mode === "diff") {
    return source.worktrees.map((worktree) =>
      createWorktreeNode(worktree, mode),
    );
  }

  const roots: Array<MutableCategoryNode | WorktreeTreeNode> = [];
  const categoriesById = new Map<string, MutableCategoryNode>();

  for (const worktree of source.worktrees) {
    appendSpecsWorktree(roots, categoriesById, worktree);
  }

  return freezeNodes(roots);
}

/**
 * Adds a worktree to its ordered category path.
 *
 * @param roots - Mutable projection builder roots.
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

  siblings.push(createWorktreeNode(worktree, "specs"));
}

/**
 * Creates a detached leaf node.
 *
 * @param worktree - Source worktree.
 * @param mode - Projection mode.
 * @returns A worktree navigation leaf.
 */
function createWorktreeNode(
  worktree: Worktree,
  mode: ViewMode,
): WorktreeTreeNode {
  const value =
    mode === "specs"
      ? worktree.specs.filter((spec) => !spec.isArchived).length
      : worktree.changedFiles.length;

  return {
    kind: "worktree",
    id: worktree.id,
    label: worktree.name,
    count: {
      kind: mode === "specs" ? "spec-count" : "changed-file-count",
      value,
    },
  };
}

/**
 * Converts mutable builder nodes into detached readonly snapshots.
 *
 * @param nodes - Projection builder nodes.
 * @returns Recursively copied UI nodes.
 */
function freezeNodes(
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
      children: freezeNodes(node.children),
    };
  });
}
