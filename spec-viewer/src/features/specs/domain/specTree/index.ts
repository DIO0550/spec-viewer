import type { SpecFileKey } from "@/features/specs/domain/specFile";
import {
  SpecNode,
  type SpecNode as SpecNodeType,
  type SpecNodeIdentity,
} from "@/features/specs/domain/specNode";

export type SpecTree = Readonly<{
  specs: readonly SpecNodeType[];
}>;

export type SpecSelection = Readonly<{
  spec: SpecNodeType | null;
  fileKey: SpecFileKey | null;
}>;

export const SpecTree = {
  /** Returns true when no openable spec exists in the projection. */
  isEmpty: (tree: SpecTree): boolean =>
    SpecNode.firstOpenable(tree.specs) === null,

  /** Finds a node by its legacy global id. */
  findNode: (tree: SpecTree, specId: string): SpecNodeType | null =>
    SpecNode.findById(tree.specs, specId),

  /** Finds a node by its stable composite identity. */
  findNodeByIdentity: (
    tree: SpecTree,
    identity: SpecNodeIdentity,
  ): SpecNodeType | null => SpecNode.findByIdentity(tree.specs, identity),

  /** Returns the path from a root to the matching composite identity. */
  findPathToNode: (
    tree: SpecTree,
    identity: SpecNodeIdentity,
  ): readonly SpecNodeType[] => {
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

  /** Returns the first openable spec node. */
  defaultNode: (tree: SpecTree): SpecNodeType | null =>
    SpecNode.firstOpenable(tree.specs),

  /** Preserves an openable preferred selection or falls back to a spec. */
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
