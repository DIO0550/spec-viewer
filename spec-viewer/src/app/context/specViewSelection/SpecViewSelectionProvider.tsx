import { useCallback, useMemo, useState, type ReactElement } from "react";

import { SpecViewSelectionContext } from "@/app/context/specViewSelection/context";
import type {
  SpecViewSelectionProviderProps,
  SpecViewSelection,
  SpecViewWorkspaceSelectionInput,
} from "@/app/context/specViewSelection/types";
import {
  SpecViewSelectionKey,
  type SpecViewTargetScope,
} from "@/features/specs/domain/specViewSelectionKey";

const defaultSelection: SpecViewSelection = {
  workspacePath: null,
  specId: null,
  fileKey: null,
  targetScope: "file",
};

/**
 * @param props - Provider props for the managed spec view section.
 * @returns Context provider that owns the active spec view selection.
 */
export function SpecViewSelectionProvider(
  props: SpecViewSelectionProviderProps,
): ReactElement {
  const { children } = props;
  const [selection, setSelection] =
    useState<SpecViewSelection>(defaultSelection);
  const selectionKey = useMemo(
    () => SpecViewSelectionKey.create(selection),
    [
      selection.fileKey,
      selection.specId,
      selection.targetScope,
      selection.workspacePath,
    ],
  );
  const setWorkspaceSelection = useCallback(
    (nextWorkspaceSelection: SpecViewWorkspaceSelectionInput): void => {
      setSelection((current) => {
        const nextSelection = {
          ...current,
          ...nextWorkspaceSelection,
        };

        return areSelectionsEqual(current, nextSelection)
          ? current
          : nextSelection;
      });
    },
    [],
  );
  const setTargetScope = useCallback(
    (targetScope: SpecViewTargetScope): void => {
      setSelection((current) => {
        if (current.targetScope === targetScope) {
          return current;
        }

        return {
          ...current,
          targetScope,
        };
      });
    },
    [],
  );
  const value = useMemo(
    () => ({
      selection,
      selectionKey,
      setWorkspaceSelection,
      setTargetScope,
    }),
    [selection, setTargetScope, setWorkspaceSelection, selectionKey],
  );

  return (
    <SpecViewSelectionContext.Provider value={value}>
      {children}
    </SpecViewSelectionContext.Provider>
  );
}

function areSelectionsEqual(
  current: SpecViewSelection,
  next: SpecViewSelection,
): boolean {
  return (
    current.workspacePath === next.workspacePath &&
    current.specId === next.specId &&
    current.fileKey === next.fileKey &&
    current.targetScope === next.targetScope
  );
}
