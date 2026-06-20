import type { ReactNode } from "react";

import type {
  SpecViewSelectionId as SpecViewSelectionIdType,
  SpecViewSelectionIdInput,
  SpecViewTargetScope,
} from "@/features/specs/domain/specViewSelectionId";

export type SpecViewSelection = SpecViewSelectionIdInput;

export type SpecViewSelectionInput = Pick<
  SpecViewSelection,
  "workspacePath" | "specId" | "fileKey"
>;

export type SpecViewSelectionContextValue = Readonly<{
  selection: SpecViewSelection;
  selectionId: SpecViewSelectionIdType;
  selectSpecView: (selection: SpecViewSelectionInput) => void;
  setTargetScope: (targetScope: SpecViewTargetScope) => void;
}>;

export type SpecViewSelectionProviderProps = Readonly<{
  children: ReactNode;
}>;
