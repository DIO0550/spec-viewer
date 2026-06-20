import type { ReactNode } from "react";

import type {
  SpecViewSelectionKey as SpecViewSelectionKeyType,
  SpecViewSelectionKeyInput,
  SpecViewTargetScope,
} from "@/features/specs/domain/specViewSelectionKey";

export type SpecViewSelection = SpecViewSelectionKeyInput;

export type SpecViewWorkspaceSelectionInput = Pick<
  SpecViewSelection,
  "workspacePath" | "specId" | "fileKey"
>;

export type SpecViewSelectionContextValue = Readonly<{
  selection: SpecViewSelection;
  selectionKey: SpecViewSelectionKeyType;
  setWorkspaceSelection: (selection: SpecViewWorkspaceSelectionInput) => void;
  setTargetScope: (targetScope: SpecViewTargetScope) => void;
}>;

export type SpecViewSelectionProviderProps = Readonly<{
  children: ReactNode;
}>;
