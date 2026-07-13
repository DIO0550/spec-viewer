import type { SpecFileKey } from "@/features/specs/domain/specFile";
import { SpecId } from "@/shared/domain/specId";
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

export type SpecArchiveabilityReason =
  | "sourceGroup"
  | "container"
  | "notArchiveable"
  | "unknown";
export type SpecArchiveability =
  | Readonly<{ canArchive: true; reason: null }>
  | Readonly<{
      canArchive: false;
      reason: SpecArchiveabilityReason;
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
  find: (tree: SpecTree, specId: SpecId): SpecNodeType | null =>
    SpecNode.findById(tree.specs, specId),

  /**
   * @param tree - Spec tree to inspect.
   * @param specId - Selected node id.
   * @returns Ancestor ids in root-to-parent order, or an empty list when absent.
   */
  ancestorIds(tree: SpecTree, specId: SpecId): readonly SpecId[] {
    return findAncestorIds(tree.specs, specId) ?? [];
  },

  /**
   * @param tree - Spec tree to inspect.
   * @param specId - Candidate archive target id.
   * @returns Typed archive eligibility aligned with backend SpecArchivePolicy.
   */
  archiveability(tree: SpecTree, specId: SpecId): SpecArchiveability {
    const node = SpecTree.find(tree, specId);
    if (node === null) {
      return containsStrictDescendant(tree.specs, specId)
        ? { canArchive: false, reason: "container" }
        : { canArchive: false, reason: "unknown" };
    }

    return SpecTree.nodeArchiveability(node);
  },

  /**
   * @param node - A node known to belong to the rendered tree.
   * @returns Typed archive eligibility without re-scanning the tree.
   */
  nodeArchiveability(node: SpecNodeType): SpecArchiveability {
    if (node.kind === "sourceGroup") {
      return { canArchive: false, reason: "sourceGroup" };
    }

    if (!node.capabilities.archiveable) {
      return { canArchive: false, reason: "notArchiveable" };
    }

    return { canArchive: true, reason: null };
  },

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
      const preferredSpec = SpecTree.find(tree, preferred.specId);

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

/**
 * @param nodes - Candidate nodes for the selected id.
 * @param specId - Selected node id.
 * @param ancestors - Ancestors accumulated in root order.
 * @returns Ancestor ids when found, or null when absent.
 */
function findAncestorIds(
  nodes: readonly SpecNodeType[],
  specId: SpecId,
  ancestors: readonly SpecId[] = [],
): readonly SpecId[] | null {
  for (const node of nodes) {
    if (node.id === specId) {
      return ancestors;
    }

    const childAncestors = findAncestorIds(node.children, specId, [
      ...ancestors,
      node.id,
    ]);
    if (childAncestors !== null) {
      return childAncestors;
    }
  }

  return null;
}

/**
 * @param nodes - Candidate scanned nodes.
 * @param candidateId - Candidate container id.
 * @returns True when the candidate is a strict ancestor of a scanned node.
 */
function containsStrictDescendant(
  nodes: readonly SpecNodeType[],
  candidateId: SpecId,
): boolean {
  for (const node of nodes) {
    if (SpecId.isStrictAncestorOf(candidateId, node.id)) {
      return true;
    }

    if (containsStrictDescendant(node.children, candidateId)) {
      return true;
    }
  }

  return false;
}
