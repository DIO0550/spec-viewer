import type { SpecNode } from "@/features/specs/types/spec";

const BASE_TREE_ITEM_INDENT = 10;
const TREE_ITEM_INDENT_STEP = 16;

export const SpecTreeView = {
  /**
   * @param nodes - Spec tree nodes to search recursively
   * @param selectedSpecId - Currently selected spec id
   * @param ancestors - Accumulated ancestor ids for recursion
   * @returns Ancestor spec IDs for the selected node, excluding the selected ID.
   */
  ancestorSpecIds(
    nodes: readonly SpecNode[],
    selectedSpecId: string,
    ancestors: readonly string[] = [],
  ): readonly string[] {
    for (const node of nodes) {
      if (node.id === selectedSpecId) {
        return ancestors;
      }

      const childAncestors = SpecTreeView.ancestorSpecIds(
        node.children,
        selectedSpecId,
        [...ancestors, node.id],
      );

      if (childAncestors.length > 0) {
        return childAncestors;
      }
    }

    return [];
  },
  /**
   * @param expandedIds - Currently expanded spec ids
   * @param ids - Spec ids that must become expanded
   * @returns Expanded id set including the requested ids.
   */
  withExpanded(
    expandedIds: ReadonlySet<string>,
    ids: readonly string[],
  ): ReadonlySet<string> {
    const nextIds = new Set(expandedIds);

    ids.forEach((id) => {
      nextIds.add(id);
    });

    return nextIds;
  },
  /**
   * @param expandedIds - Currently expanded spec ids
   * @param specId - Spec id whose expansion should flip
   * @returns Expanded id set with the requested id toggled.
   */
  toggleExpanded(
    expandedIds: ReadonlySet<string>,
    specId: string,
  ): ReadonlySet<string> {
    const nextIds = new Set(expandedIds);

    if (nextIds.has(specId)) {
      nextIds.delete(specId);
      return nextIds;
    }

    nextIds.add(specId);
    return nextIds;
  },
  /**
   * @param node - Spec tree node
   * @returns Whether this tree node represents an archiveable spec directory.
   */
  isArchivableNode(node: SpecNode): boolean {
    return !node.id.endsWith("/.specs");
  },
  /**
   * @param depth - Zero-based tree depth
   * @returns The inline-start indentation in pixels for a tree row.
   */
  itemIndentation(depth: number): number {
    return BASE_TREE_ITEM_INDENT + depth * TREE_ITEM_INDENT_STEP;
  },
} as const;
