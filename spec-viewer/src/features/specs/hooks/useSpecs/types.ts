import type { OperationId } from "@/features/specs/domain/operationId";
import type { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
import type { SpecFeatureError } from "@/features/specs/domain/specError";
import type { SpecTreeState } from "@/features/specs/domain/specTreeState";
import type { SpecsSelectors } from "@/features/specs/hooks/useSpecs/selectors";
import type {
  ArchiveSpecResponse,
  SpecFileKey,
} from "@/features/specs/types/spec";

export type ArchiveFailure = Readonly<{
  specId: string;
  error: SpecFeatureError;
}>;

export type ArchiveRevealState = Readonly<{
  status: "success" | "missing";
  workspacePath: string;
  response: ArchiveSpecResponse;
}>;

export type SpecSelectionState = Readonly<{
  specId: string | null;
  fileKey: SpecFileKey | null;
}>;

export type SpecsState = Readonly<{
  specTreeState: SpecTreeState;
  documentState: SpecDocumentState;
  selection: SpecSelectionState;
  isLoading: boolean;
  activeOperationId: OperationId | null;
  archivingSpecId: string | null;
  archiveSpecError: SpecFeatureError | null;
  archiveFailure: ArchiveFailure | null;
  archiveReveal: ArchiveRevealState | null;
}>;

export type SpecsActions = Readonly<{
  /** Archives a spec. @param specId - ID of the spec to archive. */
  archiveSpec: (specId: string) => Promise<boolean>;
  /** Retries the failed archive operation for the same spec. */
  retryArchiveSpec: () => Promise<boolean>;
  /** Reloads after an archive destination could not be revealed. */
  refreshArchiveReveal: () => Promise<boolean>;
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
