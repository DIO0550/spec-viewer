import type { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
import type { SpecTreeState } from "@/features/specs/domain/specTreeState";
import type { SpecsSelectors } from "@/features/specs/hooks/useSpecs/selectors";
import type { SpecFileKey } from "@/features/specs/types/spec";
import type { IpcCommandError } from "@/shared/types/ipc";

export type SpecSelectionState = Readonly<{
  specId: string | null;
  fileKey: SpecFileKey | null;
}>;

export type SpecsState = Readonly<{
  specTreeState: SpecTreeState;
  documentState: SpecDocumentState;
  selection: SpecSelectionState;
  isLoading: boolean;
  activeOperationId: string | null;
  archivingSpecId: string | null;
  archiveSpecError: IpcCommandError | null;
}>;

export type SpecsActions = Readonly<{
  archiveSpec: (specId: string) => Promise<boolean>;
  reloadSpecs: () => Promise<boolean>;
  selectSpec: (specId: string) => Promise<void>;
  selectFileKey: (fileKey: SpecFileKey) => Promise<void>;
  reloadDocument: () => Promise<boolean>;
  resetSelection: () => void;
}>;

export type UseSpecsResult = Readonly<{
  state: SpecsState;
  actions: SpecsActions;
  selectors: SpecsSelectors;
}>;
