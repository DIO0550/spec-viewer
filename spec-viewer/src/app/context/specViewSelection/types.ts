import type { ReactNode } from "react";

import type {
  SpecViewSelection,
  SpecViewSelectionId,
  SpecViewTargetScope,
} from "@/app/context/specViewSelection/selectionId";

export type SpecViewSelectionInput = Pick<
  SpecViewSelection,
  "workspacePath" | "specId" | "fileKey"
>;

export type SpecViewSelectionContextValue = Readonly<{
  selection: SpecViewSelection;
  selectionId: SpecViewSelectionId;
  /**
   * Selects the spec view for the given workspace, spec and file.
   * @param selection - The spec view selection to activate.
   */
  selectSpecView: (selection: SpecViewSelectionInput) => void;
  /**
   * Sets the current target scope of the selection.
   * @param targetScope - The target scope to apply.
   */
  setTargetScope: (targetScope: SpecViewTargetScope) => void;
}>;

export type SpecViewSelectionProviderProps = Readonly<{
  children: ReactNode;
}>;
