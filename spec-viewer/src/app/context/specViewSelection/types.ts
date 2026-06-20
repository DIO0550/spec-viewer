import type { ReactNode } from "react";

import type {
  SpecViewSelectionId as SpecViewSelectionIdType,
  SpecViewSelectionIdInput,
  SpecViewTargetScope,
} from "@/features/specs/domain/specViewSelectionId";

export type SpecViewSelection = SpecViewSelectionIdInput;

export type SpecViewWorkspaceSelectionInput = Pick<
  SpecViewSelection,
  "workspacePath" | "specId" | "fileKey"
>;

export type SpecViewSelectionContextValue = Readonly<{
  selection: SpecViewSelection;
  selectionId: SpecViewSelectionIdType;
  setWorkspaceSelection: (selection: SpecViewWorkspaceSelectionInput) => void;
  setTargetScope: (targetScope: SpecViewTargetScope) => void;
}>;

export type SpecViewSelectionProviderProps = Readonly<{
  children: ReactNode;
}>;
