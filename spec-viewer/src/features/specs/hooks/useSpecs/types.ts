import type {
  SpecSelectionState,
  SpecsState,
} from "@/features/specs/application/specsState";
import type { SpecsSelectors } from "@/features/specs/hooks/useSpecs/selectors";
import type { SpecFileKey } from "@/shared/domain/specFileKey";
import type { SpecId } from "@/shared/domain/specId";

export type { SpecSelectionState, SpecsState };

export type SpecsActions = Readonly<{
  /** Archives a spec. @param specId - ID of the spec to archive. */
  archiveSpec: (specId: SpecId) => Promise<boolean>;
  /** Reloads the spec tree. */
  reloadSpecs: () => Promise<boolean>;
  /** Selects a spec. @param specId - ID of the spec to select. */
  selectSpec: (specId: SpecId) => Promise<void>;
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
