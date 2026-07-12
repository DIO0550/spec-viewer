import type {
  SpecDocumentFeatureState,
  SpecFeatureError,
  SpecTreeFeatureState,
} from "@/features/specs/application/specError";
import type { SpecsSelectors } from "@/features/specs/hooks/useSpecs/selectors";
import type { SpecFileKey } from "@/shared/domain/specFileKey";

export type SpecSelectionState = Readonly<{
  specId: string | null;
  fileKey: SpecFileKey | null;
}>;

export type SpecsState = Readonly<{
  specTreeState: SpecTreeFeatureState;
  documentState: SpecDocumentFeatureState;
  selection: SpecSelectionState;
  isLoading: boolean;
  activeOperationId: string | null;
  archivingSpecId: string | null;
  archiveSpecError: SpecFeatureError | null;
}>;

export type SpecsActions = Readonly<{
  /** Archives a spec. @param specId - ID of the spec to archive. */
  archiveSpec: (specId: string) => Promise<boolean>;
  /** Reloads the spec tree. */
  reloadSpecs: () => Promise<boolean>;
  /** Selects a spec. @param specId - ID of the spec to select. */
  selectSpec: (specId: string) => Promise<void>;
  /** Selects a file. @param fileKey - Key of the file to select. */
  selectFileKey: (fileKey: SpecFileKey) => Promise<void>;
  /** Reloads the current document. */
  reloadDocument: () => Promise<boolean>;
  /** Resets the current spec/file selection. */
  resetSelection: () => void;
}>;

export type UseSpecsResult = Readonly<{
  state: SpecsState;
  actions: SpecsActions;
  selectors: SpecsSelectors;
}>;
