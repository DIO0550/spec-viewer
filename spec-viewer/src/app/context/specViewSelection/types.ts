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
  selectSpecView: (selection: SpecViewSelectionInput) => void;
  setTargetScope: (targetScope: SpecViewTargetScope) => void;
}>;

export type SpecViewSelectionProviderProps = Readonly<{
  children: ReactNode;
}>;
