import type { SpecFileKey } from "@/features/specs/domain/specFile";
import type { SpecId } from "@/shared/domain/specId";
import {
  SpecNode,
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
  /**  Spec tree restored from validated boundary nodes. */
  create(specs: readonly SpecNodeType[]): SpecTree {
    return { specs: [...specs] };
  },

  /**
   *  tree - Spec tree to inspect
   *  True when the tree has no root specs.
   */
  isEmpty: (tree: SpecTree): boolean => tree.specs.length === 0,

  /**
   * @param tree - Spec tree to search
   * @param specId - Spec node id to find
   * @returns Matching node, or null when absent.
   */
  findNode: (tree: SpecTree, specId: SpecId): SpecNodeType | null =>
    SpecNode.findById(tree.specs, specId),

  /**
   * @param tree - Spec tree to inspect
   * @returns Default openable node, or null when the tree is empty.
   */
  defaultNode: (tree: SpecTree): SpecNodeType | null =>
    SpecNode.firstOpenable(tree.specs),

  /**
   * @param tree - Spec tree containing candidate nodes
   * @param preferred - Preferred spec and file selection
   * @returns Resolved selection after preserving or falling back.
   */
  resolveSelection: (
    tree: SpecTree,
    preferred: Readonly<{ specId: SpecId | null; fileKey: SpecFileKey | null }>,
  ): SpecSelection => {
    if (preferred.specId !== null) {
      const preferredSpec = SpecTree.findNode(tree, preferred.specId);

      if (preferredSpec !== null) {
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
