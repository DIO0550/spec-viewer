import { SpecTree } from "@/features/specs/domain/specTree";
import type {
  SpecFileKey,
  SpecFileScope,
  SpecTree as SpecTreeValue,
} from "@/features/specs/types/spec";

/**
 * Resolves an external changed-file identity through the loaded Spec tree.
 *
 * @param tree - Current authoritative Spec tree.
 * @param workspacePath - Active workspace, or null while closed.
 * @param specId - External Spec ID.
 * @param fileKey - External logical file key.
 * @returns A typed selection using the actual file key, or null when invalid.
 */
export function resolveSpecFileSelection(
  tree: SpecTreeValue | null,
  workspacePath: string | null,
  specId: string,
  fileKey: string,
): SpecFileScope | null {
  if (tree === null || workspacePath === null) {
    return null;
  }

  const spec = SpecTree.findNode(tree, specId);
  if (spec === null) {
    return null;
  }

  const file = spec.files.find((candidate) => candidate.key === fileKey);
  if (file === undefined) {
    return null;
  }

  return {
    workspacePath,
    specId: spec.id,
    fileKey: file.key satisfies SpecFileKey,
  };
}
