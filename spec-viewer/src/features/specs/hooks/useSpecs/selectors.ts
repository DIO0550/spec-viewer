import { SpecNode as SpecNodeDomain } from "@/features/specs/domain/specNode";
import { SpecTree as SpecTreeDomain } from "@/features/specs/domain/specTree";
import type { SpecsState } from "@/features/specs/hooks/useSpecs/types";
import type { SpecFile, SpecNode } from "@/features/specs/types/spec";

export type SpecsSelectors = Readonly<{
  selectedSpec: SpecNode | null;
  selectedFile: SpecFile | null;
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
      : SpecTreeDomain.find(tree, state.selection.specId);
  const selectedFile = SpecNodeDomain.selectedFile(
    selectedSpec,
    state.selection.fileKey,
  );

  return {
    selectedSpec,
    selectedFile,
    isLoading: state.isLoading,
    canReloadDocument:
      state.selection.specId !== null &&
      state.selection.fileKey !== null &&
      !state.isLoading,
  };
}
