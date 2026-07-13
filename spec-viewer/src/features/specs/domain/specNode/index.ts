import {
  SpecFile,
  type SpecFile as SpecFileType,
  type SpecFileKey,
} from "@/features/specs/domain/specFile";
import {
  SpecFileCollection,
  type SpecFileCollection as SpecFileCollectionType,
} from "@/features/specs/domain/specFileCollection";
import type { SpecId } from "@/shared/domain/specId";

export type SpecNodeKind = "sourceGroup" | "spec";
export type SpecNodeCapabilities = Readonly<{
  reviewable: boolean;
  archiveable: boolean;
}>;

export type SpecNode = Readonly<{
  id: SpecId;
  label: string;
  kind: SpecNodeKind;
  capabilities: SpecNodeCapabilities;
  files: SpecFileCollectionType;
  children: readonly SpecNode[];
}>;

export const SpecNode = {
  /** @returns Spec node restored from validated boundary values. */
  create(input: SpecNode): SpecNode {
    return {
      ...input,
      files: SpecFileCollection.create(input.files),
      children: [...input.children],
    };
  },

  /**
   * @param nodes - Candidate spec nodes
   * @param id - Spec node id to find
   * @returns Matching spec node from the nested tree, or null when absent.
   */
  findById: (nodes: readonly SpecNode[], id: SpecId): SpecNode | null => {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }

      const child = SpecNode.findById(node.children, id);

      if (child !== null) {
        return child;
      }
    }

    return null;
  },

  /**
   * @param nodes - Candidate spec nodes
   * @returns First spec node, or null when empty.
   */
  first: (nodes: readonly SpecNode[]): SpecNode | null => nodes[0] ?? null,

  /**
   * @param nodes - Candidate spec nodes
   * @returns First node with files, falling back to the first node.
   */
  firstOpenable: (nodes: readonly SpecNode[]): SpecNode | null => {
    const firstNode = SpecNode.first(nodes);

    for (const node of nodes) {
      if (node.capabilities.reviewable) {
        return node;
      }

      const child = SpecNode.firstOpenable(node.children);

      if (child !== null && child.capabilities.reviewable) {
        return child;
      }
    }

    return firstNode;
  },

  /**
   * @param node - Spec node to inspect
   * @param fileKey - File key to select
   * @returns Matching file from the node, or null when absent.
   */
  selectedFile: (
    node: SpecNode | null,
    fileKey: SpecFileKey | null,
  ): SpecFileType | null => {
    if (node === null) {
      return null;
    }

    return SpecFile.findByKey(node.files, fileKey);
  },

  /**
   * @param node - Spec node to inspect
   * @returns First file key from the node, or null when absent.
   */
  firstFileKey: (node: SpecNode | null): SpecFileKey | null => {
    if (node === null) {
      return null;
    }

    return SpecFile.firstKey(node.files);
  },

  /**
   * @param node - Spec node whose files define valid keys
   * @param selectedFileKey - Previously selected file key
   * @returns Preserved key when still present, otherwise the first file key.
   */
  preservedFileKey: (
    node: SpecNode,
    selectedFileKey: SpecFileKey | null,
  ): SpecFileKey | null => {
    if (SpecFile.hasKey(node.files, selectedFileKey)) {
      return selectedFileKey;
    }

    return SpecFile.firstKey(node.files);
  },
} as const;
