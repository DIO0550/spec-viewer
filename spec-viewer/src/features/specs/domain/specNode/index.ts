import type { SpecProgress } from "@/features/specs/domain/specArtifact";
import {
  SpecFile,
  type SpecFileKey,
  type SpecFile as SpecFileType,
} from "@/features/specs/domain/specFile";

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
  /**
   * Finds a node by its legacy global id.
   * @param nodes - Node list to search, including descendants.
   * @param id - Legacy global id to match against `node.id`.
   * @returns The matching node, or null when no node has the given id.
   */
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

  /**
   * Finds a node by its stable source-group-relative identity.
   * @param nodes - Node list to search, including descendants.
   * @param identity - Source-group-relative identity to match.
   * @returns The matching node, or null when no node has the given identity.
   */
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

  /**
   * Returns whether the node may open logical documents.
   * @param node - Node to inspect.
   * @returns True when the node's kind is "spec".
   */
  isOpenable: (node: SpecNode): boolean => node.kind === "spec",

  /**
   * Returns whether the node may be moved into Archive.
   * @param node - Node to inspect.
   * @returns True when the node's kind is "spec".
   */
  isArchivable: (node: SpecNode): boolean => node.kind === "spec",

  /**
   * Returns the semantic count rendered for this node kind.
   * @param node - Node to inspect.
   * @returns `presentDocumentCount` for spec nodes, otherwise `descendantSpecCount`.
   */
  count: (node: SpecNode): number =>
    node.kind === "spec" ? node.presentDocumentCount : node.descendantSpecCount,

  /**
   * Returns the first node, or null when empty.
   * @param nodes - Node list to read from.
   * @returns The first node in the list, or null when the list is empty.
   */
  first: (nodes: readonly SpecNode[]): SpecNode | null => nodes[0] ?? null,

  /**
   * Returns the first openable spec node without selecting containers.
   * @param nodes - Node list to search, including descendants.
   * @returns The first openable spec node found in document order, or null when none exists.
   */
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

  /**
   * Returns the selected logical file, or null when absent.
   * @param node - Node to read files from, or null when nothing is selected.
   * @param fileKey - Key of the logical file to look up.
   * @returns The matching logical file, or null when the node is not openable or has no such file.
   */
  selectedFile: (
    node: SpecNode | null,
    fileKey: SpecFileKey | null,
  ): SpecFileType | null => {
    if (node === null || !SpecNode.isOpenable(node)) {
      return null;
    }

    return SpecFile.findByKey(node.files, fileKey);
  },

  /**
   * Returns the first logical file key for an openable spec.
   * @param node - Node to read files from, or null when nothing is selected.
   * @returns The first logical file key, or null when the node is not openable or has no files.
   */
  firstFileKey: (node: SpecNode | null): SpecFileKey | null => {
    if (node === null || !SpecNode.isOpenable(node)) {
      return null;
    }

    return SpecFile.firstKey(node.files);
  },

  /**
   * Preserves a valid key or falls back to the first logical file.
   * @param node - Node to read files from.
   * @param selectedFileKey - Previously selected file key, or null when none.
   * @returns `selectedFileKey` when it exists on `node`, otherwise the first logical file key.
   */
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
