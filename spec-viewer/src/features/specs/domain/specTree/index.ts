import type { SpecFileKey } from "@/features/specs/domain/specFile";
import {
  SpecNode,
  type SpecNodeIdentity,
  type SpecNode as SpecNodeType,
} from "@/features/specs/domain/specNode";

export type SpecTree = Readonly<{
  specs: readonly SpecNodeType[];
}>;

export type SpecSelection = Readonly<{
  spec: SpecNodeType | null;
  fileKey: SpecFileKey | null;
}>;

export const SpecTree = {
  /**
   * Returns true when no openable spec exists in the projection.
   * @param tree - Spec tree to inspect.
   * @returns True when the tree has no openable spec node.
   */
  isEmpty: (tree: SpecTree): boolean =>
    SpecNode.firstOpenable(tree.specs) === null,

  /**
   * Finds a node by its legacy global id.
   * @param tree - Spec tree to search.
   * @param specId - Legacy global id to match.
   * @returns The matching node, or null when no node has the given id.
   */
  findNode: (tree: SpecTree, specId: string): SpecNodeType | null =>
    SpecNode.findById(tree.specs, specId),

  /**
   * Finds a node by its stable composite identity.
   * @param tree - Spec tree to search.
   * @param identity - Source-group-relative identity to match.
   * @returns The matching node, or null when no node has the given identity.
   */
  findNodeByIdentity: (
    tree: SpecTree,
    identity: SpecNodeIdentity,
  ): SpecNodeType | null => SpecNode.findByIdentity(tree.specs, identity),

  /**
   * Returns the path from a root to the matching composite identity.
   * @param tree - Spec tree to search.
   * @param identity - Source-group-relative identity of the target node.
   * @returns The ancestor-to-target node path, or an empty array when the identity is not found.
   */
  findPathToNode: (
    tree: SpecTree,
    identity: SpecNodeIdentity,
  ): readonly SpecNodeType[] => {
    /**
     * Recursively walks nodes, tracking the ancestor path taken so far.
     * @param nodes - Sibling nodes to search at the current depth.
     * @param ancestors - Path of nodes visited from the root to this depth.
     * @returns The path to the matching node, or an empty array when not found in this subtree.
     */
    const visit = (
      nodes: readonly SpecNodeType[],
      ancestors: readonly SpecNodeType[],
    ): readonly SpecNodeType[] => {
      for (const node of nodes) {
        const path = [...ancestors, node];

        if (
          node.sourceGroupId === identity.sourceGroupId &&
          node.relativeId === identity.relativeId
        ) {
          return path;
        }

        const childPath = visit(node.children, path);

        if (childPath.length > 0) {
          return childPath;
        }
      }

      return [];
    };

    return visit(tree.specs, []);
  },

  /**
   * Returns the first openable spec node.
   * @param tree - Spec tree to inspect.
   * @returns The first openable spec node, or null when the tree has none.
   */
  defaultNode: (tree: SpecTree): SpecNodeType | null =>
    SpecNode.firstOpenable(tree.specs),

  /**
   * Preserves an openable preferred selection or falls back to a spec.
   * @param tree - Spec tree to resolve the selection against.
   * @param preferred - Previously selected spec id and file key, either of which may be null.
   * @returns The preferred spec and a valid file key when the preferred spec is still openable;
   * otherwise the tree's default spec and its first file key.
   */
  resolveSelection: (
    tree: SpecTree,
    preferred: Readonly<{
      specId: string | null;
      fileKey: SpecFileKey | null;
    }>,
  ): SpecSelection => {
    if (preferred.specId !== null) {
      const preferredSpec = SpecTree.findNode(tree, preferred.specId);

      if (preferredSpec !== null && SpecNode.isOpenable(preferredSpec)) {
        return {
          spec: preferredSpec,
          fileKey: SpecNode.preservedFileKey(preferredSpec, preferred.fileKey),
        };
      }
    }

    const defaultSpec = SpecTree.defaultNode(tree);

    return {
      spec: defaultSpec,
      fileKey: SpecNode.firstFileKey(defaultSpec),
    };
  },
} as const;
