import {
  SpecFile,
  type SpecFile as SpecFileType,
  type SpecFileKey,
} from "@/features/specs/domain/specFile";
import type { SpecProgress } from "@/features/specs/domain/specArtifact";

export type SpecNodeKind = "spec" | "category" | "archive" | "sourceGroup";

export type SpecNodeIdentity = Readonly<{
  sourceGroupId: string;
  relativeId: string;
}>;

export type SpecNode = Readonly<{
  id: string;
  label: string;
  kind: SpecNodeKind;
  sourceGroupId: string;
  relativeId: string;
  presentDocumentCount: number;
  descendantSpecCount: number;
  progress?: SpecProgress;
  files: readonly SpecFileType[];
  children: readonly SpecNode[];
}>;

export const SpecNode = {
  /** Finds a node by its legacy global id. */
  findById: (nodes: readonly SpecNode[], id: string): SpecNode | null => {
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

  /** Finds a node by its stable source-group-relative identity. */
  findByIdentity: (
    nodes: readonly SpecNode[],
    identity: SpecNodeIdentity,
  ): SpecNode | null => {
    for (const node of nodes) {
      if (
        node.sourceGroupId === identity.sourceGroupId &&
        node.relativeId === identity.relativeId
      ) {
        return node;
      }

      const child = SpecNode.findByIdentity(node.children, identity);

      if (child !== null) {
        return child;
      }
    }

    return null;
  },

  /** Returns whether the node may open logical documents. */
  isOpenable: (node: SpecNode): boolean => node.kind === "spec",

  /** Returns whether the node may be moved into Archive. */
  isArchivable: (node: SpecNode): boolean => node.kind === "spec",

  /** Returns the semantic count rendered for this node kind. */
  count: (node: SpecNode): number =>
    node.kind === "spec" ? node.presentDocumentCount : node.descendantSpecCount,

  /** Returns the first node, or null when empty. */
  first: (nodes: readonly SpecNode[]): SpecNode | null => nodes[0] ?? null,

  /** Returns the first openable spec node without selecting containers. */
  firstOpenable: (nodes: readonly SpecNode[]): SpecNode | null => {
    for (const node of nodes) {
      if (SpecNode.isOpenable(node)) {
        return node;
      }

      const child = SpecNode.firstOpenable(node.children);

      if (child !== null) {
        return child;
      }
    }

    return null;
  },

  /** Returns the selected logical file, or null when absent. */
  selectedFile: (
    node: SpecNode | null,
    fileKey: SpecFileKey | null,
  ): SpecFileType | null => {
    if (node === null || !SpecNode.isOpenable(node)) {
      return null;
    }

    return SpecFile.findByKey(node.files, fileKey);
  },

  /** Returns the first logical file key for an openable spec. */
  firstFileKey: (node: SpecNode | null): SpecFileKey | null => {
    if (node === null || !SpecNode.isOpenable(node)) {
      return null;
    }

    return SpecFile.firstKey(node.files);
  },

  /** Preserves a valid key or falls back to the first logical file. */
  preservedFileKey: (
    node: SpecNode,
    selectedFileKey: SpecFileKey | null,
  ): SpecFileKey | null => {
    if (!SpecNode.isOpenable(node)) {
      return null;
    }

    if (SpecFile.hasKey(node.files, selectedFileKey)) {
      return selectedFileKey;
    }

    return SpecFile.firstKey(node.files);
  },
} as const;
