import { useCallback, useMemo, useState } from "react";

import type {
  SpecViewSelectionContextValue,
  SpecViewSelectionInput,
} from "@/app/context/specViewSelection/types";
import {
  createSpecViewSelectionId,
  type SpecViewSelection,
  type SpecViewTargetScope,
} from "@/app/context/specViewSelection/selectionId";

const defaultSelection: SpecViewSelection = {
  workspacePath: null,
  specId: null,
  fileKey: null,
  targetScope: "file",
};

/** @returns Review-run snapshot synchronized from the canonical specs selection. */
export function useSpecViewSelectionState(): SpecViewSelectionContextValue {
  const [selection, setSelection] =
    useState<SpecViewSelection>(defaultSelection);
  const selectionId = useMemo(
    () => createSpecViewSelectionId(selection),
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
