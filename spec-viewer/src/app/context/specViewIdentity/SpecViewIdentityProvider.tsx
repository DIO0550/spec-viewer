import { useCallback, useMemo, useState, type ReactElement } from "react";

import { SpecViewIdentityContext } from "@/app/context/specViewIdentity/context";
import type {
  SpecViewIdentityProviderProps,
  SpecViewSelection,
  SpecViewWorkspaceSelectionInput,
} from "@/app/context/specViewIdentity/types";
import {
  SpecViewIdentity,
  type SpecViewTargetScope,
} from "@/features/specs/domain/specViewIdentity";

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
export function SpecViewIdentityProvider(
  props: SpecViewIdentityProviderProps,
): ReactElement {
  const { children } = props;
  const [selection, setSelection] =
    useState<SpecViewSelection>(defaultSelection);
  const viewIdentity = useMemo(
    () => SpecViewIdentity.create(selection),
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
      viewIdentity,
      setWorkspaceSelection,
      setTargetScope,
    }),
    [selection, setTargetScope, setWorkspaceSelection, viewIdentity],
  );

  return (
    <SpecViewIdentityContext.Provider value={value}>
      {children}
    </SpecViewIdentityContext.Provider>
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
