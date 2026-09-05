import { SpecArtifact as SpecArtifactDomain } from "@/features/specs/domain/specArtifact";
import { SpecNode as SpecNodeDomain } from "@/features/specs/domain/specNode";
import { SpecTree as SpecTreeDomain } from "@/features/specs/domain/specTree";
import type { SpecsState } from "@/features/specs/hooks/useSpecs/types";
import type {
  SpecArtifact,
  SpecFile,
  SpecNode,
} from "@/features/specs/types/spec";

export type SpecsSelectors = Readonly<{
  selectedSpec: SpecNode | null;
  selectedFile: SpecFile | null;
  selectedArtifact: SpecArtifact | null;
  isLoading: boolean;
  canReloadDocument: boolean;
}>;

/**
 * @param state - The current specs hook state.
 * @returns Derived values for the current specs hook state.
 */
export function buildSpecsSelectors(state: SpecsState): SpecsSelectors {
  const tree = state.specTreeState.tree;
  const selectedSpec =
    tree === null || state.selection.specId === null
      ? null
      : SpecTreeDomain.findNode(tree, state.selection.specId);
  const selectedFile = SpecNodeDomain.selectedFile(
    selectedSpec,
    state.selection.fileKey,
  );
  const selectedIdentity = state.selection.artifactIdentity;
  const selectedArtifact =
    selectedIdentity === null || state.bundleState.bundle === null
      ? null
      : (state.bundleState.bundle.artifacts.find(
          (artifact) =>
            SpecArtifactDomain.stableId(artifact.identity) ===
            SpecArtifactDomain.stableId(selectedIdentity),
        ) ?? null);

  return {
    selectedSpec,
    selectedFile,
    selectedArtifact,
    isLoading: state.isLoading,
    canReloadDocument: state.selection.specId !== null && !state.isLoading,
  };
}
