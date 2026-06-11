import type {
  SpecFile,
  SpecFileKey,
  SpecNode,
  SpecTree,
} from "@/features/specs/types/spec";

export type ReloadedSelection = Readonly<{
  spec: SpecNode | null;
  fileKey: SpecFileKey | null;
}>;

type ResolveReloadedSelectionInput = Readonly<{
  tree: SpecTree;
  preserveSelection: boolean;
  selectedSpecId: string | null;
  selectedFileKey: SpecFileKey | null;
}>;

export const SpecCollection = {
  /**
   * @param nodes - Spec nodes to search recursively
   * @param id - Spec id to find
   * @returns Matching spec node from a nested tree, or null when absent.
   */
  findNode(nodes: readonly SpecNode[], id: string): SpecNode | null {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }

      const child = SpecCollection.findNode(node.children, id);

      if (child !== null) {
        return child;
      }
    }

    return null;
  },
  /**
   * @param nodes - Spec nodes to search recursively
   * @returns First spec node that can open a file, falling back to the first node.
   */
  findDefaultNode(nodes: readonly SpecNode[]): SpecNode | null {
    const firstNode = nodes[0] ?? null;

    for (const node of nodes) {
      if (node.files.length > 0) {
        return node;
      }

      const child = SpecCollection.findDefaultNode(node.children);

      if (child !== null && child.files.length > 0) {
        return child;
      }
    }

    return firstNode;
  },
  /**
   * @param spec - Spec node owning the files, or null
   * @param fileKey - Selected file key, or null
   * @returns The selected spec file, or null when unavailable.
   */
  findFile(
    spec: SpecNode | null,
    fileKey: SpecFileKey | null,
  ): SpecFile | null {
    if (spec === null || fileKey === null) {
      return null;
    }

    return spec.files.find((file) => file.key === fileKey) ?? null;
  },
  /**
   * @param input - Refreshed tree and the previous selection to preserve
   * @returns Selection to use after refreshing the spec tree.
   */
  resolveReloadedSelection({
    tree,
    preserveSelection,
    selectedSpecId,
    selectedFileKey,
  }: ResolveReloadedSelectionInput): ReloadedSelection {
    if (preserveSelection && selectedSpecId !== null) {
      const preservedSpec = SpecCollection.findNode(tree.specs, selectedSpecId);

      if (preservedSpec !== null) {
        return {
          spec: preservedSpec,
          fileKey: findPreservedFileKey(preservedSpec, selectedFileKey),
        };
      }
    }

    const defaultSpec = SpecCollection.findDefaultNode(tree.specs);

    return {
      spec: defaultSpec,
      fileKey: defaultSpec?.files[0]?.key ?? null,
    };
  },
} as const;

/**
 * @param spec - Preserved spec node after a tree refresh
 * @param selectedFileKey - Previously selected file key, or null
 * @returns Current file key when still present, otherwise the first file key.
 */
function findPreservedFileKey(
  spec: SpecNode,
  selectedFileKey: SpecFileKey | null,
): SpecFileKey | null {
  if (
    selectedFileKey !== null &&
    spec.files.some((file) => file.key === selectedFileKey)
  ) {
    return selectedFileKey;
  }

  return spec.files[0]?.key ?? null;
}
