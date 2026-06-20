import type { ReactNode } from "react";

import type {
  SpecViewIdentity as SpecViewIdentityType,
  SpecViewIdentityInput,
  SpecViewTargetScope,
} from "@/features/specs/domain/specViewIdentity";

export type SpecViewSelection = SpecViewIdentityInput;

export type SpecViewWorkspaceSelectionInput = Pick<
  SpecViewSelection,
  "workspacePath" | "specId" | "fileKey"
>;

export type SpecViewIdentityContextValue = Readonly<{
  selection: SpecViewSelection;
  viewIdentity: SpecViewIdentityType;
  setWorkspaceSelection: (selection: SpecViewWorkspaceSelectionInput) => void;
  setTargetScope: (targetScope: SpecViewTargetScope) => void;
}>;

export type SpecViewIdentityProviderProps = Readonly<{
  children: ReactNode;
}>;
