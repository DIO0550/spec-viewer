import type { WorktreeId } from "@/features/workspace/domain/worktree";
import type { WorktreeTreeNode } from "@/features/workspace/types/worktreeTreeNode";

/**
 * Lists leaf IDs in depth-first pre-order.
 *
 * @param nodes - Projected navigation nodes.
 * @returns Worktree IDs in visible fallback order.
 */
export function listWorktreeIdsDepthFirst(
  nodes: readonly WorktreeTreeNode[],
): readonly WorktreeId[] {
  return nodes.flatMap((node) =>
    node.kind === "worktree"
      ? [node.id]
      : listWorktreeIdsDepthFirst(node.children),
  );
}

/**
 * Preserves a valid selection or falls back to the first worktree leaf.
 *
 * @param nodes - Projected navigation nodes.
 * @param preferredId - Previously selected worktree.
 * @returns A valid worktree ID, or null when no leaf exists.
 */
export function resolveWorktreeSelection(
  nodes: readonly WorktreeTreeNode[],
  preferredId: WorktreeId | null,
): WorktreeId | null {
  const ids = listWorktreeIdsDepthFirst(nodes);

  if (preferredId !== null && ids.includes(preferredId)) {
    return preferredId;
  }

  return ids[0] ?? null;
}
