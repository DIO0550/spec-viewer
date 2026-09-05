import { useCallback, useMemo, useState } from "react";

import type {
  SpecViewSelectionContextValue,
  SpecViewSelectionInput,
} from "@/app/context/specViewSelection/types";
import {
  SelectionIdentity,
  SpecViewSelection,
  type SpecViewSelection as SpecViewSelectionType,
  type SpecViewTargetScope,
} from "@/features/specs/domain/specViewSelection";

/** @returns React adapter for the spec view selection aggregate. */
export function useSpecViewSelectionState(): SpecViewSelectionContextValue {
  const [selection, setSelection] = useState<SpecViewSelectionType>(
    SpecViewSelection.empty,
  );
  const selectionIdentity = useMemo(
    () => SelectionIdentity.fromSelection(selection),
    [
      selection.fileKey,
      selection.specId,
      selection.targetScope,
      selection.workspacePath,
    ],
  );
  const synchronizeSelection = useCallback(
    (nextSelection: SpecViewSelectionInput): void => {
      setSelection((current) =>
        SpecViewSelection.synchronize(current, nextSelection),
      );
    },
    [],
  );
  const selectTargetScope = useCallback(
    (targetScope: SpecViewTargetScope): void => {
      setSelection((current) =>
        SpecViewSelection.selectTargetScope(current, targetScope),
      );
    },
    [],
  );

  return useMemo(
    () => ({
      selection,
      selectionIdentity,
      synchronizeSelection,
      selectTargetScope,
    }),
    [selection, selectionIdentity, selectTargetScope, synchronizeSelection],
  );
}
