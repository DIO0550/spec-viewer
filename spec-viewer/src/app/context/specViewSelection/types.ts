import type { ReactNode } from "react";

import type {
  SelectionIdentity,
  SpecViewSelection,
  SpecViewSelectionInput,
  SpecViewTargetScope,
} from "@/features/specs/domain/specViewSelection";

export type SpecViewSelectionContextValue = Readonly<{
  selection: SpecViewSelection;
  selectionIdentity: SelectionIdentity;
  /**
   * Synchronizes the aggregate from the canonical specs snapshot.
   * @param selection - Latest workspace, spec, and file selection.
   */
  synchronizeSelection: (selection: SpecViewSelectionInput) => void;
  /**
   * Selects the current review target scope.
   * @param targetScope - The target scope to apply.
   */
  selectTargetScope: (targetScope: SpecViewTargetScope) => void;
}>;

export type { SpecViewSelectionInput };

export type SpecViewSelectionProviderProps = Readonly<{
  children: ReactNode;
}>;
