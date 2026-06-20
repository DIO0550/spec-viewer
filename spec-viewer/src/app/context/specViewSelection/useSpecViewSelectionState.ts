import { useCallback, useMemo, useState } from "react";

import type {
  SpecViewSelection,
  SpecViewSelectionContextValue,
  SpecViewSelectionInput,
} from "@/app/context/specViewSelection/types";
import {
  SpecViewSelectionId,
  type SpecViewTargetScope,
} from "@/features/specs/domain/specViewSelectionId";

const defaultSelection: SpecViewSelection = {
  workspacePath: null,
  specId: null,
  fileKey: null,
  targetScope: "file",
};

/** @returns Context value for the current spec view selection. */
export function useSpecViewSelectionState(): SpecViewSelectionContextValue {
  const [selection, setSelection] =
    useState<SpecViewSelection>(defaultSelection);
  const selectionId = useMemo(
    () => SpecViewSelectionId.create(selection),
    [
      selection.fileKey,
      selection.specId,
      selection.targetScope,
      selection.workspacePath,
    ],
  );
  const selectSpecView = useCallback(
    (nextSpecViewSelection: SpecViewSelectionInput): void => {
      setSelection((current) => ({
        ...current,
        ...nextSpecViewSelection,
        targetScope: "file",
      }));
    },
    [],
  );
  const setTargetScope = useCallback(
    (targetScope: SpecViewTargetScope): void => {
      setSelection((current) => ({
        ...current,
        targetScope,
      }));
    },
    [],
  );

  return useMemo(
    () => ({
      selection,
      selectionId,
      selectSpecView,
      setTargetScope,
    }),
    [selection, setTargetScope, selectSpecView, selectionId],
  );
}
